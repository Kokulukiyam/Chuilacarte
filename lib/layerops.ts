'use client';
import { useStore } from './store';
import { makeLayer } from './site';
import { cloneStyle, presetById } from './styles';
import type { FC, Layer, LayerRole } from './types';

/** Rang d'empilement par rôle (0 = dessus). */
const ROLE_RANK: Record<LayerRole, number> = {
  annotations: 0,
  project: 1,
  analysis: 2,
  perimeter: 3,
  buffer: 4,
  amenities: 5,
  pois: 6,
  contours: 7,
  railways: 8,
  roads: 9,
  buildings: 10,
  imported: 11,
  admin: 12,
  water: 13,
  green: 14,
  landuse: 15,
  population: 16,
  raster: 17,
};

export function insertIndex(layers: Layer[], role: LayerRole): number {
  const r = ROLE_RANK[role] ?? 11;
  const i = layers.findIndex((l) => (ROLE_RANK[l.role] ?? 11) > r);
  return i < 0 ? layers.length : i;
}

export interface CollectedMeta {
  id: string;
  name: string;
  role: LayerRole;
  geom: Layer['geom'];
  raster?: Layer['raster'];
  source: Layer['source'];
  stylePreset?: string;
  visible?: boolean;
  legendLabel?: string;
  count: number;
}

/** Construit l'objet couche à partir d'une couche collectée ; garde style et position d'une couche existante. */
export function upsertCollected(d: { site: any; data: Record<string, FC> }, meta: CollectedMeta, fc?: FC) {
  const layers: Layer[] = d.site.layers;
  const existing = layers.find((l) => l.id === meta.id);
  if (existing) {
    existing.source = meta.source;
    existing.count = meta.count;
    existing.name = existing.name || meta.name;
    if (meta.raster) existing.raster = meta.raster;
  } else {
    const l = makeLayer({ id: meta.id, name: meta.name, role: meta.role, geom: meta.geom, source: meta.source, count: meta.count });
    if (meta.stylePreset && presetById(meta.stylePreset)) l.style = cloneStyle(presetById(meta.stylePreset)!.style);
    if (meta.raster) {
      l.kind = 'raster';
      l.raster = meta.raster;
      l.legend = !!meta.raster.legend;
    }
    l.visible = meta.visible !== false;
    if (meta.legendLabel) l.legendLabel = meta.legendLabel;
    layers.splice(insertIndex(layers, l.role), 0, l);
  }
  if (fc) d.data[meta.id] = fc;
}

export function addLayer(layer: Layer, fc?: FC, opts: { select?: boolean } = {}) {
  const st = useStore.getState();
  st.commit(
    (d) => {
      d.site.layers.splice(insertIndex(d.site.layers, layer.role), 0, layer);
      if (fc) d.data[layer.id] = fc;
    },
    { touched: fc ? [layer.id] : [] },
  );
  if (opts.select !== false) st.selectLayer(layer.id);
}

export function updateLayer(id: string, fn: (l: Layer) => void) {
  useStore.getState().commit((d) => {
    const l = d.site.layers.find((x) => x.id === id);
    if (l) fn(l);
  });
}

export function setFeatures(id: string, fn: (fc: FC) => FC) {
  useStore.getState().commit(
    (d) => {
      const fc = d.data[id] || { type: 'FeatureCollection', features: [] };
      d.data[id] = fn(fc);
    },
    { touched: [id] },
  );
}
