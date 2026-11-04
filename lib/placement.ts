// Calage d'un plan (DXF en coordonnées locales, ou image) : similitude locale (m) → UTM du site.
import type { Geometry, Position } from 'geojson';
import { fromUtm, mapCoords, toUtm, type UtmInfo } from './proj';
import type { FC, Placement } from './types';

export function placeLocal(u: UtmInfo, p: Placement, x: number, y: number): [number, number] {
  const [E0, N0] = toUtm(u, p.anchor);
  const th = (p.rotation * Math.PI) / 180;
  const s = p.scale;
  const E = E0 + s * (x * Math.cos(th) - y * Math.sin(th));
  const N = N0 + s * (x * Math.sin(th) + y * Math.cos(th));
  return fromUtm(u, [E, N]);
}

export function unplaceLocal(u: UtmInfo, p: Placement, lon: number, lat: number): [number, number] {
  const [E0, N0] = toUtm(u, p.anchor);
  const [E, N] = toUtm(u, [lon, lat]);
  const th = (p.rotation * Math.PI) / 180;
  const dx = (E - E0) / p.scale;
  const dy = (N - N0) / p.scale;
  return [dx * Math.cos(th) + dy * Math.sin(th), -dx * Math.sin(th) + dy * Math.cos(th)];
}

export function placeGeometry(u: UtmInfo, p: Placement, g: Geometry): Geometry {
  return mapCoords(g, (c: Position) => placeLocal(u, p, c[0], c[1]));
}

/** Recalcule la géométrie de chaque objet à partir de ses coordonnées locales (_local). */
export function applyPlacement(u: UtmInfo, p: Placement, fc: FC): FC {
  return {
    ...fc,
    features: fc.features.map((f) => (f.properties?._local ? { ...f, geometry: placeGeometry(u, p, f.properties._local) } : f)),
  };
}

/** Coins d'une image calée (HG, HD, BD, BG) ; coordonnées locales : centre de l'image, 1 unité = 1 pixel. */
export function imageCorners(u: UtmInfo, p: Placement): [[number, number], [number, number], [number, number], [number, number]] {
  const [W, H] = p.imageSize || [1000, 1000];
  const c = (px: number, py: number) => placeLocal(u, p, px - W / 2, H / 2 - py);
  return [c(0, 0), c(W, 0), c(W, H), c(0, H)];
}

/** pixel d'image → coordonnées locales */
export function pixelToLocal(p: Placement, px: number, py: number): [number, number] {
  const [W, H] = p.imageSize || [1000, 1000];
  return [px - W / 2, H / 2 - py];
}

/**
 * Similitude (Helmert à 4 paramètres) par moindres carrés à partir de couples
 * local (x, y) → terrain UTM (E, N). Deux points suffisent ; trois points ou plus donnent un calage moyen et un résidu.
 */
export function helmert(pairs: { local: [number, number]; utm: [number, number] }[]) {
  const n = pairs.length;
  if (n < 2) throw new Error('Il faut au moins deux points de calage');
  const mx = pairs.reduce((s, p) => s + p.local[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p.local[1], 0) / n;
  const mE = pairs.reduce((s, p) => s + p.utm[0], 0) / n;
  const mN = pairs.reduce((s, p) => s + p.utm[1], 0) / n;
  let sxx = 0;
  let sa = 0;
  let sb = 0;
  for (const p of pairs) {
    const x = p.local[0] - mx;
    const y = p.local[1] - my;
    const E = p.utm[0] - mE;
    const N = p.utm[1] - mN;
    sxx += x * x + y * y;
    sa += x * E + y * N;
    sb += x * N - y * E;
  }
  if (sxx === 0) throw new Error('Points de calage confondus');
  const a = sa / sxx;
  const b = sb / sxx;
  const tx = mE - a * mx + b * my;
  const ty = mN - b * mx - a * my;
  let rms = 0;
  for (const p of pairs) {
    const E = tx + a * p.local[0] - b * p.local[1];
    const N = ty + b * p.local[0] + a * p.local[1];
    rms += (E - p.utm[0]) ** 2 + (N - p.utm[1]) ** 2;
  }
  return { scale: Math.hypot(a, b), rotation: (Math.atan2(b, a) * 180) / Math.PI, origin: [tx, ty] as [number, number], rms: Math.sqrt(rms / n) };
}

export const UNIT_FACTOR: Record<Placement['units'], number> = { m: 1, cm: 0.01, mm: 0.001, px: 1 };

/** Prépare un plan DXF local : coordonnées converties en mètres et centrées ; renvoie le décalage appliqué. */
export function prepareLocalPlan(fc: FC, units: Placement['units']): { fc: FC; center: [number, number] } {
  const k = UNIT_FACTOR[units];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const visit = (c: any) => {
    if (typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]);
      x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]);
      y1 = Math.max(y1, c[1]);
    } else c.forEach(visit);
  };
  for (const f of fc.features) if (f.geometry) visit((f.geometry as any).coordinates);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    center: [cx, cy],
    fc: {
      ...fc,
      features: fc.features.map((f) => ({
        ...f,
        properties: { ...f.properties, _local: mapCoords(f.geometry as Geometry, (c) => [(c[0] - cx) * k, (c[1] - cy) * k]) },
      })),
    },
  };
}
