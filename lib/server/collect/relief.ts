import 'server-only';
import { contours as d3contours } from 'd3-contour';
import type { Position } from 'geojson';
import { readWindow, type Grid } from '../raster';
import { fc, src, type Collector } from './types';

export const COP_ATTR =
  'Relief : Copernicus WorldDEM-30 © DLR e.V. 2010-2014 et © Airbus Defence and Space GmbH 2014-2018, fourni dans le cadre de COPERNICUS par l’Union européenne et l’ESA';

function copTile(lat: number, lon: number) {
  const la = Math.floor(lat);
  const lo = Math.floor(lon);
  const ns = la >= 0 ? `N${String(la).padStart(2, '0')}` : `S${String(-la).padStart(2, '0')}`;
  const ew = lo >= 0 ? `E${String(lo).padStart(3, '0')}` : `W${String(-lo).padStart(3, '0')}`;
  const n = `Copernicus_DSM_COG_10_${ns}_00_${ew}_00_DEM`;
  return `https://copernicus-dem-30m.s3.amazonaws.com/${n}/${n}.tif`;
}

/** MNS Copernicus GLO-30 sur une emprise (plusieurs tuiles de 1° si nécessaire, assemblées). */
export async function readDem(bbox: [number, number, number, number]): Promise<Grid> {
  const tiles: [number, number][] = [];
  for (let la = Math.floor(bbox[1]); la <= Math.floor(bbox[3]); la++) for (let lo = Math.floor(bbox[0]); lo <= Math.floor(bbox[2]); lo++) tiles.push([la, lo]);
  if (tiles.length === 1) return readWindow(copTile(tiles[0][0], tiles[0][1]), bbox);
  // assemblage simple sur une grille commune à 1"
  const res = 1 / 3600;
  const W = Math.ceil((bbox[2] - bbox[0]) / res);
  const H = Math.ceil((bbox[3] - bbox[1]) / res);
  const data = new Float32Array(W * H).fill(NaN);
  for (const [la, lo] of tiles) {
    const sub: [number, number, number, number] = [Math.max(bbox[0], lo), Math.max(bbox[1], la), Math.min(bbox[2], lo + 1), Math.min(bbox[3], la + 1)];
    let g: Grid;
    try {
      g = await readWindow(copTile(la, lo), sub);
    } catch {
      continue; // pas de tuile (mer)
    }
    for (let y = 0; y < g.height; y++)
      for (let x = 0; x < g.width; x++) {
        const lon = g.bbox[0] + (x + 0.5) * g.resX;
        const lat = g.bbox[3] - (y + 0.5) * g.resY;
        const X = Math.floor((lon - bbox[0]) / res);
        const Y = Math.floor((bbox[3] - lat) / res);
        if (X >= 0 && X < W && Y >= 0 && Y < H) data[Y * W + X] = g.data[y * g.width + x];
      }
  }
  return { data, width: W, height: H, bbox, resX: res, resY: res, nodata: null };
}

export function demStats(g: Grid) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let n = 0;
  for (const v of g.data) {
    if (!Number.isFinite(v) || (g.nodata !== null && v === g.nodata)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    n++;
  }
  return { min, max, mean: n ? sum / n : NaN };
}

export function contourInterval(range: number) {
  if (range <= 12) return 1;
  if (range <= 30) return 2;
  if (range <= 80) return 5;
  if (range <= 200) return 10;
  return 20;
}

function chaikin(line: Position[]): Position[] {
  if (line.length < 3) return line;
  const out: Position[] = [line[0]];
  for (let i = 0; i < line.length - 1; i++) {
    const [a, b] = [line[i], line[i + 1]];
    out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
  }
  out.push(line[line.length - 1]);
  return out;
}

/** Isolignes à partir d'une grille (d3-contour donne des polygones : on retire les bords de grille). */
export function isolines(g: Grid, interval: number) {
  const vals = Array.from(g.data, (v) => (Number.isFinite(v) && (g.nodata === null || v !== g.nodata) ? v : -9999));
  const st = demStats(g);
  const levels: number[] = [];
  for (let v = Math.ceil(st.min / interval) * interval; v <= st.max; v += interval) levels.push(v);
  const gen = d3contours().size([g.width, g.height]).thresholds(levels);
  const feats: any[] = [];
  const toLL = (p: number[]): Position => [g.bbox[0] + p[0] * g.resX, g.bbox[3] - p[1] * g.resY];
  const onEdge = (p: number[]) => p[0] <= 0.5 || p[1] <= 0.5 || p[0] >= g.width - 0.5 || p[1] >= g.height - 0.5;
  for (const c of gen(vals)) {
    const lines: Position[][] = [];
    for (const poly of c.coordinates)
      for (const ring of poly) {
        let cur: Position[] = [];
        for (const p of ring) {
          if (onEdge(p)) {
            if (cur.length > 1) lines.push(cur);
            cur = [];
          } else cur.push(toLL(p));
        }
        if (cur.length > 1) lines.push(cur);
      }
    const smooth = lines.filter((l) => l.length >= 3).map(chaikin);
    if (!smooth.length) continue;
    feats.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: smooth },
      properties: { altitude: c.value, maitresse: c.value % (interval * 5) === 0 ? 'oui' : 'non' },
    });
  }
  return feats;
}

export const reliefCollector: Collector = {
  id: 'relief',
  label: 'Relief (Copernicus DEM GLO-30)',
  description: 'Courbes de niveau et statistiques d’altitude ; ombrage via les tuiles de relief',
  defaultOn: true,
  async run(ctx) {
    ctx.log('Relief : lecture du MNS Copernicus');
    const g = await readDem(ctx.bbox);
    const st = demStats(g);
    if (!Number.isFinite(st.min)) throw new Error('aucune altitude disponible (zone en mer ?)');
    const interval = contourInterval(st.max - st.min);
    const feats = isolines(g, interval);
    return {
      layers: [
        {
          id: 'relief-courbes',
          name: `Courbes de niveau (${interval} m)`,
          role: 'contours',
          geom: 'line',
          fc: fc(feats),
          source: src('Copernicus DEM GLO-30 (MNS)', 'Licence Copernicus DEM (libre, attribution obligatoire)', COP_ATTR, 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model'),
          stylePreset: 'courbes',
          visible: true,
        },
      ],
      notes: [`Altitude : min ${st.min.toFixed(1)} m, max ${st.max.toFixed(1)} m, moyenne ${st.mean.toFixed(1)} m (modèle de surface : inclut bâti et végétation)`],
    };
  },
};
