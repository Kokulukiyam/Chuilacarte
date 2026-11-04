'use client';
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon } from 'geojson';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { useStore, type Tool } from './store';
import { registerTool } from './tools';
import { makeLayer, userSource } from './site';
import { insertIndex } from './layerops';
import { nextMarkerNumber } from './annotations';
import { fmtArea, fmtLength, metricArea, metricLength } from './proj';
import { useOverlay } from './overlays';
import type { AnnKind } from './annotations';
import type { Layer } from './types';

/** Réglages courants des annotations (couleur, épaisseur, taille, graisse). */
export const useAnnStyle = create<{ color: string; width: number; size: number; weight: 'regular' | 'bold'; fillOpacity: number; set(p: any): void }>((set) => ({
  color: '#dc2626',
  width: 2,
  size: 16,
  weight: 'bold',
  fillOpacity: 0.12,
  set: (p) => set(p),
}));

export function activeAnnotationLayer(): Layer | undefined {
  const st = useStore.getState();
  const sel = st.site?.layers.find((l) => l.id === st.selectedLayerId && l.role === 'annotations');
  return sel || st.site?.layers.find((l) => l.role === 'annotations');
}

function addAnnotation(kind: AnnKind, geometry: any, extra: Record<string, any> = {}) {
  const st = useStore.getState();
  const a = useAnnStyle.getState();
  let target = activeAnnotationLayer();
  const fid = nanoid(8);
  const props = { _fid: fid, _kind: kind, _color: a.color, _width: a.width, _size: kind === 'marker' ? Math.max(12, a.size - 2) : a.size, _weight: a.weight, _fillOpacity: a.fillOpacity, ...extra };
  st.commit(
    (d) => {
      if (!target) {
        target = makeLayer({ name: 'Annotations', role: 'annotations', geom: 'mixed', source: userSource('Annotations') });
        d.site.layers.splice(insertIndex(d.site.layers, 'annotations'), 0, target);
        d.data[target.id] = { type: 'FeatureCollection', features: [] };
      }
      const fc = d.data[target.id] || { type: 'FeatureCollection', features: [] };
      d.data[target.id] = { ...fc, features: [...fc.features, { type: 'Feature', geometry, properties: props }] };
      return { touched: [target.id] };
    },
  );
  st.select({ layerId: target!.id, fid });
  st.setUi({ rightTab: 'couche' });
  return fid;
}

/** Ajoute un objet dessiné à la couche cible choisie (« Ajouter un objet à cette couche »). */
function addToTarget(f: Feature): boolean {
  const st = useStore.getState();
  const target = st.drawTarget;
  if (!target) return false;
  const layer = st.site?.layers.find((l) => l.id === target);
  if (!layer || layer.kind !== 'vector') return false;
  const fid = nanoid(8);
  st.commit(
    (d) => {
      const fc = d.data[target] || { type: 'FeatureCollection', features: [] };
      d.data[target] = { ...fc, features: [...fc.features, { type: 'Feature', geometry: f.geometry, properties: { _fid: fid } }] };
    },
    { touched: [target] },
  );
  st.select({ layerId: target, fid });
  return true;
}

const simple: [Tool, AnnKind][] = [
  ['draw-point', 'point'],
  ['draw-line', 'line'],
  ['draw-polygon', 'polygon'],
  ['draw-rectangle', 'rectangle'],
  ['draw-freehand', 'freehand'],
  ['draw-arrow', 'arrow'],
  ['draw-dimension', 'dimension'],
];
for (const [tool, kind] of simple) {
  registerTool(tool, {
    finish(f) {
      if ((tool === 'draw-point' || tool === 'draw-line' || tool === 'draw-polygon') && addToTarget(f)) return;
      if (kind === 'dimension' && f.geometry.type === 'LineString') {
        const c = (f.geometry as LineString).coordinates;
        f = { ...f, geometry: { type: 'LineString', coordinates: [c[0], c[c.length - 1]] } };
      }
      addAnnotation(kind, f.geometry);
    },
  });
}

registerTool('draw-circle', {
  finish(f) {
    const st = useStore.getState();
    const g = f.geometry as Polygon;
    const c = turf.centroid(f as any).geometry.coordinates;
    const r = turf.distance(c, g.coordinates[0][0], { units: 'meters' });
    addAnnotation('circle', g, { _radius: Math.round(r * 10) / 10, rayon_m: Math.round(r * 10) / 10 });
    void st;
  },
});

registerTool('draw-text', {
  finish(f) {
    const t = window.prompt('Texte à placer sur la carte', 'Texte');
    if (!t) return;
    addAnnotation('text', f.geometry, { _text: t, texte: t });
  },
});

registerTool('draw-marker', {
  finish(f) {
    const layer = activeAnnotationLayer();
    const n = nextMarkerNumber(layer ? useStore.getState().data[layer.id] : undefined);
    const legend = window.prompt(`Légende du repère n° ${n}`, '') ?? '';
    addAnnotation('marker', f.geometry, { _num: n, _legend: legend, numero: n, legende: legend });
  },
});

// ------------------------------------------------------------------ mesures
function measureLabelLine(g: LineString) {
  const site = useStore.getState().site!;
  const len = metricLength(site.utm, g);
  const cs = g.coordinates;
  const end = cs[cs.length - 1];
  return { len, label: { type: 'Feature', geometry: { type: 'Point', coordinates: end }, properties: { _label: fmtLength(len) } } };
}

function measurePoly(g: Polygon) {
  const site = useStore.getState().site!;
  const area = metricArea(site.utm, g);
  const per = metricLength(site.utm, g);
  const c = turf.centroid({ type: 'Feature', geometry: g, properties: {} } as any).geometry.coordinates;
  return { area, per, label: { type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { _label: `${fmtArea(area)}\nPérimètre ${fmtLength(per)}` } } };
}

export const useMeasure = create<{ last: null | { kind: 'distance' | 'area'; value: number; perimeter?: number; segments?: number[]; geometry: any }; set(p: any): void }>((set) => ({
  last: null,
  set: (p) => set(p),
}));

registerTool('measure-distance', {
  live(f) {
    if (!f || f.geometry.type !== 'LineString' || (f.geometry as LineString).coordinates.length < 2) return;
    const { label } = measureLabelLine(f.geometry as LineString);
    useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [label as any] } });
  },
  finish(f) {
    const g = f.geometry as LineString;
    const site = useStore.getState().site!;
    const { len, label } = measureLabelLine(g);
    const segs: number[] = [];
    for (let i = 0; i < g.coordinates.length - 1; i++) segs.push(metricLength(site.utm, { type: 'LineString', coordinates: [g.coordinates[i], g.coordinates[i + 1]] }));
    useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: g, properties: {} }, label as any, ...g.coordinates.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }))] as any } });
    useMeasure.getState().set({ last: { kind: 'distance', value: len, segments: segs, geometry: g } });
    useStore.getState().setUi({ rightTab: 'analyse' as any });
  },
});

registerTool('measure-area', {
  live(f) {
    if (!f || f.geometry.type !== 'Polygon') return;
    const ring = (f.geometry as Polygon).coordinates[0];
    if (!ring || ring.length < 4) return;
    const { label } = measurePoly(f.geometry as Polygon);
    useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [label as any] } });
  },
  finish(f) {
    const g = f.geometry as Polygon;
    const { area, per, label } = measurePoly(g);
    useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: g, properties: {} }, label as any] } });
    useMeasure.getState().set({ last: { kind: 'area', value: area, perimeter: per, geometry: g } });
    useStore.getState().setUi({ rightTab: 'analyse' as any });
  },
});

/** Convertit la dernière mesure en annotation (cotation ou polygone). */
export function measureToAnnotation() {
  const m = useMeasure.getState().last;
  if (!m) return;
  if (m.kind === 'distance') {
    const cs = m.geometry.coordinates;
    if (cs.length === 2) addAnnotation('dimension', m.geometry);
    else addAnnotation('line', m.geometry, { longueur_m: Math.round(m.value * 100) / 100 });
  } else addAnnotation('polygon', m.geometry, { surface_m2: Math.round(m.value * 10) / 10 });
  useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [] } });
}
