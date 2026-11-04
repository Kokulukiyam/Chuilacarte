'use client';
import * as turf from '@turf/turf';
import type { Feature, LineString, MultiPolygon, Polygon } from 'geojson';
import { nanoid } from 'nanoid';
import { useStore } from './store';
import { mapRef } from './mapref';
import { registerTool } from './tools';
import type { FC } from './types';

function selFeatures(): { layerId: string; feats: Feature[] } | null {
  const st = useStore.getState();
  const s = st.selection;
  if (!s) return null;
  const ids = new Set(s.fids?.length ? s.fids : [s.fid]);
  const fc = st.data[s.layerId];
  if (!fc) return null;
  return { layerId: s.layerId, feats: fc.features.filter((f) => ids.has(f.properties?._fid)) as Feature[] };
}

function replaceFeatures(layerId: string, removeIds: Set<string>, add: Feature[]) {
  useStore.getState().commit(
    (d) => {
      const fc = d.data[layerId];
      const out = fc.features.filter((f) => !removeIds.has(f.properties?._fid));
      d.data[layerId] = { ...fc, features: [...out, ...(add as any)] };
    },
    { touched: [layerId] },
  );
}

export function transformSelection(kind: 'rotate' | 'scale' | 'move', amount: number | [number, number]) {
  const s = selFeatures();
  if (!s || !s.feats.length) return;
  const fc = turf.featureCollection(s.feats as any);
  const pivot = turf.centroid(fc).geometry.coordinates;
  const out = s.feats.map((f) => {
    let g: any = f;
    if (kind === 'rotate') g = turf.transformRotate(f as any, amount as number, { pivot });
    else if (kind === 'scale') g = turf.transformScale(f as any, amount as number, { origin: pivot });
    else {
      const [dx, dy] = amount as [number, number];
      const dist = Math.hypot(dx, dy);
      const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
      g = turf.transformTranslate(f as any, dist, bearing, { units: 'meters' });
    }
    return { ...f, geometry: g.geometry };
  });
  useStore.getState().commit(
    (d) => {
      const c = d.data[s.layerId];
      const m = new Map(out.map((f) => [f.properties?._fid, f]));
      d.data[s.layerId] = { ...c, features: c.features.map((f) => (m.get(f.properties?._fid) as any) || f) };
    },
    { touched: [s.layerId] },
  );
}

export function deleteSelection() {
  const s = selFeatures();
  if (!s) return;
  replaceFeatures(s.layerId, new Set(s.feats.map((f) => f.properties?._fid)), []);
  useStore.getState().select(null);
}

export function duplicateSelection() {
  const s = selFeatures();
  if (!s) return;
  const copies = s.feats.map((f) => {
    const g = turf.transformTranslate(f as any, 5, 135, { units: 'meters' });
    return { ...f, geometry: g.geometry, properties: { ...f.properties, _fid: nanoid(8) } };
  });
  replaceFeatures(s.layerId, new Set(), copies);
  useStore.getState().select({ layerId: s.layerId, fid: copies[0].properties._fid, fids: copies.map((c) => c.properties._fid) });
}

/** Fusionne les objets sélectionnés (polygones : union ; lignes : multi-ligne). */
export function mergeSelection() {
  const s = selFeatures();
  const st = useStore.getState();
  if (!s || s.feats.length < 2) {
    st.toast('Sélectionnez au moins deux objets (Maj + clic) de la même couche', 'error');
    return;
  }
  const polys = s.feats.filter((f) => /Polygon/.test(f.geometry.type));
  const lines = s.feats.filter((f) => /LineString/.test(f.geometry.type));
  let merged: Feature | null = null;
  if (polys.length === s.feats.length) {
    merged = turf.union(turf.featureCollection(polys as Feature<Polygon | MultiPolygon>[])) as any;
  } else if (lines.length === s.feats.length) {
    const coords: any[] = [];
    for (const l of lines) l.geometry.type === 'LineString' ? coords.push((l.geometry as any).coordinates) : coords.push(...(l.geometry as any).coordinates);
    merged = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: coords }, properties: {} };
  } else {
    st.toast('Fusion impossible : les objets doivent être du même type', 'error');
    return;
  }
  if (!merged) return;
  const props = { ...s.feats[0].properties, _fid: nanoid(8) };
  replaceFeatures(s.layerId, new Set(s.feats.map((f) => f.properties?._fid)), [{ ...merged, properties: props }]);
  st.select({ layerId: s.layerId, fid: props._fid });
  st.toast(`${s.feats.length} objets fusionnés`, 'ok');
}

/** Découpe un polygone ou une ligne par une ligne tracée. */
export function splitFeatureByLine(target: Feature, cutter: Feature<LineString>): Feature[] | null {
  const g = target.geometry;
  if (g.type === 'LineString' || g.type === 'MultiLineString') {
    const parts = turf.lineSplit(target as any, cutter as any);
    return parts.features.length > 1 ? (parts.features as any) : null;
  }
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    // demi-plan à gauche de la ligne de coupe (ligne prolongée + même ligne décalée loin à gauche),
    // puis intersection / différence : les deux parties partagent exactement la ligne de coupe
    const cs = cutter.geometry.coordinates;
    if (cs.length < 2) return null;
    const bb = turf.bbox(target as any);
    const span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 4 + 0.001;
    const a = cs[0];
    const b = cs[cs.length - 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const ext = [[a[0] - ux * span, a[1] - uy * span], ...cs, [b[0] + ux * span, b[1] + uy * span]];
    const nx = -uy * span;
    const ny = ux * span;
    const ring = [...ext, ...ext.slice().reverse().map((p) => [p[0] + nx, p[1] + ny]), ext[0]];
    const half = turf.polygon([ring]);
    const left = turf.intersect(turf.featureCollection([target as any, half]));
    const right = turf.difference(turf.featureCollection([target as any, half]));
    if (!left || !right) return null;
    const parts = [...turf.flatten(left as any).features, ...turf.flatten(right as any).features];
    return parts.length > 1 ? (parts as any) : null;
  }
  return null;
}

registerTool('split', {
  finish(f) {
    const s = selFeatures();
    const st = useStore.getState();
    if (!s || s.feats.length !== 1) {
      st.toast('Sélectionnez d’abord un objet à découper', 'error');
      return;
    }
    const parts = splitFeatureByLine(s.feats[0], f as Feature<LineString>);
    if (!parts) {
      st.toast('La ligne de coupe doit traverser entièrement l’objet', 'error');
      return;
    }
    const add = parts.map((p) => ({ ...p, properties: { ...s.feats[0].properties, _fid: nanoid(8) } }));
    replaceFeatures(s.layerId, new Set([s.feats[0].properties?._fid]), add);
    st.select({ layerId: s.layerId, fid: add[0].properties._fid, fids: add.map((a) => a.properties._fid) });
    st.setTool('select');
    st.toast(`Objet découpé en ${add.length} parties`, 'ok');
  },
});

/** Mode édition des sommets : Terra Draw prend la main sur les objets sélectionnés. */
export function startVertexEdit() {
  const s = selFeatures();
  const st = useStore.getState();
  const draw = mapRef.draw;
  if (!s || !draw) return;
  const editable = s.feats.flatMap((f) => {
    if (f.geometry.type.startsWith('Multi')) {
      st.toast('Objet multiple : seules ses parties simples sont éditables après « Séparer »', 'info');
      return [];
    }
    return [f];
  });
  if (!editable.length) return;
  st.setTool('edit');
  draw.onEditChange = (feats) => {
    const m = new Map(feats.map((f) => [String(f.properties?._fid), f.geometry]));
    useStore.getState().commit(
      (d) => {
        const c = d.data[s.layerId];
        d.data[s.layerId] = { ...c, features: c.features.map((f) => (m.has(f.properties?._fid) ? { ...f, geometry: m.get(f.properties?._fid)! } : f)) as any };
      },
      { touched: [s.layerId] },
    );
  };
  draw.startEdit(editable);
}

export function stopVertexEdit() {
  mapRef.draw?.stopEdit();
}

/** Sépare un objet multiple en objets simples. */
export function explodeSelection() {
  const s = selFeatures();
  if (!s) return;
  const out: Feature[] = [];
  for (const f of s.feats) {
    const parts = turf.flatten(f as any).features;
    for (const p of parts) out.push({ ...p, properties: { ...f.properties, _fid: nanoid(8) } } as any);
  }
  replaceFeatures(s.layerId, new Set(s.feats.map((f) => f.properties?._fid)), out);
  useStore.getState().select(null);
}

export function emptyFc(): FC {
  return { type: 'FeatureCollection', features: [] };
}
