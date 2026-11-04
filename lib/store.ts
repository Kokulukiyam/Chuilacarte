'use client';
import { create } from 'zustand';
import type { FC, Layer, Site } from './types';
import { nanoid } from 'nanoid';

export type Tool =
  | 'select'
  | 'pan'
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'draw-rectangle'
  | 'draw-circle'
  | 'draw-freehand'
  | 'draw-arrow'
  | 'draw-text'
  | 'draw-marker'
  | 'draw-dimension'
  | 'measure-distance'
  | 'measure-area'
  | 'profile'
  | 'buffer'
  | 'isochrone'
  | 'zone'
  | 'edit'
  | 'split'
  | 'calage'
  | 'identify';

interface Snapshot {
  site: Site;
  data: Record<string, FC>;
}

export interface Selection {
  layerId: string;
  fid: string;
  /** sélection multiple (Maj + clic), dans la même couche */
  fids?: string[];
}

interface State {
  site: Site | null;
  data: Record<string, FC>;
  loaded: Record<string, boolean>;
  selectedLayerId: string | null;
  selection: Selection | null;
  tool: Tool;
  past: Snapshot[];
  future: Snapshot[];
  dirtySite: boolean;
  dirtyLayers: Record<string, true>;
  saving: 'idle' | 'saving' | 'saved' | 'error';
  saveError?: string;
  rightTab: 'couche' | 'analyse' | 'projet' | 'site';
  mode3d: boolean;
  layoutMode: boolean;
  message: { text: string; kind: 'info' | 'error' | 'ok' } | null;
  /** couche qui reçoit les objets dessinés (sinon : annotations) */
  drawTarget: string | null;
  // actions
  init(site: Site, data: Record<string, FC>): void;
  setTool(t: Tool): void;
  selectLayer(id: string | null): void;
  select(s: Selection | null): void;
  /** modification annulable */
  commit(fn: (draft: { site: Site; data: Record<string, FC> }) => void | { touched?: string[] }, opts?: { touched?: string[] }): void;
  /** modification non annulable (vue, préférences) */
  patchSite(fn: (s: Site) => void): void;
  undo(): void;
  redo(): void;
  markSaved(ok: boolean, err?: string): void;
  setUi(p: Partial<Pick<State, 'rightTab' | 'mode3d' | 'layoutMode'>>): void;
  toast(text: string, kind?: 'info' | 'error' | 'ok'): void;
  setLayerData(id: string, fc: FC): void;
}

const MAX_HISTORY = 60;

/** Garde la sélection après annuler/rétablir si l'objet existe encore. */
function keepSel(sel: Selection | null, data: Record<string, FC>): Selection | null {
  if (!sel) return null;
  const fc = data[sel.layerId];
  if (!fc) return null;
  const ids = new Set(fc.features.map((f) => f.properties?._fid));
  const fids = (sel.fids || [sel.fid]).filter((x) => ids.has(x));
  if (!fids.length) return null;
  return { layerId: sel.layerId, fid: ids.has(sel.fid) ? sel.fid : fids[0], fids: sel.fids ? fids : undefined };
}

/** Garantit un identifiant stable _fid sur chaque objet. */
export function ensureFids(fc: FC): FC {
  let changed = false;
  const features = fc.features.map((f) => {
    if (f.properties && f.properties._fid) return f;
    changed = true;
    return { ...f, properties: { ...(f.properties || {}), _fid: nanoid(8) } };
  });
  return changed ? { ...fc, features } : fc;
}

export const useStore = create<State>((set, get) => ({
  site: null,
  data: {},
  loaded: {},
  selectedLayerId: null,
  selection: null,
  tool: 'select',
  past: [],
  future: [],
  dirtySite: false,
  dirtyLayers: {},
  saving: 'idle',
  rightTab: 'couche',
  mode3d: false,
  layoutMode: false,
  message: null,
  drawTarget: null,
  init(site, data) {
    const d: Record<string, FC> = {};
    for (const [k, v] of Object.entries(data)) d[k] = ensureFids(v);
    set({ site, data: d, past: [], future: [], dirtySite: false, dirtyLayers: {}, selectedLayerId: null, selection: null, tool: 'select', saving: 'idle' });
  },
  setTool(t) {
    // la cible de dessin ne vaut que pour l'outil de dessin en cours
    set({ tool: t, drawTarget: t === 'draw-point' || t === 'draw-line' || t === 'draw-polygon' ? get().drawTarget : null });
  },
  selectLayer(id) {
    set({ selectedLayerId: id, rightTab: id ? 'couche' : get().rightTab });
  },
  select(s) {
    set({ selection: s, selectedLayerId: s ? s.layerId : get().selectedLayerId });
  },
  commit(fn, opts) {
    const { site, data } = get();
    if (!site) return;
    const prev: Snapshot = { site, data };
    // copie superficielle : les couches non modifiées restent partagées (mémoire)
    const draft = { site: structuredClone(site), data: { ...data } };
    const r = fn(draft);
    const touched = [...(opts?.touched || []), ...((r && r.touched) || [])];
    for (const id of touched) if (draft.data[id]) draft.data[id] = ensureFids(draft.data[id]);
    // nombre d'objets à jour
    for (const id of touched) {
      const l = draft.site.layers.find((x) => x.id === id);
      if (l && draft.data[id]) l.count = draft.data[id].features.length;
    }
    const dl = { ...get().dirtyLayers };
    for (const id of touched) dl[id] = true;
    set({
      site: draft.site,
      data: draft.data,
      past: [...get().past.slice(-MAX_HISTORY + 1), prev],
      future: [],
      dirtySite: true,
      dirtyLayers: dl,
    });
  },
  patchSite(fn) {
    const { site } = get();
    if (!site) return;
    const s = structuredClone(site);
    fn(s);
    set({ site: s, dirtySite: true });
  },
  undo() {
    const { past, site, data, future } = get();
    if (!past.length || !site) return;
    const prev = past[past.length - 1];
    const dl = { ...get().dirtyLayers };
    for (const k of new Set([...Object.keys(data), ...Object.keys(prev.data)])) if (data[k] !== prev.data[k]) dl[k] = true;
    set({ site: prev.site, data: prev.data, past: past.slice(0, -1), future: [{ site, data }, ...future], dirtySite: true, dirtyLayers: dl, selection: keepSel(get().selection, prev.data) });
  },
  redo() {
    const { past, site, data, future } = get();
    if (!future.length || !site) return;
    const next = future[0];
    const dl = { ...get().dirtyLayers };
    for (const k of new Set([...Object.keys(data), ...Object.keys(next.data)])) if (data[k] !== next.data[k]) dl[k] = true;
    set({ site: next.site, data: next.data, future: future.slice(1), past: [...past, { site, data }], dirtySite: true, dirtyLayers: dl, selection: keepSel(get().selection, next.data) });
  },
  markSaved(ok, err) {
    set({ saving: ok ? 'saved' : 'error', saveError: err });
  },
  setUi(p) {
    set(p as any);
  },
  toast(text, kind = 'info') {
    set({ message: { text, kind } });
    const cur = get().message;
    setTimeout(() => {
      if (get().message === cur) set({ message: null });
    }, kind === 'error' ? 8000 : 4000);
  },
  setLayerData(id, fc) {
    set({ data: { ...get().data, [id]: ensureFids(fc) } });
  },
}));

export function getLayer(id: string): Layer | undefined {
  return useStore.getState().site?.layers.find((l) => l.id === id);
}
