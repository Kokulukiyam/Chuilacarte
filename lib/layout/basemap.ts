'use client';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { basemapById, absUrl } from '../basemaps';
import { buildBaseStyle, sentinelForSite, splitLabels } from '../mapbase';
import type { FC, Layout, Site } from '../types';
import { heatmapSpec } from '../maplayers';
import { makeProjector, PX_MM, verticalStretch, zoomForScale } from './geo';
import { defaultSymbolScale, type BasemapTile } from './svg';

export interface BasemapRender {
  tiles: BasemapTile[];
  labelTiles?: BasemapTile[];
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

/** Multiplie une taille de texte MapLibre (nombre, fonction à paliers ou expression interpolate/step sur le zoom). */
export function scaleTextSize(v: any, k: number): any {
  if (typeof v === 'number') return v * k;
  if (v && !Array.isArray(v) && typeof v === 'object' && Array.isArray(v.stops)) return { ...v, stops: v.stops.map(([z, x]: [any, any]) => [z, scaleTextSize(x, k)]) };
  if (Array.isArray(v)) {
    if (v[0] === 'interpolate' || v[0] === 'interpolate-hcl' || v[0] === 'interpolate-lab') return [...v.slice(0, 3), ...v.slice(3).map((x, i) => (i % 2 ? scaleTextSize(x, k) : x))];
    if (v[0] === 'step') return [v[0], v[1], scaleTextSize(v[2], k), ...v.slice(3).map((x, i) => (i % 2 ? scaleTextSize(x, k) : x))];
    if (JSON.stringify(v).includes('"zoom"')) return v; // forme inconnue : laissée telle quelle
    return ['*', v, k];
  }
  return v;
}

/** Étiquettes du fond agrandies du facteur de symboles de la mise en page (grands formats regardés de plus loin). */
export function scaleLabelStyle(style: StyleSpecification, k: number): StyleSpecification {
  if (Math.abs(k - 1) < 0.01) return style;
  return {
    ...style,
    layers: style.layers.map((l: any) =>
      l.type === 'symbol' && l.layout?.['text-field'] !== undefined
        ? { ...l, layout: { ...l.layout, ...(l.layout?.['text-size'] !== undefined ? { 'text-size': scaleTextSize(l.layout['text-size'], k) } : { 'text-size': 16 * k }) }, paint: { ...l.paint, ...(typeof l.paint?.['text-halo-width'] === 'number' ? { 'text-halo-width': l.paint['text-halo-width'] * k } : {}) } }
        : l,
    ),
  };
}

/**
 * Rend le fond de carte (et les rasters du site) pour le cadre de la mise en page, par morceaux,
 * avec un rapport de pixels = dpi/96 pour que les étiquettes du fond gardent leur taille physique.
 */
export async function renderBasemap(layout: Layout, site: Site, o: { dpi: number; maxMegapixels?: number; data?: Record<string, FC>; onProgress?: (done: number, total: number) => void }): Promise<BasemapRender> {
  const { id: used, note } = exportBasemap(layout.basemap);
  const def = basemapById(used);
  const full = await siteRasterStyle(await buildBaseStyle({ basemap: used, hillshade: site.overlays?.hillshade, contours: site.overlays?.contours, sentinelUrl: sentinelForSite(site) }), site, o.data);
  // étiquettes du fond rendues à part, pour être posées au-dessus des couches du site
  const split = splitLabels(full);
  const style = split.base;
  const labelStyle = split.labels && scaleLabelStyle(split.labels, layout.symbolScale ?? defaultSymbolScale(layout));
  const pr0 = makeProjector(layout);
  const f = pr0.frame;
  const onlyBackground = style.layers.length === 1 && style.layers[0].type === 'background';
  const background = onlyBackground ? (style.layers[0] as any).paint?.['background-color'] || def.background : undefined;
  if (onlyBackground && !labelStyle) return { tiles: [], background, used, note, dpi: o.dpi };
  // résolution du fond limitée (mémoire) ; les vecteurs du site restent nets
  const areaIn2 = (f.w / 25.4) * (f.h / 25.4);
  const maxMp = o.maxMegapixels ?? 64;
  const dpi = Math.max(72, Math.min(o.dpi, Math.sqrt((maxMp * 1e6) / areaIn2)));
  const pr = dpi / 96;
  const devChunk = 2048;
  const cssChunk = Math.floor(devChunk / pr);
  const chunkMm = cssChunk * PX_MM;
  const vs = verticalStretch(layout.center[1]); // ~0,994 sous les tropiques
  const chunkMmY = chunkMm * vs;
  const rotated = Math.abs(layout.bearing || 0) > 0.01;
  const cols = rotated ? 1 : Math.ceil(f.w / chunkMm);
  const rows = rotated ? 1 : Math.ceil(f.h / chunkMmY);
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
  const labelTiles: BasemapTile[] = [];
  const jpeg = def.kind === 'raster' || def.kind === 'sentinel';
  try {
    await new Promise<void>((res) => map.once('load', () => res()));
    let n = 0;
    const passes: { style: StyleSpecification; out: BasemapTile[]; jpeg: boolean }[] = [];
    if (!onlyBackground) passes.push({ style, out: tiles, jpeg });
    if (labelStyle) passes.push({ style: labelStyle, out: labelTiles, jpeg: false });
    for (const pass of passes) {
      if (pass.style !== style || onlyBackground) {
        map.setStyle(pass.style, { diff: false });
        await new Promise<void>((res) => (map.isStyleLoaded() ? res() : map.once('style.load', () => res())));
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = rotated ? f.x : f.x + i * chunkMm;
        const y = rotated ? f.y : f.y + j * chunkMmY;
        const w = rotated ? f.w : chunkMm;
        const h = rotated ? f.h : chunkMmY;
        const c = pr0.unproject(x + w / 2, y + h / 2);
        map.jumpTo({ center: c, zoom, bearing: layout.bearing || 0 });
        await waitIdle(map);
        const href = map.getCanvas().toDataURL(pass.jpeg ? 'image/jpeg' : 'image/png', 0.9);
        pass.out.push({ href, x: rotated ? f.x + (f.w - cssW * PX_MM) / 2 : x, y: rotated ? f.y + (f.h - cssH * PX_MM * vs) / 2 : y, w: rotated ? cssW * PX_MM : w, h: rotated ? cssH * PX_MM * vs : h });
        o.onProgress?.(++n, rows * cols * passes.length);
      }
    }
  } finally {
    map.remove();
    div.remove();
  }
  return { tiles, labelTiles, background, used, note, dpi };
}
