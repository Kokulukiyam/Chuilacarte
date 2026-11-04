'use client';
import maplibregl, { type Map as MlMap, type StyleSpecification } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { BASEMAPS, GLYPHS, absUrl, basemapById, plainStyle, rasterStyle, FONT_REGULAR } from './basemaps';
import type { Site } from './types';

let demSource: any = null;
export function getDemSource() {
  if (!demSource) {
    demSource = new (mlcontour as any).DemSource({
      url: absUrl('/api/tiles/terrarium/{z}/{x}/{y}.png'),
      encoding: 'terrarium',
      maxzoom: 14,
      worker: false,
      cacheSize: 200,
    });
    demSource.setupMaplibre(maplibregl);
  }
  return demSource;
}

const styleCache = new Map<string, Promise<StyleSpecification>>();
/**
 * Nettoie les styles OpenFreeMap : retire les cartouches de routes (codes US, sans objet au Sénégal) et
 * rend sûres les comparaisons numériques sur des attributs parfois absents (`rank`, `admin_level`…),
 * qui produisent sinon l'avertissement « Expected value to be of type number, but found null ».
 */
export function sanitizeStyle(style: StyleSpecification): StyleSpecification {
  const fix = (e: any): any => {
    if (!Array.isArray(e)) return e;
    if (['<', '<=', '>', '>='].includes(e[0]) && e.length >= 3) return [e[0], ...e.slice(1).map((a: any) => (Array.isArray(a) && a[0] === 'get' ? ['to-number', a, -1e9] : fix(a)))];
    return e.map(fix);
  };
  style.layers = style.layers.filter((l) => !/shield/i.test(l.id)).map((l: any) => (l.filter ? { ...l, filter: fix(l.filter) } : l));
  return style;
}

async function fetchStyle(url: string): Promise<StyleSpecification> {
  let p = styleCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json();
      })
      .then(sanitizeStyle)
      .catch((e) => {
        styleCache.delete(url);
        throw e;
      });
    styleCache.set(url, p);
  }
  return structuredClone(await p);
}

export interface BaseOptions {
  basemap: string;
  hillshade?: boolean;
  contours?: boolean;
  sentinelUrl?: { url: string; bounds: [number, number, number, number] } | null;
  /** masquer les étiquettes du fond vectoriel (rendus) */
  noLabels?: boolean;
}

/** Construit le style du fond de carte (sans les couches du site). */
export async function buildBaseStyle(o: BaseOptions): Promise<StyleSpecification> {
  const def = basemapById(o.basemap);
  let style: StyleSpecification;
  if (def.kind === 'vector' || def.kind === 'labels') {
    try {
      style = await fetchStyle(def.styleUrl!);
      style.glyphs = style.glyphs || GLYPHS;
      if (o.noLabels) style.layers = style.layers.filter((l) => l.type !== 'symbol');
      if (def.kind === 'labels') {
        // fond papier : la mer et les noms (rues, quartiers, lieux), sans dessin de voirie ni de bâti
        // halo couleur papier marqué et texte foncé : les noms restent lisibles sur le bâti et les voies du site
        const names = style.layers
          .filter((l) => l.type === 'symbol' && !/shield|oneway|poi/i.test(l.id))
          .map((l: any) => ({ ...l, paint: { ...l.paint, 'text-color': /highway|road|transportation/i.test(l.id) ? '#27272a' : l.paint?.['text-color'] ?? '#3f3f46', 'text-halo-color': def.background!, 'text-halo-width': 1.6, 'text-halo-blur': 0.2 } }));
        // la mer et les plans d'eau du fond, en bleu très pâle (sans trait), pour lire le trait de côte
        const water = style.layers.filter((l: any) => l.type === 'fill' && l['source-layer'] === 'water').map((l: any) => ({ ...l, paint: { 'fill-color': '#dce9f1', 'fill-antialias': true } }));
        style.layers = [{ id: 'bm-background', type: 'background', paint: { 'background-color': def.background! } }, ...water, ...names];
      }
    } catch {
      // hors ligne : fond uni
      style = plainStyle(def.dark ? '#18181b' : def.background || '#f4f4f5');
    }
  } else if (def.kind === 'raster') {
    style = rasterStyle(def.tiles!, def.attribution);
  } else if (def.kind === 'sentinel') {
    style = plainStyle(def.background!);
    if (o.sentinelUrl) {
      const b = o.sentinelUrl.bounds;
      style.sources['bm-sentinel'] = {
        type: 'image',
        url: absUrl(o.sentinelUrl.url),
        coordinates: [
          [b[0], b[3]],
          [b[2], b[3]],
          [b[2], b[1]],
          [b[0], b[1]],
        ],
      } as any;
      style.layers.push({ id: 'bm-sentinel', type: 'raster', source: 'bm-sentinel', paint: { 'raster-fade-duration': 0 } });
    }
  } else {
    style = plainStyle(def.background || '#f7f5f0');
  }
  const wantHill = o.hillshade || def.kind === 'relief';
  const wantContours = o.contours || def.kind === 'relief';
  if (wantHill || wantContours) {
    const dem = getDemSource();
    if (wantHill) {
      style.sources['relief-dem'] = { type: 'raster-dem', encoding: 'terrarium', tiles: [dem.sharedDemProtocolUrl], tileSize: 256, maxzoom: 14 } as any;
      style.layers.push({
        id: 'relief-hillshade',
        type: 'hillshade',
        source: 'relief-dem',
        paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#5b5345', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#8a7f6b' },
      });
    }
    if (wantContours) {
      style.sources['relief-contours'] = {
        type: 'vector',
        tiles: [
          dem.contourProtocolUrl({
            multiplier: 1,
            thresholds: { 11: [20, 100], 12: [10, 50], 13: [5, 25], 14: [2, 10], 15: [1, 5], 16: [1, 5] },
            elevationKey: 'ele',
            levelKey: 'level',
            contourLayer: 'contours',
          }),
        ],
        maxzoom: 16,
      } as any;
      style.layers.push(
        {
          id: 'relief-contour-lines',
          type: 'line',
          source: 'relief-contours',
          'source-layer': 'contours',
          paint: { 'line-color': '#9a7b4f', 'line-opacity': 0.55, 'line-width': ['match', ['get', 'level'], 1, 1.1, 0.5] },
        } as any,
        {
          id: 'relief-contour-labels',
          type: 'symbol',
          source: 'relief-contours',
          'source-layer': 'contours',
          filter: ['>', ['get', 'level'], 0],
          layout: { 'symbol-placement': 'line', 'text-size': 10, 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'], 'text-font': FONT_REGULAR },
          paint: { 'text-color': '#7c6440', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
        } as any,
      );
    }
  }
  return style;
}

export function sentinelForSite(site: Site): BaseOptions['sentinelUrl'] {
  const l = site.layers.find((x) => x.raster?.type === 'image' && x.source.name.startsWith('Sentinel-2') && x.raster.bounds);
  if (!l) return null;
  return { url: `/api/sites/${site.slug}/${l.raster!.url}`, bounds: l.raster!.bounds! };
}

/** Sépare un style en « fond sans étiquettes » et « étiquettes seules » (fond transparent). */
export function splitLabels(style: StyleSpecification): { base: StyleSpecification; labels: StyleSpecification | null } {
  const sym = style.layers.filter((l) => l.type === 'symbol' && !String(l.id).startsWith('x-'));
  if (!sym.length) return { base: style, labels: null };
  const base = { ...style, layers: style.layers.filter((l) => !sym.includes(l)) };
  const used = new Set(sym.map((l: any) => l.source));
  const labels = { ...style, sources: Object.fromEntries(Object.entries(style.sources).filter(([k]) => used.has(k))), layers: sym };
  return { base, labels };
}

export function attributionFor(basemap: string) {
  return basemapById(basemap).attribution;
}

export { BASEMAPS };

export function createMap(container: HTMLElement, opts: Partial<maplibregl.MapOptions> = {}): MlMap {
  return new maplibregl.Map({
    container,
    style: plainStyle('#f4f4f5'),
    center: [-17.45, 14.69],
    zoom: 11,
    attributionControl: { compact: false },
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    maxPitch: 75,
    // Maj + clic sert à la sélection multiple (fusion) : pas de zoom par boîte
    boxZoom: false,
    ...opts,
  } as any);
}
