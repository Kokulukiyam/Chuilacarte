import 'server-only';
import { osmCollector } from './osm';
import { overtureCollector } from './overture';
import { openBuildingsCollector } from './openbuildings';
import { adminCollector } from './admin';
import { reliefCollector } from './relief';
import { worldpopCollector, worldcoverCollector, waterCollector, sentinelCollector } from './rasters';
import type { Collector } from './types';

export const COLLECTORS: Collector[] = [
  osmCollector,
  overtureCollector,
  openBuildingsCollector,
  adminCollector,
  reliefCollector,
  worldpopCollector,
  worldcoverCollector,
  waterCollector,
  sentinelCollector,
];
