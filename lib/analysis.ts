// Analyses urbaines : calculs dans la projection métrique du site (UTM).
import * as turf from '@turf/turf';
import type { Feature, LineString, MultiPolygon, Polygon, Position } from 'geojson';
import { metricArea, metricLength, toUtm, lineLen } from './proj';
import { matchAll } from './filters';
import { AMENITY_FAMILIES, ROAD_CLASSES } from './styles';
import type { FC, Layer, Site } from './types';

export interface ZoneDef {
  id: string;
  name: string;
  feature: Feature<Polygon | MultiPolygon>;
}

export interface Synthesis {
  zone: string;
  surface_m2: number;
  batiments_couche: string;
  nb_batiments: number;
  surface_batie_m2: number;
  emprise_sol: number; // ratio
  surface_moy_batiment_m2: number;
  batiments_renseignes: number; // nombre avec niveaux ou hauteur
  plancher_renseigne_m2: number;
  plancher_estime_m2: number;
  densite_cos: number; // plancher estimé / surface
  hypothese_niveaux: number;
  voirie_m: Record<string, number>;
  voirie_total_m: number;
  densite_voirie_km_km2: number;
  equipements: Record<string, number>;
  equipements_total: number;
  distance_equipement_m: Record<string, number | null>;
  population: number | null;
  densite_hab_ha: number | null;
  espaces_verts_m2: number;
  part_espaces_verts: number;
  eau_m2: number;
  part_eau: number;
  sources: string[];
}

function bboxOf(f: Feature) {
  return turf.bbox(f as any);
}
function bboxHit(a: number[], b: number[]) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

/** Aire (m²) de l'intersection d'un polygone avec la zone ; rapide si entièrement dedans. */
export function clippedArea(site: Site, f: Feature, zone: Feature<Polygon | MultiPolygon>, zb: number[]): number {
  const g = f.geometry;
  if (!g || !/Polygon/.test(g.type)) return 0;
  const b = bboxOf(f);
  if (!bboxHit(b, zb)) return 0;
  // tous les sommets dedans et zone convexe localement → test rapide
  const coords: Position[] = g.type === 'Polygon' ? g.coordinates[0] : (g as MultiPolygon).coordinates.flatMap((p) => p[0]);
  const allIn = coords.every((c) => turf.booleanPointInPolygon(c, zone));
  if (allIn && b[0] >= zb[0] && b[2] <= zb[2] && b[1] >= zb[1] && b[3] <= zb[3]) {
    // vérifie qu'aucune arête de la zone ne traverse l'objet
    try {
      if (!turf.booleanIntersects(turf.polygonToLine(zone as any) as any, f as any)) return metricArea(site.utm, g);
    } catch {
      return metricArea(site.utm, g);
    }
  }
  try {
    const i = turf.intersect(turf.featureCollection([f as any, zone as any]));
    return i ? metricArea(site.utm, i.geometry) : 0;
  } catch {
    // géométrie invalide : on garde le test du centre
    const c = turf.centroid(f as any).geometry.coordinates;
    return turf.booleanPointInPolygon(c, zone) ? metricArea(site.utm, g) : 0;
  }
}

type Ring = [number, number][];
const zoneCache = new WeakMap<object, Ring[]>();

/** Anneaux de la zone en coordonnées UTM (mis en cache). */
function zoneRings(site: Site, zone: Feature<Polygon | MultiPolygon>): Ring[] {
  let r = zoneCache.get(zone);
  if (!r) {
    const g = zone.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    r = polys.flatMap((p) => p.map((ring) => ring.map((c) => toUtm(site.utm, c))));
    zoneCache.set(zone, r);
  }
  return r;
}

function pipPlanar(rings: Ring[], x: number, y: number) {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

/** Longueur (m) d'une ligne à l'intérieur de la zone : découpe exacte aux intersections avec le contour. */
export function clippedLength(site: Site, f: Feature, zone: Feature<Polygon | MultiPolygon>, zb: number[]): number {
  const g = f.geometry;
  if (!g || !/LineString/.test(g.type)) return 0;
  if (!bboxHit(bboxOf(f), zb)) return 0;
  const rings = zoneRings(site, zone);
  const lines: Position[][] = g.type === 'LineString' ? [g.coordinates] : (g as any).coordinates;
  let total = 0;
  for (const cs of lines) {
    for (let i = 0; i < cs.length - 1; i++) {
      const a = toUtm(site.utm, cs[i]);
      const b = toUtm(site.utm, cs[i + 1]);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (!len) continue;
      const ts = [0, 1];
      for (const ring of rings)
        for (let k = 0; k < ring.length - 1; k++) {
          const [px, py] = ring[k];
          const ex = ring[k + 1][0] - px;
          const ey = ring[k + 1][1] - py;
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-12) continue;
          const t = ((px - a[0]) * ey - (py - a[1]) * ex) / den;
          const u = ((px - a[0]) * dy - (py - a[1]) * dx) / den;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
        }
      ts.sort((x, y) => x - y);
      for (let k = 0; k < ts.length - 1; k++) {
        const t0 = ts[k];
        const t1 = ts[k + 1];
        if (t1 - t0 < 1e-9) continue;
        const tm = (t0 + t1) / 2;
        if (pipPlanar(rings, a[0] + dx * tm, a[1] + dy * tm)) total += (t1 - t0) * len;
      }
    }
  }
  return total;
}

function pickLayer(site: Site, data: Record<string, FC>, role: Layer['role'], zone: Feature<Polygon | MultiPolygon>, prefer?: string): Layer | undefined {
  const cands = site.layers.filter((l) => l.role === role && l.kind === 'vector' && data[l.id]?.features.length);
  if (prefer) {
    const p = cands.find((l) => l.id === prefer);
    if (p) return p;
  }
  // la couche la plus fournie dans la zone
  const zb = turf.bbox(zone);
  let best: Layer | undefined;
  let bestN = -1;
  for (const l of cands) {
    let n = 0;
    for (const f of data[l.id].features) if (f.geometry && bboxHit(turf.bbox(f as any), zb)) n++;
    if (n > bestN) {
      bestN = n;
      best = l;
    }
  }
  return best;
}

export function niveauxOf(p: Record<string, any>, levelHeight: number): number | null {
  const n = Number(p?.niveaux);
  if (Number.isFinite(n) && n > 0) return n;
  const h = Number(p?.hauteur);
  if (Number.isFinite(h) && h > 0) return Math.max(1, Math.round(h / levelHeight));
  return null;
}

export function synthesis(site: Site, data: Record<string, FC>, z: ZoneDef, opts: { buildingsLayer?: string; defaultLevels?: number } = {}): Synthesis {
  const zone = z.feature;
  const zb = turf.bbox(zone);
  const surface = metricArea(site.utm, zone.geometry);
  const sources = new Set<string>();
  const filt = (l: Layer) => data[l.id].features.filter((f) => f.geometry && matchAll(f.properties || {}, l.filter));

  // bâti
  const bl = pickLayer(site, data, 'buildings', zone, opts.buildingsLayer);
  let nb = 0;
  let bati = 0;
  let renseignes = 0;
  let plancherR = 0;
  let plancherE = 0;
  const defLevels = opts.defaultLevels ?? Math.max(1, Math.round(site.settings.defaultHeight / site.settings.levelHeight));
  if (bl) {
    sources.add(bl.source.name);
    for (const f of filt(bl)) {
      const a = clippedArea(site, f as Feature, zone, zb);
      if (a <= 0.5) continue;
      nb++;
      bati += a;
      const n = niveauxOf(f.properties || {}, site.settings.levelHeight);
      if (n) {
        renseignes++;
        plancherR += a * n;
        plancherE += a * n;
      } else plancherE += a * defLevels;
    }
  }
  // voirie
  const rl = pickLayer(site, data, 'roads', zone);
  const voirie: Record<string, number> = {};
  let vt = 0;
  if (rl) {
    sources.add(rl.source.name);
    for (const f of filt(rl)) {
      const len = clippedLength(site, f as Feature, zone, zb);
      if (!len) continue;
      const c = String(f.properties?.classe || 'autre');
      voirie[c] = (voirie[c] || 0) + len;
      vt += len;
    }
  }
  // équipements (toutes les couches d'équipements)
  const eq: Record<string, number> = {};
  let eqT = 0;
  const dist: Record<string, number | null> = {};
  const c = turf.centroid(zone).geometry.coordinates;
  const cu = toUtm(site.utm, c);
  for (const fam of AMENITY_FAMILIES) dist[fam.value] = null;
  for (const l of site.layers.filter((x) => x.role === 'amenities' && x.kind === 'vector' && data[x.id])) {
    sources.add(l.source.name);
    for (const f of filt(l)) {
      const g = f.geometry;
      if (!g || g.type !== 'Point') continue;
      const fam = String(f.properties?.famille || 'autre');
      if (turf.booleanPointInPolygon(g.coordinates, zone)) {
        eq[fam] = (eq[fam] || 0) + 1;
        eqT++;
      }
      const p = toUtm(site.utm, g.coordinates);
      const d = Math.hypot(p[0] - cu[0], p[1] - cu[1]);
      if (dist[fam] === null || d < (dist[fam] as number)) dist[fam] = d;
    }
  }
  // population (carroyage) : somme pondérée par la part de chaque carreau dans la zone
  const pl = pickLayer(site, data, 'population', zone);
  let pop: number | null = null;
  if (pl) {
    sources.add(pl.source.name);
    pop = 0;
    for (const f of data[pl.id].features) {
      const v = Number(f.properties?.population);
      if (!Number.isFinite(v) || !f.geometry) continue;
      const full = metricArea(site.utm, f.geometry);
      if (!full) continue;
      const a = clippedArea(site, f as Feature, zone, zb);
      if (a > 0) pop += (v * a) / full;
    }
  }
  // espaces verts et eau (polygones)
  let vert = 0;
  for (const l of site.layers.filter((x) => x.role === 'green' && x.kind === 'vector' && data[x.id])) {
    sources.add(l.source.name);
    vert += unionArea(site, filt(l) as Feature[], zone, zb);
  }
  let eau = 0;
  for (const l of site.layers.filter((x) => x.role === 'water' && x.kind === 'vector' && x.geom !== 'line' && data[x.id])) {
    sources.add(l.source.name);
    eau += unionArea(site, filt(l) as Feature[], zone, zb);
  }
  return {
    zone: z.name,
    surface_m2: surface,
    batiments_couche: bl?.name || '—',
    nb_batiments: nb,
    surface_batie_m2: bati,
    emprise_sol: surface ? bati / surface : 0,
    surface_moy_batiment_m2: nb ? bati / nb : 0,
    batiments_renseignes: renseignes,
    plancher_renseigne_m2: plancherR,
    plancher_estime_m2: plancherE,
    densite_cos: surface ? plancherE / surface : 0,
    hypothese_niveaux: defLevels,
    voirie_m: voirie,
    voirie_total_m: vt,
    densite_voirie_km_km2: surface ? vt / 1000 / (surface / 1e6) : 0,
    equipements: eq,
    equipements_total: eqT,
    distance_equipement_m: dist,
    population: pop,
    densite_hab_ha: pop !== null && surface ? pop / (surface / 1e4) : null,
    espaces_verts_m2: vert,
    part_espaces_verts: surface ? vert / surface : 0,
    eau_m2: eau,
    part_eau: surface ? eau / surface : 0,
    sources: [...sources],
  };
}

/** Aire de l'union des polygones dans la zone (évite de compter deux fois les recouvrements). */
function unionArea(site: Site, feats: Feature[], zone: Feature<Polygon | MultiPolygon>, zb: number[]) {
  const parts: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of feats) {
    if (!f.geometry || !/Polygon/.test(f.geometry.type) || !bboxHit(bboxOf(f), zb)) continue;
    try {
      const i = turf.intersect(turf.featureCollection([f as any, zone as any]));
      if (i) parts.push(i as any);
    } catch {
      /* géométrie invalide ignorée */
    }
  }
  if (!parts.length) return 0;
  try {
    const u = parts.length > 1 ? turf.union(turf.featureCollection(parts)) : parts[0];
    return u ? metricArea(site.utm, u.geometry) : 0;
  } catch {
    return parts.reduce((s, p) => s + metricArea(site.utm, p.geometry), 0);
  }
}

const pct = (v: number) => `${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const n0 = (v: number) => Math.round(v).toLocaleString('fr-FR');
const n2 = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Lignes du tableau de synthèse : [libellé, valeur affichée, valeur brute pour le CSV]. */
export function synthesisRows(s: Synthesis): [string, string, string | number][] {
  const rows: [string, string, string | number][] = [
    ['Surface totale', `${n0(s.surface_m2)} m² (${n2(s.surface_m2 / 1e4)} ha)`, Math.round(s.surface_m2)],
    ['Couche de bâti utilisée', s.batiments_couche, s.batiments_couche],
    ['Nombre de bâtiments', n0(s.nb_batiments), s.nb_batiments],
    ['Surface bâtie (emprise)', `${n0(s.surface_batie_m2)} m²`, Math.round(s.surface_batie_m2)],
    ['Emprise au sol (CES)', pct(s.emprise_sol), Number(s.emprise_sol.toFixed(4))],
    ['Surface moyenne des bâtiments', `${n0(s.surface_moy_batiment_m2)} m²`, Math.round(s.surface_moy_batiment_m2)],
    ['Bâtiments avec niveaux ou hauteur', `${n0(s.batiments_renseignes)} (${s.nb_batiments ? pct(s.batiments_renseignes / s.nb_batiments) : '—'})`, s.batiments_renseignes],
    ['Surface de plancher (bâtiments renseignés)', `${n0(s.plancher_renseigne_m2)} m²`, Math.round(s.plancher_renseigne_m2)],
    [`Surface de plancher estimée (autres : ${s.hypothese_niveaux} niveau${s.hypothese_niveaux > 1 ? 'x' : ''})`, `${n0(s.plancher_estime_m2)} m²`, Math.round(s.plancher_estime_m2)],
    ['Densité bâtie (COS estimé)', n2(s.densite_cos), Number(s.densite_cos.toFixed(3))],
  ];
  for (const rc of ROAD_CLASSES) if (s.voirie_m[rc.value]) rows.push([`Voirie — ${rc.label.toLowerCase()}`, `${n0(s.voirie_m[rc.value])} m`, Math.round(s.voirie_m[rc.value])]);
  rows.push(['Linéaire de voirie total', `${n0(s.voirie_total_m)} m`, Math.round(s.voirie_total_m)]);
  rows.push(['Densité de voirie', `${n2(s.densite_voirie_km_km2)} km/km²`, Number(s.densite_voirie_km_km2.toFixed(2))]);
  rows.push(['Équipements dans la zone', n0(s.equipements_total), s.equipements_total]);
  for (const f of AMENITY_FAMILIES) {
    const n = s.equipements[f.value] || 0;
    const d = s.distance_equipement_m[f.value];
    rows.push([`${f.label}`, `${n} dans la zone · plus proche à ${d === null ? '—' : `${n0(d)} m`} du centre`, `${n};${d === null ? '' : Math.round(d)}`]);
  }
  rows.push(['Population estimée', s.population === null ? 'pas de donnée (collectez WorldPop)' : `${n0(s.population)} hab.`, s.population === null ? '' : Math.round(s.population)]);
  rows.push(['Densité de population', s.densite_hab_ha === null ? '—' : `${n0(s.densite_hab_ha)} hab./ha (${n0(s.densite_hab_ha * 100)} hab./km²)`, s.densite_hab_ha === null ? '' : Number(s.densite_hab_ha.toFixed(1))]);
  rows.push(['Espaces verts', `${n0(s.espaces_verts_m2)} m² (${pct(s.part_espaces_verts)})`, Math.round(s.espaces_verts_m2)]);
  rows.push(['Surfaces en eau', `${n0(s.eau_m2)} m² (${pct(s.part_eau)})`, Math.round(s.eau_m2)]);
  return rows;
}

export function synthesisCsv(list: Synthesis[]): string {
  const rows = list.map(synthesisRows);
  const head = ['Indicateur', ...list.map((s) => s.zone)];
  const lines = [head];
  for (let i = 0; i < rows[0].length; i++) lines.push([rows[0][i][0], ...rows.map((r) => String(r[i][2]))]);
  lines.push(['Sources', ...list.map((s) => s.sources.join(' / '))]);
  return '﻿' + lines.map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
}

/** Grille hexagonale de densité de points (nombre et densité par hectare). */
export function densityGrid(site: Site, points: Feature[], cellM: number, area: Feature<Polygon | MultiPolygon>): FC {
  const bb = turf.bbox(area);
  const grid = turf.hexGrid(bb, cellM / 1000, { units: 'kilometers' });
  const pts = points.filter((p) => p.geometry?.type === 'Point');
  const out: any[] = [];
  for (const h of grid.features) {
    const hb = turf.bbox(h);
    let n = 0;
    for (const p of pts) {
      const c = (p.geometry as any).coordinates;
      if (c[0] < hb[0] || c[0] > hb[2] || c[1] < hb[1] || c[1] > hb[3]) continue;
      if (turf.booleanPointInPolygon(c, h)) n++;
    }
    const centre = turf.centroid(h).geometry.coordinates;
    if (!turf.booleanPointInPolygon(centre, area)) continue;
    const a = metricArea(site.utm, h.geometry) / 1e4;
    out.push({ type: 'Feature', geometry: h.geometry, properties: { nombre: n, densite_ha: Math.round((n / a) * 100) / 100 } });
  }
  return { type: 'FeatureCollection', features: out };
}

/** Profil : échantillonne une ligne tous les `step` mètres. */
export function sampleLine(site: Site, line: LineString, step: number): { d: number; lon: number; lat: number }[] {
  const cs = line.coordinates;
  const out: { d: number; lon: number; lat: number }[] = [];
  let acc = 0;
  for (let i = 0; i < cs.length - 1; i++) {
    const a = toUtm(site.utm, cs[i]);
    const b = toUtm(site.utm, cs[i + 1]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ d: acc + len * t, lon: cs[i][0] + (cs[i + 1][0] - cs[i][0]) * t, lat: cs[i][1] + (cs[i + 1][1] - cs[i][1]) * t });
    }
    acc += len;
  }
  const last = cs[cs.length - 1];
  out.push({ d: acc, lon: last[0], lat: last[1] });
  return out;
}

export { lineLen, metricLength };
