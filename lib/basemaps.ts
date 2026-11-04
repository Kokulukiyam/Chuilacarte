import type { StyleSpecification } from 'maplibre-gl';

export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];

export interface BasemapDef {
  id: string;
  label: string;
  /** 'vector' : style distant ; 'raster' : tuiles relayées ; 'plain' : fond uni */
  kind: 'vector' | 'raster' | 'plain' | 'sentinel' | 'relief' | 'labels';
  styleUrl?: string;
  tiles?: string;
  background?: string;
  attribution: string;
  dark?: boolean;
  /** URL XYZ publique, utilisée par l'export QGIS */
  xyz?: string;
  /** option requise (clé ou réglage dans .env.local) */
  requires?: 'arcgis' | 'noncommercial';
  /** fond réservé à l'écran : remplacé par un fond OpenFreeMap dans les exports */
  screenOnly?: boolean;
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'clair',
    label: 'Vectoriel clair',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: '© OpenFreeMap, © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'couleur',
    label: 'Vectoriel couleur',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '© OpenFreeMap, © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'sombre',
    label: 'Vectoriel sombre',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/dark',
    attribution: '© OpenFreeMap, © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    dark: true,
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'osm',
    label: 'OSM standard',
    kind: 'raster',
    tiles: '/api/tiles/osm/{z}/{x}/{y}.png',
    attribution: '© les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    screenOnly: true,
  },
  {
    id: 'satellite',
    label: 'Satellite haute résolution (Esri)',
    kind: 'raster',
    tiles: '/api/tiles/esri/{z}/{x}/{y}.jpg',
    attribution: 'Powered by Esri — Source : Esri, Vantor, Earthstar Geographics et la communauté des utilisateurs SIG',
    requires: 'arcgis',
  },
  {
    id: 'eox',
    label: 'Mosaïque Sentinel-2 sans nuages (EOx, non commercial)',
    kind: 'raster',
    tiles: '/api/tiles/eox/{z}/{x}/{y}.jpg',
    attribution: 'EOxCloudless 2024 https://cloudless.eox.at par EOX IT Services GmbH (contient des données Copernicus Sentinel modifiées 2024) — usage non commercial',
    requires: 'noncommercial',
    xyz: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
  },
  {
    id: 'sentinel',
    label: 'Image Sentinel-2 du site',
    kind: 'sentinel',
    background: '#e7e5e4',
    attribution: 'Contient des données Copernicus Sentinel modifiées, via Microsoft Planetary Computer',
  },
  {
    id: 'relief',
    label: 'Relief (ombrage et courbes)',
    kind: 'relief',
    background: '#f6f4ef',
    attribution: 'Relief : Terrain Tiles (Mapzen/Tilezen, AWS Open Data) — SRTM : USGS ; ETOPO1 : NOAA',
    xyz: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  },
  {
    id: 'papier-noms',
    label: 'Papier + noms de rues',
    kind: 'labels',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    background: '#f7f5f0',
    attribution: '© OpenFreeMap, © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'papier',
    label: 'Papier (fond uni)',
    kind: 'plain',
    background: '#f7f5f0',
    attribution: '',
  },
  {
    id: 'blanc',
    label: 'Blanc',
    kind: 'plain',
    background: '#ffffff',
    attribution: '',
  },
];

export function basemapById(id: string): BasemapDef {
  return BASEMAPS.find((b) => b.id === id) || BASEMAPS[0];
}

export function absUrl(u: string) {
  if (typeof window === 'undefined' || /^https?:/.test(u)) return u;
  return `${window.location.origin}${u}`;
}

/** Style MapLibre de base (sans les couches du site), pour les fonds non vectoriels. */
export function plainStyle(bg: string): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {},
    layers: [{ id: 'bm-background', type: 'background', paint: { 'background-color': bg } }],
  };
}

export function rasterStyle(tiles: string, attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      'bm-raster': { type: 'raster', tiles: [absUrl(tiles)], tileSize: 256, attribution, maxzoom },
    },
    layers: [
      { id: 'bm-background', type: 'background', paint: { 'background-color': '#ddd' } },
      { id: 'bm-raster', type: 'raster', source: 'bm-raster' },
    ],
  };
}
