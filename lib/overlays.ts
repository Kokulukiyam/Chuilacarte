'use client';
import type { Map as MlMap } from 'maplibre-gl';
import { create } from 'zustand';
import type { FC } from './types';

/** Couches temporaires (mesures en cours, résultats d'analyse non enregistrés, ombres…). */
interface OverlayState {
  measure: FC;
  temp: FC;
  set(p: Partial<Pick<OverlayState, 'measure' | 'temp'>>): void;
}

const EMPTY: FC = { type: 'FeatureCollection', features: [] };

export const useOverlay = create<OverlayState>((set) => ({
  measure: EMPTY,
  temp: EMPTY,
  set: (p) => set(p),
}));

export function clearOverlays() {
  useOverlay.getState().set({ measure: EMPTY, temp: EMPTY });
}

let lastApplied: { measure?: FC; temp?: FC; map?: MlMap } = {};

export function syncOverlays(map: MlMap) {
  const st = useOverlay.getState();
  if (!map.getSource('ov-measure')) {
    if (!map.getSource('sel')) return;
    map.addSource('ov-measure', { type: 'geojson', data: st.measure });
    map.addSource('ov-temp', { type: 'geojson', data: st.temp });
    map.addLayer({ id: 'ov-temp-fill', type: 'fill', source: 'ov-temp', filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': ['coalesce', ['get', '_color'], '#7c3aed'], 'fill-opacity': ['coalesce', ['get', '_opacity'], 0.25] } });
    map.addLayer({ id: 'ov-temp-line', type: 'line', source: 'ov-temp', paint: { 'line-color': ['coalesce', ['get', '_color'], '#7c3aed'], 'line-width': 2 } });
    map.addLayer({ id: 'ov-measure-fill', type: 'fill', source: 'ov-measure', filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': '#e11d48', 'fill-opacity': 0.1 } });
    map.addLayer({ id: 'ov-measure-line', type: 'line', source: 'ov-measure', filter: ['!', ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]]], paint: { 'line-color': '#e11d48', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'ov-measure-pt', type: 'circle', source: 'ov-measure', filter: ['all', ['in', ['geometry-type'], ['literal', ['Point']]], ['!', ['has', '_label']]], paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-color': '#e11d48', 'circle-stroke-width': 2 } });
    map.addLayer({
      id: 'ov-measure-label',
      type: 'symbol',
      source: 'ov-measure',
      filter: ['has', '_label'],
      layout: { 'text-field': ['get', '_label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true, 'text-offset': [0, -1] },
      paint: { 'text-color': '#be123c', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });
    lastApplied = { map };
  }
  if (lastApplied.map !== map) lastApplied = { map };
  if (lastApplied.measure !== st.measure) {
    (map.getSource('ov-measure') as any).setData(st.measure);
    lastApplied.measure = st.measure;
  }
  if (lastApplied.temp !== st.temp) {
    (map.getSource('ov-temp') as any).setData(st.temp);
    lastApplied.temp = st.temp;
  }
  for (const id of ['ov-temp-fill', 'ov-temp-line', 'ov-measure-fill', 'ov-measure-line', 'ov-measure-pt', 'ov-measure-label']) if (map.getLayer(id)) map.moveLayer(id);
}

export function overlaySubscribe(map: MlMap) {
  return useOverlay.subscribe(() => syncOverlays(map));
}
