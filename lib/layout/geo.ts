import type { Layout } from '../types';

export const R = 6378137;
export const PX_MM = 25.4 / 96; // 1 pixel CSS = 0,2646 mm sur papier

export function mercX(lon: number) {
  return (R * lon * Math.PI) / 180;
}
export function mercY(lat: number) {
  const l = Math.max(-85.05, Math.min(85.05, lat));
  return R * Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360));
}
export function invMerc(x: number, y: number): [number, number] {
  return [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];
}

export const FORMATS: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

export const SCALES = [500, 1000, 2000, 2500, 5000, 10000, 25000, 50000];

export function mapFrame(l: Layout) {
  return l.mapFrame || { x: l.margins, y: l.margins, w: l.width - 2 * l.margins, h: l.height - 2 * l.margins };
}

/**
 * Rapports « mètres terrain (ellipsoïde WGS 84) / mètres Web Mercator » au voisinage d'une latitude,
 * séparément est-ouest et nord-sud : Web Mercator est calculé sur une sphère, ce qui fausse le nord-sud
 * d'environ 0,6 % sous les tropiques si on l'ignore.
 */
export function groundPerMerc(lat: number) {
  const a = 6378137;
  const e2 = 0.00669437999014;
  const phi = (lat * Math.PI) / 180;
  const s2 = Math.sin(phi) ** 2;
  const N = a / Math.sqrt(1 - e2 * s2); // rayon de courbure transverse
  const M = (a * (1 - e2)) / (1 - e2 * s2) ** 1.5; // rayon de courbure méridien
  const c = Math.cos(phi);
  return { ex: (N * c) / R, ny: (M * c) / R };
}

/**
 * Projection du cadre de carte : Web Mercator (comme le fond), avec des facteurs d'échelle est-ouest et nord-sud
 * calculés sur l'ellipsoïde au centre du cadre : les distances terrain sont exactes dans les deux directions.
 * mm papier = mètres terrain × 1000 / échelle.
 */
export function makeProjector(l: Layout) {
  const f = mapFrame(l);
  const [lon0, lat0] = l.center;
  const cx = mercX(lon0);
  const cy = mercY(lat0);
  const g = groundPerMerc(lat0);
  const kx = (g.ex * 1000) / l.scale; // mm par mètre Mercator, est-ouest
  const ky = (g.ny * 1000) / l.scale; // mm par mètre Mercator, nord-sud
  const k = kx;
  const th = ((l.bearing || 0) * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const ox = f.x + f.w / 2;
  const oy = f.y + f.h / 2;
  const project = (lon: number, lat: number): [number, number] => {
    const dx = (mercX(lon) - cx) * kx;
    const dy = (mercY(lat) - cy) * ky;
    // rotation de la carte (bearing) : le nord tourne de -bearing
    return [ox + dx * cos - dy * sin, oy - (dx * sin + dy * cos)];
  };
  const unproject = (x: number, y: number): [number, number] => {
    const rx = x - ox;
    const ry = -(y - oy);
    const dx = rx * cos + ry * sin;
    const dy = -rx * sin + ry * cos;
    return invMerc(cx + dx / kx, cy + dy / ky);
  };
  /** emprise géographique couverte par le cadre (avec marge) */
  const bounds = (pad = 0): [number, number, number, number] => {
    const pts = [
      unproject(f.x - pad, f.y - pad),
      unproject(f.x + f.w + pad, f.y - pad),
      unproject(f.x + f.w + pad, f.y + f.h + pad),
      unproject(f.x - pad, f.y + f.h + pad),
    ];
    return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  };
  /** mètres terrain représentés par 1 mm papier */
  const metersPerMm = l.scale / 1000;
  return { project, unproject, bounds, frame: f, k, kx, ky, metersPerMm };
}

/** Échelle « ronde » qui fait tenir une emprise dans le cadre. */
export function fitScale(l: Layout, bbox: [number, number, number, number]): number {
  const f = mapFrame(l);
  const lat0 = (bbox[1] + bbox[3]) / 2;
  const c = Math.cos((lat0 * Math.PI) / 180);
  const wM = (mercX(bbox[2]) - mercX(bbox[0])) * c;
  const hM = (mercY(bbox[3]) - mercY(bbox[1])) * c;
  const need = Math.max((wM * 1000) / (f.w * 0.92), (hM * 1000) / (f.h * 0.92));
  return SCALES.find((s) => s >= need) || Math.ceil(need / 10000) * 10000;
}

/** Zoom MapLibre équivalent (pixels CSS) pour une échelle donnée à une latitude (calé sur l'est-ouest). */
export function zoomForScale(scale: number, lat: number) {
  // mètres Mercator par pixel CSS au zoom z : 2πR / (512 · 2^z)
  const groundPerPx = (scale * PX_MM) / 1000; // m terrain par px CSS
  const mercPerPx = groundPerPx / groundPerMerc(lat).ex;
  return Math.log2((2 * Math.PI * R) / (512 * mercPerPx));
}

/** Allongement vertical à appliquer aux images du fond (pixels carrés en Web Mercator). */
export function verticalStretch(lat: number) {
  const g = groundPerMerc(lat);
  return g.ny / g.ex;
}
