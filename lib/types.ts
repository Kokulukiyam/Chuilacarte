import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

export type GeomKind = 'polygon' | 'line' | 'point' | 'mixed';
export type HatchKind = 'none' | 'diag' | 'diag-rev' | 'cross' | 'horiz' | 'vert' | 'dots';
export type PointShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'cross';

export interface LabelStyle {
  field: string;
  size: number;
  color: string;
  halo: string;
  weight: 'regular' | 'bold';
}

export interface CategoryClass {
  value: string;
  color: string;
  label?: string;
}

export interface GradClass {
  min: number;
  max: number;
  color: string;
}

export interface LayerStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  dash: 'solid' | 'dash' | 'dot';
  hatch: HatchKind;
  hatchColor: string;
  pointSize: number;
  pointShape: PointShape;
  label: LabelStyle | null;
  mode: 'simple' | 'categorized' | 'graduated' | 'heatmap';
  heatmap?: { radius: number; intensity: number };
  categorized?: { field: string; classes: CategoryClass[]; other: string };
  graduated?: { field: string; method: 'equal' | 'quantile'; ramp: string; classes: GradClass[] };
  /** nom du style prédéfini d'origine, informatif */
  preset?: string;
}

export type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'exists';
export interface FilterRule {
  field: string;
  op: FilterOp;
  value: string;
}

export interface LayerSource {
  name: string;
  license: string;
  attribution: string;
  url?: string;
  collectedAt: string;
}

export type LayerRole =
  | 'buildings'
  | 'roads'
  | 'railways'
  | 'water'
  | 'landuse'
  | 'green'
  | 'amenities'
  | 'pois'
  | 'admin'
  | 'population'
  | 'contours'
  | 'annotations'
  | 'project'
  | 'analysis'
  | 'imported'
  | 'raster'
  | 'perimeter'
  | 'buffer'
  | 'shadow';

export interface RasterInfo {
  type: 'image' | 'tiles';
  /** image : chemin relatif dans le dossier du site ; tiles : gabarit d'URL */
  url: string;
  /** image : [ouest, sud, est, nord] ou 4 coins [[lon,lat] x4] (HG, HD, BD, BG) */
  bounds?: [number, number, number, number];
  corners?: [[number, number], [number, number], [number, number], [number, number]];
  tileSize?: number;
  maxzoom?: number;
  date?: string;
  legend?: { color: string; label: string }[];
}

/** Paramètres de calage d'un plan (DXF ou image) : similitude locale (m) → UTM */
export interface Placement {
  /** point d'ancrage sur la carte [lon, lat] : position de l'origine locale */
  anchor: [number, number];
  /** rotation en degrés, sens trigonométrique */
  rotation: number;
  /** facteur d'échelle (1 = unités locales déjà en mètres) */
  scale: number;
  /** unité du dessin d'origine */
  units: 'm' | 'cm' | 'mm' | 'px';
  /** pour les images : taille en pixels */
  imageSize?: [number, number];
}

export interface Layer {
  id: string;
  name: string;
  kind: 'vector' | 'raster';
  geom: GeomKind;
  role: LayerRole;
  visible: boolean;
  opacity: number;
  source: LayerSource;
  style: LayerStyle;
  filter: FilterRule[];
  count?: number;
  raster?: RasterInfo;
  /** couche calée (plan de projet, image) */
  placement?: Placement;
  /** hauteur du projet (m) ou niveaux, pour 3D / calculs */
  project?: { levels: number; levelHeight: number; parcel?: import('geojson').Polygon | import('geojson').MultiPolygon; parcelName?: string };
  /** afficher dans la légende des mises en page */
  legend?: boolean;
  legendLabel?: string;
}

export interface LayoutElement {
  id: string;
  type: 'title' | 'subtitle' | 'legend' | 'scalebar' | 'north' | 'cartouche' | 'inset' | 'text' | 'logo';
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, any>;
}

export interface Layout {
  id: string;
  name: string;
  format: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'custom';
  orientation: 'portrait' | 'landscape';
  width: number; // mm
  height: number; // mm
  margins: number; // mm
  scale: number; // dénominateur
  center: [number, number];
  bearing: number;
  basemap: string;
  font: string;
  /** facteur appliqué aux épaisseurs, symboles et étiquettes de la carte (grands formats vus de plus loin) */
  symbolScale?: number;
  elements: LayoutElement[];
  /** cadre de carte, en mm ; par défaut toute la page moins les marges */
  mapFrame?: { x: number; y: number; w: number; h: number };
}

export interface CollectReportItem {
  source: string;
  layer?: string;
  count: number;
  ok: boolean;
  error?: string;
  ms?: number;
}

export interface CollectReport {
  date: string;
  items: CollectReportItem[];
}

export interface MarkerLegendEntry {
  number: number;
  text: string;
}

export interface Site {
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  emprise: Feature<Polygon | MultiPolygon>;
  buffer: number; // m
  utm: { zone: number; epsg: number; south: boolean };
  center: [number, number];
  basemap: string;
  overlays?: { hillshade?: boolean; contours?: boolean };
  view?: { center: [number, number]; zoom: number; bearing: number; pitch: number };
  layers: Layer[]; // index 0 = dessus
  layouts: Layout[];
  reports: CollectReport[];
  settings: { defaultHeight: number; levelHeight: number; theme?: 'light' | 'dark' };
  sentinel?: { date: string; item: string; cloud: number; file: string }[];
  description?: string;
}

export interface SiteSummary {
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  center: [number, number];
  layerCount: number;
  hasThumbnail: boolean;
  buffer: number;
}

export type FC = FeatureCollection<Geometry, Record<string, any>>;
