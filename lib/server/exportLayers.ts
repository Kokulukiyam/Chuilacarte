import 'server-only';
import type { Feature, Geometry } from 'geojson';
import { readLayer } from './storage';
import { matchAll } from '../filters';
import { projectGeometry } from '../proj';
import { computeGradClasses, featureColor } from '../styles';
import { hexToAci, writeDxf, type DxfEntity } from '../dxf-write';
import { geomTypeOf, safeTable, utmWkt, writeGpkg, type GpkgLayer } from './gpkg';
import { layerQml } from './qgis';
import type { Layer, Site } from '../types';

export interface ExportLayer {
  layer: Layer;
  features: Feature[];
}

const ANN_KIND_FR: Record<string, string> = { point: 'point', line: 'ligne', polygon: 'polygone', rectangle: 'rectangle', circle: 'cercle', arrow: 'flèche', text: 'texte', marker: 'repère', dimension: 'cotation', freehand: 'croquis' };

export function cleanProps(layer: Layer, p: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(p || {})) if (!k.startsWith('_') && v !== undefined) out[k] = v;
  if (layer.role === 'annotations') {
    out.type = ANN_KIND_FR[p._kind] || p._kind;
    if (p._text) out.texte = p._text;
    if (p._num) out.numero = p._num;
    if (p._legend) out.legende = p._legend;
    out.couleur = p._color;
    if (p._size) out.taille = p._size;
  }
  return out;
}

/** Couches vectorielles visibles (ou choisies), filtre attributaire appliqué. */
export async function collectExportLayers(site: Site, ids?: string[]): Promise<ExportLayer[]> {
  const chosen = site.layers.filter((l) => l.kind === 'vector' && (ids?.length ? ids.includes(l.id) : l.visible));
  const out: ExportLayer[] = [];
  for (const l of chosen) {
    const fc = await readLayer(site.slug, l.id);
    out.push({ layer: l, features: (fc.features as Feature[]).filter((f) => f.geometry && matchAll(f.properties || {}, l.filter)) });
  }
  return out;
}

export function toUtmFeatures(site: Site, feats: Feature[]): Feature[] {
  return feats.map((f) => ({ ...f, geometry: projectGeometry(site.utm, f.geometry as Geometry) }));
}

const KIND_OF = (t: string) => (/Point/.test(t) ? 'marker' : /Line/.test(t) ? 'line' : 'fill') as 'marker' | 'line' | 'fill';
const KIND_FR: Record<string, string> = { marker: 'points', line: 'lignes', fill: 'polygones' };

/**
 * GeoPackage multi-couches. Une couche à géométries mixtes (annotations, imports…) est répartie en une table
 * par type de géométrie : QGIS n'affiche qu'un type par couche.
 */
export function buildGpkg(file: string, site: Site, layers: ExportLayer[], crs: 'utm' | 'wgs84' = 'utm') {
  const used = new Set<string>();
  const srsId = crs === 'utm' ? site.utm.epsg : 4326;
  const gl: (GpkgLayer & { layerId: string; kind: 'marker' | 'line' | 'fill'; suffix?: string; styled: Layer })[] = [];
  for (const { layer, features } of layers) {
    const feats = (crs === 'utm' ? toUtmFeatures(site, features) : features).map((f) => ({ geometry: f.geometry as Geometry, properties: cleanProps(layer, f.properties || {}) }));
    const groups = new Map<string, typeof feats>();
    for (const f of feats) {
      const k = KIND_OF(f.geometry.type);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(f);
    }
    const multi = groups.size > 1;
    for (const k of ['fill', 'line', 'marker'] as const) {
      const g = groups.get(k);
      if (!g) continue;
      const style = ensureGradClasses(layer, g);
      gl.push({
        layerId: layer.id,
        kind: k,
        suffix: multi ? KIND_FR[k] : undefined,
        table: safeTable(multi ? `${layer.name} ${KIND_FR[k]}` : layer.name, used),
        title: multi ? `${layer.name} (${KIND_FR[k]})` : layer.name,
        description: `${layer.source.name} — ${layer.source.license}${layer.source.attribution ? ` — ${layer.source.attribution}` : ''} — collecté le ${layer.source.collectedAt.slice(0, 10)}`,
        features: g,
        geomType: geomTypeOf(g),
        qml: layerQml(style, g, k),
        styled: style,
      });
    }
  }
  writeGpkg(file, gl, crs === 'utm' ? { id: srsId, name: `WGS 84 / UTM zone ${site.utm.zone}${site.utm.south ? 'S' : 'N'}`, wkt: utmWkt(srsId) } : { id: 4326, name: 'WGS 84', wkt: '' });
  return gl.map((g) => ({ layerId: g.layerId, table: g.table, geomType: g.geomType, count: g.features.length, features: g.features, kind: g.kind, suffix: g.suffix, styled: g.styled }));
}

/** Style gradué sans classes (calcul jamais fait) : on calcule les bornes sur les objets exportés. */
export function ensureGradClasses(layer: Layer, feats: { properties: Record<string, any> }[]): Layer {
  const g = layer.style.graduated;
  // classes absentes, ou dégénérées (bornes égales) : on recalcule sur les objets exportés
  const degenerate = g?.classes.some((c) => c.min === c.max) ?? false;
  if (layer.style.mode !== 'graduated' || !g?.field || (g.classes.length && !degenerate)) return layer;
  const vals = feats.map((f) => Number(f.properties?.[g.field])).filter(Number.isFinite);
  return { ...layer, style: { ...layer.style, graduated: { ...g, classes: computeGradClasses(vals, g.method, g.ramp, 5) } } };
}

export function buildDxf(site: Site, layers: ExportLayer[]): string {
  const ents: DxfEntity[] = [];
  const layerColors: Record<string, number> = {};
  const layerLtypes: Record<string, string> = {};
  for (const { layer, features } of layers) {
    const s = layer.style;
    layerColors[layer.name] = layer.role === 'annotations' ? 1 : hexToAci(layer.geom === 'line' ? s.stroke : s.fillOpacity > 0.05 ? s.fill : s.stroke);
    layerLtypes[layer.name] = s.dash === 'dash' ? 'DASHED' : s.dash === 'dot' ? 'DOT' : 'CONTINUOUS';
    for (const f of toUtmFeatures(site, features)) {
      const p = f.properties || {};
      let color: number | undefined;
      if (layer.role === 'annotations') color = hexToAci(p._color || '#dc2626');
      else if (s.mode !== 'simple') color = hexToAci(featureColor(s, p, layer.geom === 'line' ? 'stroke' : 'fill'));
      if (layer.role === 'annotations' && (p._kind === 'text' || p._kind === 'marker') && f.geometry.type === 'Point') {
        const text = p._kind === 'text' ? p._text : `${p._num}${p._legend ? ` ${p._legend}` : ''}`;
        ents.push({ layer: layer.name, geometry: f.geometry, text: String(text || ''), textHeight: ((p._size || 16) * 0.2646 * 1) || 4, color });
        continue;
      }
      const alt = Number(p.altitude);
      ents.push({ layer: layer.name, geometry: f.geometry, color, elevation: layer.role === 'contours' && Number.isFinite(alt) ? alt : undefined });
      if (s.label?.field && p[s.label.field] !== undefined && f.geometry.type === 'Point') {
        ents.push({ layer: `${layer.name}_etiquettes`, geometry: f.geometry, text: String(p[s.label.field]), textHeight: 2 });
      }
    }
  }
  return writeDxf(ents, { layerColors, layerLtypes });
}
