import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { FC, GeomKind, LayerRole, LayerSource, RasterInfo, Site } from '../../types';

export interface CollectCtx {
  site: Site;
  bbox: [number, number, number, number]; // ouest, sud, est, nord (emprise + tampon)
  area: Feature<Polygon | MultiPolygon>; // emprise + tampon
  slug: string;
  log: (msg: string) => void;
  signal?: AbortSignal;
}

export interface CollectedLayer {
  id: string; // identifiant déterministe : une nouvelle collecte remplace la couche
  name: string;
  role: LayerRole;
  geom: GeomKind;
  fc?: FC;
  raster?: RasterInfo;
  source: LayerSource;
  stylePreset?: string;
  visible?: boolean;
  legendLabel?: string;
}

export interface CollectorResult {
  layers: CollectedLayer[];
  /** informations complémentaires pour le rapport (ex. statistiques) */
  notes?: string[];
  /** données ajoutées au site.json (ex. métadonnées Sentinel) */
  sitePatch?: Partial<Site>;
}

export interface Collector {
  id: string;
  label: string;
  description: string;
  run(ctx: CollectCtx): Promise<CollectorResult>;
  /** taille maximale d'emprise (km²) gérée raisonnablement */
  maxAreaKm2?: number;
  defaultOn?: boolean;
}

export function src(name: string, license: string, attribution: string, url?: string): LayerSource {
  return { name, license, attribution, url, collectedAt: new Date().toISOString() };
}

export function fc(features: any[]): FC {
  return { type: 'FeatureCollection', features };
}
