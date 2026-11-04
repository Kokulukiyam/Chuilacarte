import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fromFile, fromUrl } from 'geotiff';
import { fetchWithTimeout } from './http';
import { CACHE_DIR, writeAtomic } from './storage';

export interface Grid {
  data: Float32Array;
  width: number;
  height: number;
  /** emprise exacte des pixels lus [ouest, sud, est, nord] */
  bbox: [number, number, number, number];
  resX: number;
  resY: number;
  nodata: number | null;
}

const tiffCache = new Map<string, Promise<any>>();

async function openTiff(src: string) {
  let p = tiffCache.get(src);
  if (!p) {
    p = (/^https?:/.test(src) ? fromUrl(src, { allowFullFile: false } as any) : fromFile(src)).catch((e: any) => {
      tiffCache.delete(src);
      throw e;
    });
    tiffCache.set(src, p);
  }
  return p;
}

/** Lit une fenêtre d'un GeoTIFF en EPSG:4326 (lecture partielle si COG distant). */
export async function readWindow(src: string, bbox: [number, number, number, number], maxPixels = 4e6): Promise<Grid> {
  const tiff = await openTiff(src);
  const img = await tiff.getImage();
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution(); // ry négatif
  const W = img.getWidth();
  const H = img.getHeight();
  let x0 = Math.floor((bbox[0] - ox) / rx);
  let x1 = Math.ceil((bbox[2] - ox) / rx);
  let y0 = Math.floor((bbox[3] - oy) / ry);
  let y1 = Math.ceil((bbox[1] - oy) / ry);
  x0 = Math.max(0, Math.min(W, x0));
  x1 = Math.max(0, Math.min(W, x1));
  y0 = Math.max(0, Math.min(H, y0));
  y1 = Math.max(0, Math.min(H, y1));
  if (x1 <= x0 || y1 <= y0) throw new Error('emprise hors de la couverture du fichier');
  if ((x1 - x0) * (y1 - y0) > maxPixels) throw new Error('emprise trop grande pour cette source');
  const ras: any = await img.readRasters({ window: [x0, y0, x1, y1], samples: [0], interleave: true });
  const data = ras instanceof Float32Array ? ras : Float32Array.from(ras as ArrayLike<number>);
  const nd = img.getGDALNoData();
  return {
    data,
    width: x1 - x0,
    height: y1 - y0,
    bbox: [ox + x0 * rx, oy + y1 * ry, ox + x1 * rx, oy + y0 * ry],
    resX: rx,
    resY: -ry,
    nodata: nd === null || nd === undefined ? null : Number(nd),
  };
}

/** Télécharge un fichier une seule fois dans le cache global. */
export async function cachedDownload(url: string, name: string, timeout = 300000): Promise<string> {
  const file = path.join(CACHE_DIR, 'files', name);
  try {
    const st = await fs.stat(file);
    if (st.size > 0) return file;
  } catch {
    /* absent */
  }
  const r = await fetchWithTimeout(url, { timeout });
  if (!r.ok) throw new Error(`téléchargement ${name} : HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeAtomic(file, buf);
  return file;
}

/** Valeur interpolée (bilinéaire) en un point lon/lat. */
export function sample(g: Grid, lon: number, lat: number): number | null {
  const fx = (lon - g.bbox[0]) / g.resX - 0.5;
  const fy = (g.bbox[3] - lat) / g.resY - 0.5;
  const x = Math.max(0, Math.min(g.width - 1, fx));
  const y = Math.max(0, Math.min(g.height - 1, fy));
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xj = Math.min(g.width - 1, xi + 1);
  const yj = Math.min(g.height - 1, yi + 1);
  const v = (i: number, j: number) => {
    const val = g.data[j * g.width + i];
    return g.nodata !== null && val === g.nodata ? NaN : val;
  };
  const tx = x - xi;
  const ty = y - yi;
  const r = v(xi, yi) * (1 - tx) * (1 - ty) + v(xj, yi) * tx * (1 - ty) + v(xi, yj) * (1 - tx) * ty + v(xj, yj) * tx * ty;
  return Number.isFinite(r) ? r : null;
}
