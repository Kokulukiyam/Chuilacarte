import type { StyleSpecification } from 'maplibre-gl';

export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];

export interface BasemapDef {
  id: string;
  label: string;
  /** 'vector' : style distant ; 'raster' : tuiles relayées ; 'plain' : fond uni */
  kind: 'vector' | 'raster' | 'plain' | 'sentinel' | 'relief';
  styleUrl?: string;
  tiles?: string;
  background?: string;
  attribution: string;
  dark?: boolean;
  /** URL XYZ publique, utilisée par l'export QGIS */
  xyz?: string;
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'clair',
    label: 'Vectoriel clair',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: 'OpenFreeMap © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'couleur',
    label: 'Vectoriel couleur',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
    xyz: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'sombre',
    label: 'Vectoriel sombre',
    kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/dark',
    attribution: 'OpenFreeMap © OpenMapTiles, données © les contributeurs d’OpenStreetMap',
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
  },
  {
    id: 'satellite',
    label: 'Satellite (Esri)',
    kind: 'raster',
    tiles: '/api/tiles/esri/{z}/{x}/{y}.jpg',
    attribution: 'Imagerie : Esri, Maxar, Earthstar Geographics et la communauté des utilisateurs SIG',
    xyz: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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
    attribution: 'Relief : Mapzen Terrain Tiles (SRTM, NASA)',
    xyz: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
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
