'use client';
import { create } from 'zustand';
import * as turf from '@turf/turf';
import type { Feature, LineString, MultiPolygon, Polygon } from 'geojson';
import { nanoid } from 'nanoid';
import { useStore } from './store';
import { registerTool } from './tools';
import { makeLayer, userSource, bufferedEmprise } from './site';
import { insertIndex } from './layerops';
import { baseStyle, computeGradClasses } from './styles';
import { useOverlay } from './overlays';
import type { ZoneDef } from './analysis';
import type { FC, Layer } from './types';

export interface ProfileResult {
  length: number;
  points: { d: number; z: number | null; lon: number; lat: number }[];
  min: number;
  max: number;
  up: number;
  down: number;
  source: string;
  note: string;
  line: LineString;
}

export const useAnalysis = create<{
  profile: ProfileResult | null;
  profileBusy: boolean;
  isoMode: 'walk' | 'bike' | 'car';
  isoMinutes: string;
  isoBusy: boolean;
  error: string | null;
  set(p: any): void;
}>((set) => ({
  profile: null,
  profileBusy: false,
  isoMode: 'walk',
  isoMinutes: '5, 10, 15',
  isoBusy: false,
  error: null,
  set: (p) => set(p),
}));

export function addAnalysisLayer(name: string, fc: FC, opts: { geom: Layer['geom']; style?: Layer['style']; source?: Layer['source']; role?: Layer['role'] }) {
  const st = useStore.getState();
  const l = makeLayer({ name, role: opts.role || 'analysis', geom: opts.geom, source: opts.source || userSource('Analyse Chuilacarte'), count: fc.features.length });
  if (opts.style) l.style = opts.style;
  st.commit(
    (d) => {
      d.site.layers.splice(insertIndex(d.site.layers, l.role), 0, l);
      d.data[l.id] = fc;
    },
    { touched: [l.id] },
  );
  st.selectLayer(l.id);
  st.setUi({ rightTab: 'analyse' as any });
  return l.id;
}

// ------------------------------------------------------------ zones d'analyse
export function zoneLayer(): Layer | undefined {
  return useStore.getState().site?.layers.find((l) => l.role === 'analysis' && l.name === 'Zones d’analyse');
}

export function listZones(): ZoneDef[] {
  const st = useStore.getState();
  const site = st.site!;
  const out: ZoneDef[] = [
    { id: 'emprise', name: 'Emprise du site', feature: site.emprise },
    { id: 'tampon', name: `Emprise + tampon (${site.buffer} m)`, feature: bufferedEmprise(site) },
  ];
  const zl = zoneLayer();
  if (zl) for (const f of st.data[zl.id]?.features || []) if (f.geometry && /Polygon/.test(f.geometry.type)) out.push({ id: `z:${f.properties?._fid}`, name: String(f.properties?.nom || 'Zone'), feature: f as Feature<Polygon | MultiPolygon> });
  const sel = st.selection;
  if (sel) {
    const l = site.layers.find((x) => x.id === sel.layerId);
    const f = st.data[sel.layerId]?.features.find((x) => x.properties?._fid === sel.fid);
    if (l && f?.geometry && /Polygon/.test(f.geometry.type) && l.id !== zl?.id && l.id !== 'emprise' && l.id !== 'tampon')
      out.push({ id: `s:${sel.layerId}:${sel.fid}`, name: `Objet sélectionné (${l.name}${f.properties?.nom ? ` — ${f.properties.nom}` : ''})`, feature: f as Feature<Polygon | MultiPolygon> });
  }
  return out;
}

registerTool('zone', {
  finish(f) {
    const st = useStore.getState();
    const n = (st.data[zoneLayer()?.id || '']?.features.length || 0) + 1;
    const nom = window.prompt('Nom de la zone d’analyse', `Zone ${n}`) || `Zone ${n}`;
    let zl = zoneLayer();
    const fid = nanoid(8);
    st.commit((d) => {
      if (!zl) {
        zl = makeLayer({ name: 'Zones d’analyse', role: 'analysis', geom: 'polygon', source: userSource('Zones d’analyse') });
        zl.style = baseStyle({ fill: '#7c3aed', fillOpacity: 0.08, stroke: '#7c3aed', strokeWidth: 2, dash: 'dash', label: { field: 'nom', size: 12, color: '#5b21b6', halo: '#ffffff', weight: 'bold' } });
        d.site.layers.splice(insertIndex(d.site.layers, 'analysis'), 0, zl);
        d.data[zl.id] = { type: 'FeatureCollection', features: [] };
      }
      const fc = d.data[zl.id];
      d.data[zl.id] = { ...fc, features: [...fc.features, { type: 'Feature', geometry: f.geometry, properties: { _fid: fid, nom } }] };
      return { touched: [zl.id] };
    });
    st.setTool('select');
    st.setUi({ rightTab: 'analyse' as any });
    window.dispatchEvent(new CustomEvent('chuilacarte-zone', { detail: `z:${fid}` }));
  },
});

// ------------------------------------------------------------ profil
registerTool('profile', {
  async finish(f) {
    const st = useStore.getState();
    const a = useAnalysis.getState();
    a.set({ profileBusy: true, error: null });
    st.setUi({ rightTab: 'analyse' as any });
    useOverlay.getState().set({ temp: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: f.geometry, properties: { _color: '#0f766e' } }] } });
    try {
      const r = await fetch(`/api/sites/${st.site!.slug}/profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ line: f.geometry }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      a.set({ profile: { ...j, line: f.geometry } });
    } catch (e: any) {
      a.set({ error: `Profil : ${e.message}` });
    } finally {
      a.set({ profileBusy: false });
      st.setTool('select');
    }
  },
});

// ------------------------------------------------------------ isochrones
const MODE_FR = { walk: 'à pied', bike: 'à vélo', car: 'en voiture' };
registerTool('isochrone', {
  async finish(f) {
    const st = useStore.getState();
    const a = useAnalysis.getState();
    const [lon, lat] = (f.geometry as any).coordinates;
    const minutes = a.isoMinutes
      .split(/[,; ]+/)
      .map(Number)
      .filter((x) => x > 0);
    a.set({ isoBusy: true, error: null });
    try {
      const r = await fetch('/api/isochrone', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lon, lat, mode: a.isoMode, minutes }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const fc: FC = j.fc;
      // les plus grandes dessous
      fc.features.sort((x, y) => Number(y.properties?.minutes) - Number(x.properties?.minutes));
      fc.features.push({ type: 'Feature', geometry: f.geometry, properties: { minutes: 0, origine: 'oui' } });
      const vals = fc.features.map((x) => Number(x.properties?.minutes)).filter((x) => x > 0);
      const style = baseStyle({
        stroke: '#6d28d9',
        strokeWidth: 1.5,
        fillOpacity: 0.16,
        mode: 'graduated',
        graduated: {
          field: 'minutes',
          method: 'equal',
          ramp: 'violet',
          classes: [...new Set(vals)].sort((x, y) => x - y).map((m, i, arr) => ({ min: i === 0 ? 0 : arr[i - 1], max: m, color: ['#4c1d95', '#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe'][Math.min(4, arr.length - 1 - i)] })),
        },
        pointSize: 9,
        pointShape: 'star',
      });
      addAnalysisLayer(`Isochrones ${MODE_FR[a.isoMode]} (${vals.join(', ')} min)`, fc, {
        geom: 'mixed',
        style,
        source: { name: `Isochrones — ${j.provider}`, license: 'ODbL (données OSM)', attribution: j.attribution, collectedAt: new Date().toISOString() },
      });
    } catch (e: any) {
      a.set({ error: `Isochrones : ${e.message}` });
      st.toast(e.message, 'error');
    } finally {
      a.set({ isoBusy: false });
      st.setTool('select');
    }
  },
});

// ------------------------------------------------------------ tampons
export function bufferFeatures(layerId: string, distance: number, onlySelection: boolean, dissolve: boolean) {
  const st = useStore.getState();
  const l = st.site!.layers.find((x) => x.id === layerId);
  if (!l) return;
  let feats = st.data[layerId]?.features || [];
  if (onlySelection && st.selection?.layerId === layerId) {
    const ids = new Set(st.selection.fids?.length ? st.selection.fids : [st.selection.fid]);
    feats = feats.filter((f) => ids.has(f.properties?._fid));
  }
  if (!feats.length) throw new Error('Aucun objet à traiter');
  if (feats.length > 5000) throw new Error('Trop d’objets (5 000 max) : filtrez la couche ou sélectionnez des objets');
  const out: Feature[] = [];
  for (const f of feats) {
    try {
      const b: any = turf.buffer(f as any, distance, { units: "meters", steps: 12 });
      if (b) out.push({ type: 'Feature', geometry: b.geometry, properties: { source: f.properties?.nom || f.properties?._fid, distance_m: distance } });
    } catch {
      /* objet invalide ignoré */
    }
  }
  let fc: FC = { type: 'FeatureCollection', features: out as any };
  if (dissolve && out.length > 1) {
    const u = turf.union(turf.featureCollection(out as Feature<Polygon | MultiPolygon>[]));
    if (u) fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: u.geometry, properties: { distance_m: distance, objets: out.length } }] };
  }
  addAnalysisLayer(`Tampon ${distance} m — ${l.name}`, fc, { geom: 'polygon', style: baseStyle({ fill: '#0ea5e9', fillOpacity: 0.15, stroke: '#0369a1', strokeWidth: 1.2, dash: 'dash' }) });
}

export function gradStyleFor(fc: FC, field: string, ramp = 'rouge') {
  const vals = fc.features.map((f) => Number(f.properties?.[field])).filter(Number.isFinite);
  return baseStyle({ stroke: '#ffffff', strokeWidth: 0.3, fillOpacity: 0.7, mode: 'graduated', graduated: { field, method: 'quantile', ramp, classes: computeGradClasses(vals, 'quantile', ramp, 5) } });
}
