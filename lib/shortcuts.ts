'use client';
import { useStore, type Tool } from './store';
import { openUi } from './uiEvents';
import { zoomToSite } from './mapview';

export const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  i: 'identify',
  p: 'draw-point',
  l: 'draw-line',
  g: 'draw-polygon',
  r: 'draw-rectangle',
  c: 'draw-circle',
  f: 'draw-freehand',
  a: 'draw-arrow',
  t: 'draw-text',
  n: 'draw-marker',
  d: 'draw-dimension',
  m: 'measure-distance',
  s: 'measure-area',
  e: 'edit',
};

const listeners = new Set<(e: KeyboardEvent) => boolean>();
export function onKey(fn: (e: KeyboardEvent) => boolean) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function installShortcuts() {
  const h = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openUi('palette');
      return;
    }
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    for (const l of listeners) if (l(e)) return;
    const st = useStore.getState();
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) st.redo();
      else st.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      st.redo();
      return;
    }
    if (mod || e.altKey) return;
    if (e.key === 'Escape') {
      st.setTool('select');
      st.select(null);
      return;
    }
    // e.code : sur un clavier AZERTY, les chiffres demandent Maj
    if (e.key === '3' || e.code === 'Digit3') {
      if (!st.layoutMode) st.setUi({ mode3d: !st.mode3d });
      return;
    }
    if (e.key === '0' || e.code === 'Digit0') {
      if (!st.layoutMode) zoomToSite();
      return;
    }
    if (e.key === '?') {
      openUi('shortcuts');
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection) {
      const sel = st.selection;
      st.commit(
        (d) => {
          const fc = d.data[sel.layerId];
          if (fc) d.data[sel.layerId] = { ...fc, features: fc.features.filter((f) => f.properties?._fid !== sel.fid) };
        },
        { touched: [sel.layerId] },
      );
      st.select(null);
      return;
    }
    const tool = TOOL_KEYS[e.key.toLowerCase()];
    if (tool && !st.layoutMode) st.setTool(tool);
  };
  window.addEventListener('keydown', h);
  return () => window.removeEventListener('keydown', h);
}
