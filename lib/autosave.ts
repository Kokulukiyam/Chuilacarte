'use client';
import { useStore } from './store';
import { mapRef } from './mapref';

let timer: any = null;
let running = false;
let lastThumb = 0;

async function flush() {
  if (running) return;
  const st = useStore.getState();
  const site = st.site;
  if (!site || (!st.dirtySite && !Object.keys(st.dirtyLayers).length)) return;
  running = true;
  const layers = Object.keys(st.dirtyLayers);
  const dataRefs = layers.map((id) => [id, st.data[id]] as const);
  useStore.setState({ dirtySite: false, dirtyLayers: {}, saving: 'saving' });
  try {
    // les couches d'abord, puis site.json qui les référence
    for (const [id, fc] of dataRefs) {
      const exists = site.layers.some((l) => l.id === id);
      if (!exists) {
        await fetch(`/api/sites/${site.slug}/layers/${id}`, { method: 'DELETE' });
        continue;
      }
      if (!fc) continue;
      const r = await fetch(`/api/sites/${site.slug}/layers/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fc) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `couche ${id} : ${r.status}`);
    }
    const r = await fetch(`/api/sites/${site.slug}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(useStore.getState().site) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `site : ${r.status}`);
    useStore.getState().markSaved(true);
    if (Date.now() - lastThumb > 60000) {
      lastThumb = Date.now();
      saveThumbnail(site.slug);
    }
  } catch (e: any) {
    // on remet les drapeaux pour retenter
    const cur = useStore.getState();
    const dl = { ...cur.dirtyLayers };
    for (const id of layers) dl[id] = true;
    useStore.setState({ dirtySite: true, dirtyLayers: dl });
    useStore.getState().markSaved(false, e.message);
  } finally {
    running = false;
    const s2 = useStore.getState();
    if (s2.dirtySite || Object.keys(s2.dirtyLayers).length) schedule(2000);
  }
}

export function schedule(ms = 800) {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

export function flushNow() {
  clearTimeout(timer);
  return flush();
}

export function saveThumbnail(slug: string) {
  const map = mapRef.map;
  if (!map) return;
  try {
    const src = map.getCanvas();
    const c = document.createElement('canvas');
    const w = 480;
    const h = 300;
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    const r = Math.max(w / src.width, h / src.height);
    const sw = w / r;
    const sh = h / r;
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
    c.toBlob((b) => {
      if (b) fetch(`/api/sites/${slug}/thumbnail`, { method: 'PUT', body: b }).catch(() => {});
    }, 'image/png');
  } catch {
    /* canevas indisponible */
  }
}

export function startAutosave() {
  return useStore.subscribe((s, prev) => {
    if (s.site !== prev.site || s.data !== prev.data) {
      if (s.dirtySite || Object.keys(s.dirtyLayers).length) schedule();
    }
  });
}
