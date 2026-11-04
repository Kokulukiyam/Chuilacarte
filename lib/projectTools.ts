'use client';
import { create } from 'zustand';
import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { useStore } from './store';
import { registerTool } from './tools';
import { mapRef } from './mapref';
import { makeLayer, userSource } from './site';
import { insertIndex } from './layerops';
import { applyPlacement, helmert, imageCorners, placeLocal, prepareLocalPlan, unplaceLocal } from './placement';
import { useOverlay } from './overlays';
import { fromUtm, metricArea, toUtm } from './proj';
import { baseStyle, presetById, cloneStyle } from './styles';
import { heightOf, shadowsFor, sunAt } from './shadows';
import type { FC, Layer, Placement } from './types';

export const useCalage = create<{
  layerId: string | null;
  pairs: { local: [number, number]; utm: [number, number] }[];
  pending: [number, number] | null; // point local cliqué, en attente du point carte
  moveMode: boolean;
  set(p: any): void;
}>((set) => ({ layerId: null, pairs: [], pending: null, moveMode: false, set: (p) => set(p) }));

/** Réapplique le calage d'une couche (vecteur : géométries ; image : coins). */
export function relocate(l: Layer, data: Record<string, FC>, site = useStore.getState().site!) {
  if (!l.placement) return;
  if (l.kind === 'raster' && l.raster) l.raster.corners = imageCorners(site.utm, l.placement);
  else if (data[l.id]) data[l.id] = applyPlacement(site.utm, l.placement, data[l.id]);
}

export function setPlacement(layerId: string, fn: (p: Placement) => void, opts: { history?: boolean } = {}) {
  const st = useStore.getState();
  const apply = (d: { site: any; data: Record<string, FC> }) => {
    const l = d.site.layers.find((x: Layer) => x.id === layerId);
    if (!l?.placement) return;
    fn(l.placement);
    relocate(l, d.data, d.site);
  };
  if (opts.history === false) {
    // mise à jour en direct (glisser) : pas d'entrée d'historique, mais sauvegarde
    const d = { site: structuredClone(st.site!), data: { ...st.data } };
    apply(d);
    useStore.setState({ site: d.site, data: d.data, dirtySite: true, dirtyLayers: { ...st.dirtyLayers, [layerId]: true } });
  } else st.commit((d) => apply(d), { touched: [layerId] });
}

/** Importe un plan DXF en coordonnées locales, posé au centre de la vue. */
export async function importPlanDxf(file: File, units: Placement['units'] | 'auto') {
  const st = useStore.getState();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('allowLocalDxf', '1');
  const r = await fetch('/api/import', { method: 'POST', body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  const parts: { name: string; fc: FC; geom: any; local?: boolean; units?: string }[] = j.layers;
  const all: FC = { type: 'FeatureCollection', features: parts.flatMap((p) => p.fc.features) };
  const c = mapRef.map?.getCenter();
  const anchor: [number, number] = c ? [c.lng, c.lat] : st.site!.center;
  const isLocal = parts.some((p) => p.local);
  const u = units === 'auto' ? ((parts[0]?.units && parts[0].units !== 'unknown' ? parts[0].units : 'm') as Placement['units']) : units;
  const layer = makeLayer({ name: `Plan — ${file.name.replace(/\.dxf$/i, '')}`, role: 'project', geom: parts.length === 1 ? parts[0].geom : 'mixed', source: userSource(`Plan DXF : ${file.name}`) });
  layer.style = cloneStyle(presetById('emprise-projet')!.style);
  layer.style.fillOpacity = 0.35;
  layer.project = { levels: 3, levelHeight: 3 };
  let fc = all;
  if (isLocal) {
    const prep = prepareLocalPlan(all, u);
    layer.placement = { anchor, rotation: 0, scale: 1, units: u };
    fc = applyPlacement(st.site!.utm, layer.placement, prep.fc);
  }
  st.commit(
    (d) => {
      d.site.layers.splice(insertIndex(d.site.layers, 'project'), 0, layer);
      d.data[layer.id] = fc;
    },
    { touched: [layer.id] },
  );
  st.selectLayer(layer.id);
  st.setUi({ rightTab: 'projet' });
  useCalage.getState().set({ layerId: layer.id, pairs: [], pending: null });
  try {
    mapRef.map?.fitBounds(turf.bbox(fc) as any, { padding: 120, maxZoom: 19, duration: 500 });
  } catch {
    /* rien */
  }
  return { layer, isLocal, units: u, count: fc.features.length };
}

/** Importe une image (plan scanné, esquisse) à caler, avec transparence. */
export async function importPlanImage(file: File) {
  const st = useStore.getState();
  const site = st.site!;
  const ext = (file.name.match(/\.(png|jpe?g|webp)$/i)?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
  const name = `plans/${Date.now().toString(36)}.${ext}`;
  const r = await fetch(`/api/sites/${site.slug}/files/${name}`, { method: 'PUT', body: file });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  const size = await new Promise<[number, number]>((res, rej) => {
    const img = new Image();
    img.onload = () => res([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => rej(new Error('Image illisible'));
    img.src = URL.createObjectURL(file);
  });
  const map = mapRef.map;
  const c = map?.getCenter();
  // largeur initiale : environ un tiers de la vue
  let viewW = 300;
  if (map) {
    const b = map.getBounds();
    viewW = turf.distance([b.getWest(), c!.lat], [b.getEast(), c!.lat], { units: 'meters' });
  }
  const placement: Placement = { anchor: c ? [c.lng, c.lat] : site.center, rotation: 0, scale: viewW / 3 / size[0], units: 'px', imageSize: size };
  const layer = makeLayer({ name: `Image — ${file.name}`, role: 'project', geom: 'mixed', source: userSource(`Image calée : ${file.name}`) });
  layer.kind = 'raster';
  layer.opacity = 0.6;
  layer.placement = placement;
  layer.raster = { type: 'image', url: j.url, corners: imageCorners(site.utm, placement) };
  layer.legend = false;
  st.commit((d) => void d.site.layers.splice(insertIndex(d.site.layers, 'project'), 0, layer));
  st.selectLayer(layer.id);
  st.setUi({ rightTab: 'projet' });
  useCalage.getState().set({ layerId: layer.id, pairs: [], pending: null });
  return layer;
}

/** Couche « Emprise du projet » (dessinée), créée au besoin. */
export function startDrawProject() {
  const st = useStore.getState();
  let l = st.site!.layers.find((x) => x.role === 'project' && x.kind === 'vector' && !x.placement && x.name === 'Emprise du projet');
  if (!l) {
    l = makeLayer({ name: 'Emprise du projet', role: 'project', geom: 'polygon', source: userSource('Emprise du projet') });
    l.project = { levels: 3, levelHeight: 3 };
    const nl = l;
    st.commit(
      (d) => {
        d.site.layers.splice(insertIndex(d.site.layers, 'project'), 0, nl);
        d.data[nl.id] = { type: 'FeatureCollection', features: [] };
      },
      { touched: [nl.id] },
    );
  }
  st.selectLayer(l.id);
  st.setTool('draw-polygon');
  useStore.setState({ drawTarget: l.id });
}

// --------------------------------------------------------- calage par points
registerTool('calage', {
  click(map, e) {
    const cal = useCalage.getState();
    const st = useStore.getState();
    const l = st.site!.layers.find((x) => x.id === cal.layerId);
    if (!l?.placement) return true;
    const site = st.site!;
    if (!cal.pending) {
      // 1er clic : point sur le plan (tel qu'il est affiché)
      const loc = unplaceLocal(site.utm, l.placement, e.lngLat.lng, e.lngLat.lat);
      cal.set({ pending: loc });
    } else {
      const utm = toUtm(site.utm, [e.lngLat.lng, e.lngLat.lat]);
      cal.set({ pairs: [...cal.pairs, { local: cal.pending, utm }], pending: null });
    }
    updateCalageOverlay();
    void map;
    return true;
  },
});

export function updateCalageOverlay() {
  const cal = useCalage.getState();
  const st = useStore.getState();
  const l = st.site?.layers.find((x) => x.id === cal.layerId);
  const map = mapRef.map;
  if (!map || !l?.placement) return;
  const site = st.site!;
  const feats: any[] = [];
  cal.pairs.forEach((p, i) => {
    const a = placeLocal(site.utm, l.placement!, p.local[0], p.local[1]);
    const b = fromUtm(site.utm, p.utm);
    feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { _color: '#ea580c' } });
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { _label: `${i + 1}` } });
  });
  if (cal.pending) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: placeLocal(site.utm, l.placement, cal.pending[0], cal.pending[1]) }, properties: { _label: `${cal.pairs.length + 1} (plan)` } });
  useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: feats } });
}

export function applyCalage() {
  const cal = useCalage.getState();
  const st = useStore.getState();
  const site = st.site!;
  const h = helmert(cal.pairs);
  const anchor = fromUtm(site.utm, h.origin);
  setPlacement(cal.layerId!, (p) => {
    // les points locaux ont été mesurés avec l'échelle courante : on compose
    p.scale = h.scale;
    p.rotation = h.rotation;
    p.anchor = anchor;
  });
  cal.set({ pairs: [], pending: null });
  useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [] } });
  st.setTool('select');
  return h;
}

// --------------------------------------------------------- calculs du projet
export function projectFigures(l: Layer, data: Record<string, FC>) {
  const site = useStore.getState().site!;
  const fc = data[l.id];
  if (!fc) return null;
  const polys = fc.features.filter((f) => f.geometry && /Polygon/.test(f.geometry.type)) as Feature<Polygon | MultiPolygon>[];
  if (!polys.length) return null;
  // emprise = union des polygones (un plan DXF peut contenir parcelle + bâtiment : on exclut le calque PARCELLE)
  const bat = polys.filter((f) => !/parcel/i.test(String(f.properties?.calque || '')));
  let emprise = 0;
  try {
    const u = bat.length > 1 ? turf.union(turf.featureCollection(bat)) : bat[0];
    emprise = u ? metricArea(site.utm, u.geometry) : 0;
  } catch {
    emprise = bat.reduce((s, f) => s + metricArea(site.utm, f.geometry), 0);
  }
  const levels = l.project?.levels ?? 1;
  const plancher = emprise * levels;
  let parcel = l.project?.parcel ? metricArea(site.utm, l.project.parcel) : 0;
  const parcelFromDxf = polys.find((f) => /parcel/i.test(String(f.properties?.calque || '')));
  if (!parcel && parcelFromDxf) parcel = metricArea(site.utm, parcelFromDxf.geometry);
  return { emprise, levels, plancher, hauteur: levels * (l.project?.levelHeight ?? 3), parcel, ces: parcel ? emprise / parcel : null, cos: parcel ? plancher / parcel : null };
}

// --------------------------------------------------------- ombres
export const useShadow = create<{ on: boolean; date: string; time: string; info: string; set(p: any): void }>((set) => ({
  on: false,
  date: new Date().toISOString().slice(0, 10),
  time: '10:00',
  info: '',
  set: (p) => set(p),
}));

export function computeShadows() {
  const st = useStore.getState();
  const site = st.site!;
  const sh = useShadow.getState();
  const [hh, mm] = sh.time.split(':').map(Number);
  const [y, mo, d] = sh.date.split('-').map(Number);
  // heure du Sénégal = UTC
  const date = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  const sun = sunAt(date, site.center[0], site.center[1]);
  const map = mapRef.map;
  const b = map ? map.getBounds() : null;
  const bbox = b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : turf.bbox(site.emprise);
  const pad = 0.004;
  const bb = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
  const src: { fc: FC; height: (p: Record<string, any>) => number }[] = [];
  for (const l of site.layers) {
    if (!l.visible || l.kind !== 'vector' || !st.data[l.id]) continue;
    if (l.role === 'buildings') src.push({ fc: st.data[l.id], height: (p) => heightOf(p, site.settings.levelHeight, site.settings.defaultHeight) });
    if (l.role === 'project') src.push({ fc: { ...st.data[l.id], features: st.data[l.id].features.filter((f) => !/parcel/i.test(String(f.properties?.calque || ''))) }, height: (p) => Number(p?.hauteur) || (l.project?.levels ?? 3) * (l.project?.levelHeight ?? 3) });
  }
  const fc = sun.altitude > 0.5 ? shadowsFor(site.utm, src, sun, bb) : { type: 'FeatureCollection' as const, features: [] };
  const info = sun.altitude <= 0.5 ? `Soleil sous l’horizon (${sun.altitude.toFixed(1)}°) : pas d’ombre.` : `Soleil : hauteur ${sun.altitude.toFixed(1)}°, azimut ${sun.azimuth.toFixed(0)}° — une hauteur de 10 m projette ${(10 * sun.shadowFactor).toFixed(1)} m d’ombre.`;
  sh.set({ info });
  // couche « Ombres portées » mise à jour sans historique
  let l = site.layers.find((x) => x.role === 'shadow');
  const name = `Ombres portées — ${new Date(date).toLocaleDateString('fr-FR', { timeZone: 'UTC' })} ${sh.time} (heure du Sénégal)`;
  const s2 = structuredClone(site);
  if (!l) {
    l = makeLayer({ name, role: 'shadow', geom: 'polygon', source: userSource('Ombres calculées (SunCalc)') });
    l.style = baseStyle({ fill: '#1e293b', fillOpacity: 0.32, stroke: '#1e293b', strokeWidth: 0, preset: 'ombres' });
    s2.layers.splice(insertIndex(s2.layers, 'shadow'), 0, l);
  } else {
    const x = s2.layers.find((y) => y.id === l!.id)!;
    x.name = name;
    x.visible = true;
  }
  useStore.setState({ site: s2, data: { ...st.data, [l.id]: fc }, dirtySite: true, dirtyLayers: { ...st.dirtyLayers, [l.id]: true } });
  return { sun, count: fc.features.length };
}
