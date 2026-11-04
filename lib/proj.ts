import proj4 from 'proj4';
import type { Feature, Geometry, Position } from 'geojson';

export interface UtmInfo {
  zone: number;
  epsg: number;
  south: boolean;
}

/** Zone UTM adaptée à un point (règle standard, sans les exceptions norvégiennes, inutiles au Sénégal). */
export function utmForLonLat(lon: number, lat: number): UtmInfo {
  const zone = Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
  const south = lat < 0;
  return { zone, south, epsg: (south ? 32700 : 32600) + zone };
}

export function utmProj4(u: UtmInfo): string {
  return `+proj=utm +zone=${u.zone}${u.south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`;
}

const cache = new Map<number, proj4.Converter>();
export function converter(u: UtmInfo): proj4.Converter {
  let c = cache.get(u.epsg);
  if (!c) {
    c = proj4('EPSG:4326', utmProj4(u));
    cache.set(u.epsg, c);
  }
  return c;
}

export function toUtm(u: UtmInfo, p: Position): [number, number] {
  const r = converter(u).forward([p[0], p[1]]);
  return [r[0], r[1]];
}

export function fromUtm(u: UtmInfo, p: Position): [number, number] {
  const r = converter(u).inverse([p[0], p[1]]);
  return [r[0], r[1]];
}

export function mapCoords(g: Geometry, f: (p: Position) => Position): Geometry {
  switch (g.type) {
    case 'Point':
      return { type: 'Point', coordinates: f(g.coordinates) };
    case 'MultiPoint':
    case 'LineString':
      return { type: g.type, coordinates: g.coordinates.map(f) } as Geometry;
    case 'MultiLineString':
    case 'Polygon':
      return { type: g.type, coordinates: g.coordinates.map((r) => r.map(f)) } as Geometry;
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map((r) => r.map(f))) };
    case 'GeometryCollection':
      return { type: 'GeometryCollection', geometries: g.geometries.map((x) => mapCoords(x, f)) };
  }
}

export function projectGeometry(u: UtmInfo, g: Geometry): Geometry {
  return mapCoords(g, (p) => toUtm(u, p));
}

export function unprojectGeometry(u: UtmInfo, g: Geometry): Geometry {
  return mapCoords(g, (p) => fromUtm(u, p));
}

/** Aire plane d'un anneau (formule du lacet), coordonnées métriques. */
export function ringArea(r: Position[]): number {
  let s = 0;
  for (let i = 0, n = r.length; i < n - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(s) / 2;
}

function polyArea(rings: Position[][]): number {
  if (!rings.length) return 0;
  let a = ringArea(rings[0]);
  for (let i = 1; i < rings.length; i++) a -= ringArea(rings[i]);
  return Math.max(0, a);
}

export function lineLen(cs: Position[]): number {
  let l = 0;
  for (let i = 0; i < cs.length - 1; i++) l += Math.hypot(cs[i + 1][0] - cs[i][0], cs[i + 1][1] - cs[i][1]);
  return l;
}

/** Aire (m²) d'une géométrie WGS84, calculée dans la projection UTM du site. */
export function metricArea(u: UtmInfo, g: Geometry | null | undefined): number {
  if (!g) return 0;
  const p = projectGeometry(u, g);
  switch (p.type) {
    case 'Polygon':
      return polyArea(p.coordinates);
    case 'MultiPolygon':
      return p.coordinates.reduce((s, x) => s + polyArea(x), 0);
    case 'GeometryCollection':
      return p.geometries.reduce((s, x) => s + metricArea(u, unprojectGeometry(u, x)), 0);
    default:
      return 0;
  }
}

/** Longueur (m) d'une ligne, ou périmètre d'un polygone, dans la projection du site. */
export function metricLength(u: UtmInfo, g: Geometry | null | undefined): number {
  if (!g) return 0;
  const p = projectGeometry(u, g);
  switch (p.type) {
    case 'LineString':
      return lineLen(p.coordinates);
    case 'MultiLineString':
      return p.coordinates.reduce((s, x) => s + lineLen(x), 0);
    case 'Polygon':
      return p.coordinates.reduce((s, x) => s + lineLen(x), 0);
    case 'MultiPolygon':
      return p.coordinates.reduce((s, poly) => s + poly.reduce((t, r) => t + lineLen(r), 0), 0);
    default:
      return 0;
  }
}

export function metricDistance(u: UtmInfo, a: Position, b: Position): number {
  const pa = toUtm(u, a);
  const pb = toUtm(u, b);
  return Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
}

export function featureArea(u: UtmInfo, f: Feature): number {
  return metricArea(u, f.geometry);
}

export function fmtLength(m: number): string {
  if (m >= 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace('.', ',')} km`;
  return `${m.toFixed(m < 10 ? 2 : 1).replace('.', ',')} m`;
}

export function fmtArea(m2: number): string {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2).replace('.', ',')} km²`;
  if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(2).replace('.', ',')} ha (${Math.round(m2).toLocaleString('fr-FR')} m²)`;
  return `${m2.toFixed(m2 < 100 ? 1 : 0).replace('.', ',')} m²`;
}

export function fmtNum(n: number, d = 0): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
}
