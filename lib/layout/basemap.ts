'use client';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { basemapById, absUrl } from '../basemaps';
import { buildBaseStyle, sentinelForSite } from '../mapbase';
import type { FC, Layout, Site } from '../types';
import { heatmapSpec } from '../maplayers';
import { makeProjector, PX_MM, zoomForScale } from './geo';
import type { BasemapTile } from './svg';

export interface BasemapRender {
  tiles: BasemapTile[];
  background?: string;
  used: string;
  note?: string;
  dpi: number;
}

/** Fond réellement utilisé pour un export (les fonds réservés à l'écran sont remplacés). */
export function exportBasemap(id: string): { id: string; note?: string } {
  const d = basemapById(id);
  if (d.screenOnly) return { id: 'couleur', note: 'Le fond OSM standard est réservé à l’affichage à l’écran (politique des tuiles OSM) : l’export utilise le fond vectoriel OpenFreeMap.' };
  return { id };
}

async function siteRasterStyle(style: StyleSpecification, site: Site, data?: Record<string, FC>) {
  // couches raster visibles du site (images Sentinel-2, occupation du sol, eau, plans calés…), du bas vers le haut
  for (const l of [...site.layers].reverse()) {
    if (!l.visible || l.kind !== 'raster' || !l.raster) continue;
    const r = l.raster;
    const id = `x-${l.id}`;
    if (r.type === 'image') {
      const url = absUrl(r.url.startsWith('files/') ? `/api/sites/${site.slug}/${r.url}` : r.url);
      const coords = r.corners || [
        [r.bounds![0], r.bounds![3]],
        [r.bounds![2], r.bounds![3]],
        [r.bounds![2], r.bounds![1]],
        [r.bounds![0], r.bounds![1]],
      ];
      style.sources[id] = { type: 'image', url, coordinates: coords } as any;
    } else style.sources[id] = { type: 'raster', tiles: [absUrl(r.url)], tileSize: r.tileSize || 256, maxzoom: r.maxzoom || 18 } as any;
    style.layers.push({ id, type: 'raster', source: id, paint: { 'raster-opacity': l.opacity, 'raster-fade-duration': 0 } });
  }
  // cartes de chaleur (non vectorisables) : rendues avec le fond
  for (const l of [...site.layers].reverse()) {
    if (!l.visible || l.kind !== 'vector' || l.style.mode !== 'heatmap' || !data?.[l.id]) continue;
    const id = `x-${l.id}`;
    style.sources[id] = { type: 'geojson', data: data[l.id] } as any;
    style.layers.push(heatmapSpec(l, 'visible', l.opacity, id));
  }
  return style;
}

function waitIdle(map: maplibregl.Map, timeout = 45000) {
  return new Promise<void>((res) => {
    let done = false;
    const t = setTimeout(() => {
      done = true;
      res();
    }, timeout);
    const check = () => {
      if (done) return;
      if (map.loaded() && map.areTilesLoaded()) {
        done = true;
        clearTimeout(t);
        // une image de plus pour être sûr que tout est dessiné
        requestAnimationFrame(() => requestAnimationFrame(() => res()));
      } else map.once('idle', check);
    };
    map.once('idle', check);
    map.triggerRepaint();
  });
}

/**
 * Rend le fond de carte (et les rasters du site) pour le cadre de la mise en page, par morceaux,
 * avec un rapport de pixels = dpi/96 pour que les étiquettes du fond gardent leur taille physique.
 */
export async function renderBasemap(layout: Layout, site: Site, o: { dpi: number; maxMegapixels?: number; data?: Record<string, FC>; onProgress?: (done: number, total: number) => void }): Promise<BasemapRender> {
  const { id: used, note } = exportBasemap(layout.basemap);
  const def = basemapById(used);
  const style = await siteRasterStyle(await buildBaseStyle({ basemap: used, hillshade: site.overlays?.hillshade, contours: site.overlays?.contours, sentinelUrl: sentinelForSite(site) }), site, o.data);
  const pr0 = makeProjector(layout);
  const f = pr0.frame;
  const onlyBackground = style.layers.length === 1 && style.layers[0].type === 'background';
  if (onlyBackground) return { tiles: [], background: (style.layers[0] as any).paint?.['background-color'] || def.background, used, note, dpi: o.dpi };
  // résolution du fond limitée (mémoire) ; les vecteurs du site restent nets
  const areaIn2 = (f.w / 25.4) * (f.h / 25.4);
  const maxMp = o.maxMegapixels ?? 64;
  const dpi = Math.max(72, Math.min(o.dpi, Math.sqrt((maxMp * 1e6) / areaIn2)));
  const pr = dpi / 96;
  const devChunk = 2048;
  const cssChunk = Math.floor(devChunk / pr);
  const chunkMm = cssChunk * PX_MM;
  const rotated = Math.abs(layout.bearing || 0) > 0.01;
  const cols = rotated ? 1 : Math.ceil(f.w / chunkMm);
  const rows = rotated ? 1 : Math.ceil(f.h / chunkMm);
  const cssW = rotated ? Math.ceil(f.w / PX_MM) : cssChunk;
  const cssH = rotated ? Math.ceil(f.h / PX_MM) : cssChunk;
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;left:-${cssW + 100}px;top:0;width:${cssW}px;height:${cssH}px;visibility:hidden;pointer-events:none`;
  document.body.appendChild(div);
  const zoom = zoomForScale(layout.scale, layout.center[1]);
  const map = new maplibregl.Map({
    container: div,
    style,
    center: layout.center,
    zoom,
    bearing: layout.bearing || 0,
    pixelRatio: rotated ? Math.min(pr, 4096 / Math.max(cssW, cssH)) : pr,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
  } as any);
  map.on('error', () => {
    /* une tuile manquante ne doit pas bloquer l'export */
  });
  const tiles: BasemapTile[] = [];
  const jpeg = def.kind === 'raster' || def.kind === 'sentinel';
  try {
    await new Promise<void>((res) => map.once('load', () => res()));
    let n = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = rotated ? f.x : f.x + i * chunkMm;
        const y = rotated ? f.y : f.y + j * chunkMm;
        const w = rotated ? f.w : chunkMm;
        const h = rotated ? f.h : chunkMm;
        const c = pr0.unproject(x + w / 2, y + h / 2);
        map.jumpTo({ center: c, zoom, bearing: layout.bearing || 0 });
        await waitIdle(map);
        const href = map.getCanvas().toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9);
        tiles.push({ href, x, y, w: rotated ? cssW * PX_MM : w, h: rotated ? cssH * PX_MM : h });
        o.onProgress?.(++n, rows * cols);
      }
  } finally {
    map.remove();
    div.remove();
  }
  return { tiles, used, note, dpi };
}
