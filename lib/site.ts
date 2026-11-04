import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { nanoid } from 'nanoid';
import { utmForLonLat } from './proj';
import { baseStyle, defaultStyleFor, presetById, cloneStyle } from './styles';
import type { FC, GeomKind, Layer, LayerRole, LayerSource, Site } from './types';

export function newId(prefix = 'l') {
  return `${prefix}${nanoid(10).replace(/[^A-Za-z0-9]/g, 'x')}`;
}

export function userSource(name = 'Saisie utilisateur'): LayerSource {
  return { name, license: '—', attribution: '', collectedAt: new Date().toISOString() };
}

export function detectGeom(fc: FC): GeomKind {
  const kinds = new Set<string>();
  for (const f of fc.features) {
    const t = f.geometry?.type;
    if (!t) continue;
    if (t.includes('Polygon')) kinds.add('polygon');
    else if (t.includes('LineString')) kinds.add('line');
    else if (t.includes('Point')) kinds.add('point');
    else kinds.add('mixed');
    if (kinds.size > 1) return 'mixed';
  }
  return (kinds.values().next().value as GeomKind) || 'mixed';
}

export function makeLayer(opts: {
  name: string;
  role: LayerRole;
  geom: GeomKind;
  source?: LayerSource;
  count?: number;
  id?: string;
  stylePreset?: string;
}): Layer {
  const style = opts.stylePreset ? cloneStyle(presetById(opts.stylePreset)!.style) : defaultStyleFor(opts.role, opts.geom);
  return {
    id: opts.id || newId(),
    name: opts.name,
    kind: 'vector',
    geom: opts.geom,
    role: opts.role,
    visible: true,
    opacity: 1,
    source: opts.source || userSource(),
    style,
    filter: [],
    count: opts.count,
    legend: true,
  };
}

/** Normalise une emprise quelconque en un (multi)polygone. Les points/lignes reçoivent un tampon de 100 m. */
export function normalizeEmprise(fc: FC): Feature<Polygon | MultiPolygon> {
  const polys = fc.features.filter((f) => f.geometry && /Polygon/.test(f.geometry.type)) as Feature<Polygon | MultiPolygon>[];
  if (polys.length === 1) return { type: 'Feature', properties: {}, geometry: polys[0].geometry };
  if (polys.length > 1) {
    try {
      const u = turf.union(turf.featureCollection(polys));
      if (u) return { type: 'Feature', properties: {}, geometry: u.geometry };
    } catch {
      /* repli sur l'enveloppe */
    }
  }
  const valid = fc.features.filter((f) => f.geometry);
  if (!valid.length) throw new Error('Aucune géométrie exploitable pour définir l’emprise');
  if (polys.length === 0) {
    const b = turf.buffer(turf.featureCollection(valid as any), 100, { units: 'meters' });
    if (b && b.features.length) {
      const u = b.features.length > 1 ? turf.union(b as any) : b.features[0];
      if (u) return { type: 'Feature', properties: {}, geometry: u.geometry as Polygon | MultiPolygon };
    }
  }
  const env = turf.bboxPolygon(turf.bbox(turf.featureCollection(valid as any)));
  return { type: 'Feature', properties: {}, geometry: env.geometry };
}

export function bufferedEmprise(site: Pick<Site, 'emprise' | 'buffer'>): Feature<Polygon | MultiPolygon> {
  if (!site.buffer || site.buffer <= 0) return site.emprise;
  const b = turf.buffer(site.emprise, site.buffer, { units: 'meters', steps: 16 });
  return (b as Feature<Polygon | MultiPolygon>) || site.emprise;
}

export function siteBBox(site: Pick<Site, 'emprise' | 'buffer'>): [number, number, number, number] {
  return turf.bbox(bufferedEmprise(site)) as [number, number, number, number];
}

export function perimeterLayers(site: Site): { layers: Layer[]; data: Record<string, FC> } {
  const per = makeLayer({ name: 'Emprise du site', role: 'perimeter', geom: 'polygon', stylePreset: 'perimetre', source: userSource('Emprise du site'), count: 1 });
  per.id = 'emprise';
  const layers = [per];
  const data: Record<string, FC> = { emprise: { type: 'FeatureCollection', features: [{ ...site.emprise, properties: { nom: site.name } }] } };
  if (site.buffer > 0) {
    const buf = makeLayer({ name: `Zone tampon (${site.buffer} m)`, role: 'buffer', geom: 'polygon', source: userSource('Zone tampon'), count: 1 });
    buf.id = 'tampon';
    buf.style = baseStyle({ fill: '#000000', fillOpacity: 0, stroke: '#71717a', strokeWidth: 1, dash: 'dot', preset: 'tampon' });
    buf.legendLabel = `Zone tampon de ${site.buffer} m`;
    layers.push(buf);
    data.tampon = { type: 'FeatureCollection', features: [{ ...bufferedEmprise(site), properties: { distance_m: site.buffer } }] };
  }
  return { layers, data };
}

export function createSiteObject(name: string, slug: string, empriseFc: FC, buffer: number): Site {
  const emprise = normalizeEmprise(empriseFc);
  const c = turf.centroid(emprise).geometry.coordinates as [number, number];
  const now = new Date().toISOString();
  const site: Site = {
    slug,
    name,
    createdAt: now,
    updatedAt: now,
    emprise,
    buffer: Math.max(0, Math.min(20000, Math.round(buffer || 0))),
    utm: utmForLonLat(c[0], c[1]),
    center: c,
    basemap: 'clair',
    layers: [],
    layouts: [],
    reports: [],
    settings: { defaultHeight: 6, levelHeight: 3 },
  };
  return site;
}
