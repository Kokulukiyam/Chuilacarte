/** Sources de tuiles raster relayées et mises en cache par /api/tiles (politesse envers les serveurs + export sans souci CORS). */
export interface TileSourceDef {
  url: string;
  attribution: string;
  maxzoom: number;
  ext: 'png' | 'jpg';
  tileSize?: number;
  /** pas de cache disque (conditions du fournisseur) */
  noCache?: boolean;
  /** variable d'environnement requise ; ajoutée à l'URL à la place de {key} */
  keyEnv?: string;
  /** variable d'environnement qui doit valoir true */
  flagEnv?: string;
}

export const TILE_SOURCES: Record<string, TileSourceDef> = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© les contributeurs d’OpenStreetMap',
    maxzoom: 19,
    ext: 'png',
  },
  esri: {
    url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token={key}',
    attribution: 'Powered by Esri — Source : Esri, Vantor, Earthstar Geographics et la communauté des utilisateurs SIG',
    maxzoom: 19,
    ext: 'jpg',
    noCache: true,
    keyEnv: 'ARCGIS_API_KEY',
  },
  eox: {
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
    attribution: 'EOxCloudless 2024 https://cloudless.eox.at par EOX IT Services GmbH (contient des données Copernicus Sentinel modifiées 2024) — usage non commercial',
    maxzoom: 17,
    ext: 'jpg',
    flagEnv: 'ENABLE_NONCOMMERCIAL_SOURCES',
  },
  terrarium: {
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    attribution: 'Relief : Mapzen Terrain Tiles (SRTM, NASA ; ETOPO1, NOAA ; autres)',
    maxzoom: 15,
    ext: 'png',
  },
  'gsw-occurrence': {
    url: 'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png',
    attribution: 'Eau : EC JRC/Google, Global Surface Water (Pekel et al., 2016)',
    maxzoom: 13,
    ext: 'png',
  },
  'gsw2024-occurrence': {
    url: 'https://storage.googleapis.com/water-world/tiles2024/occurrence/{z}/{x}/{y}.png',
    attribution: 'Eau : EC JRC/Google, Global Surface Water (Pekel et al., 2016)',
    maxzoom: 13,
    ext: 'png',
  },
  'gsw-change': {
    url: 'https://storage.googleapis.com/global-surface-water/tiles2021/change/{z}/{x}/{y}.png',
    attribution: 'Eau : EC JRC/Google, Global Surface Water (Pekel et al., 2016)',
    maxzoom: 13,
    ext: 'png',
  },
  'gsw-seasonality': {
    url: 'https://storage.googleapis.com/global-surface-water/tiles2021/seasonality/{z}/{x}/{y}.png',
    attribution: 'Eau : EC JRC/Google, Global Surface Water (Pekel et al., 2016)',
    maxzoom: 13,
    ext: 'png',
  },
};
