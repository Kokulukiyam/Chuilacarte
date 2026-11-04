// Ombres portées : position du soleil (SunCalc) et projection des volumes extrudés au sol.
import * as SunCalc from 'suncalc';
import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { fromUtm, toUtm, type UtmInfo } from './proj';
import { niveauxOf } from './analysis';
import type { FC } from './types';

export interface SunInfo {
  altitude: number; // degrés
  azimuth: number; // degrés depuis le nord, sens horaire
  shadowFactor: number; // longueur d'ombre / hauteur
}

/** Heure locale du Sénégal = UTC (pas d'heure d'été). */
export function sunAt(date: Date, lon: number, lat: number): SunInfo {
  // SunCalc 2 : altitude apparente (réfraction corrigée) et azimut en degrés, azimut compté depuis le nord dans le sens horaire
  const p = SunCalc.getPosition(date, lat, lon) as any;
  const alt = Number(p.altitude);
  const az = ((Number(p.azimuth) % 360) + 360) % 360;
  return { altitude: alt, azimuth: az, shadowFactor: alt > 0 ? 1 / Math.tan((alt * Math.PI) / 180) : Infinity };
}

function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Ombre d'un bâtiment de hauteur h : enveloppe du pied et du toit projeté au sol
 * (exacte pour une emprise convexe, légèrement majorée pour une emprise concave).
 */
export function shadowOf(u: UtmInfo, f: Feature, h: number, sun: SunInfo): Feature | null {
  if (sun.altitude <= 0.5 || h <= 0) return null;
  const g = f.geometry;
  if (!g) return null;
  const L = Math.min(h * sun.shadowFactor, 2000);
  const dir = ((sun.azimuth + 180) * Math.PI) / 180;
  const dx = L * Math.sin(dir);
  const dy = L * Math.cos(dir);
  const rings: Position[][] = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];
  const parts: Position[][][] = [];
  for (const r of rings) {
    const pts: [number, number][] = [];
    for (const c of r) {
      const p = toUtm(u, c);
      pts.push(p, [p[0] + dx, p[1] + dy]);
    }
    const hl = hull(pts);
    if (hl.length < 3) continue;
    parts.push([[...hl, hl[0]].map((p) => fromUtm(u, p))]);
  }
  if (!parts.length) return null;
  return { type: 'Feature', geometry: parts.length === 1 ? { type: 'Polygon', coordinates: parts[0] } : { type: 'MultiPolygon', coordinates: parts }, properties: { hauteur_m: Math.round(h * 10) / 10, longueur_ombre_m: Math.round(L * 10) / 10 } };
}

export function heightOf(p: Record<string, any>, levelHeight: number, def: number): number {
  const h = Number(p?.hauteur);
  if (Number.isFinite(h) && h > 0) return h;
  const n = niveauxOf(p, levelHeight);
  return n ? n * levelHeight : def;
}

export function shadowsFor(u: UtmInfo, layers: { fc: FC; height: (p: Record<string, any>) => number }[], sun: SunInfo, bbox: number[]): FC {
  const out: Feature[] = [];
  for (const { fc, height } of layers)
    for (const f of fc.features) {
      if (!f.geometry || !/Polygon/.test(f.geometry.type)) continue;
      const c = (f.geometry as any).type === 'Polygon' ? (f.geometry as any).coordinates[0][0] : (f.geometry as any).coordinates[0][0][0];
      if (c[0] < bbox[0] || c[0] > bbox[2] || c[1] < bbox[1] || c[1] > bbox[3]) continue;
      const s = shadowOf(u, f as Feature, height(f.properties || {}), sun);
      if (s) out.push(s);
    }
  return { type: 'FeatureCollection', features: dissolve(out) as any };
}

/** Fusion des ombres (teinte uniforme là où elles se recouvrent), par paquets pour rester rapide. */
export function dissolve(feats: Feature[], budgetMs = 2500): Feature[] {
  if (feats.length < 2) return feats;
  const t0 = Date.now();
  try {
    let level = feats as Feature<Polygon | MultiPolygon>[];
    while (level.length > 1) {
      const next: Feature<Polygon | MultiPolygon>[] = [];
      for (let i = 0; i < level.length; i += 24) {
        const chunk = level.slice(i, i + 24);
        const u = chunk.length > 1 ? turf.union(turf.featureCollection(chunk)) : chunk[0];
        if (u) next.push(u as Feature<Polygon | MultiPolygon>);
        if (Date.now() - t0 > budgetMs) return feats;
      }
      level = next;
    }
    return level.map((f) => ({ ...f, properties: { type: 'ombre' } }));
  } catch {
    return feats;
  }
}
