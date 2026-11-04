'use client';
import { useEffect, useRef, useState } from 'react';
import { Columns2, Loader2, Plus, X } from 'lucide-react';
import type { Map as MlMap } from 'maplibre-gl';
import { useStore } from '@/lib/store';
import { upsertCollected } from '@/lib/layerops';
import { createMap } from '@/lib/mapbase';
import { plainStyle, absUrl } from '@/lib/basemaps';
import { mapRef } from '@/lib/mapref';
import type { Layer } from '@/lib/types';

interface Item {
  id: string;
  date: string;
  cloud: number;
  covers: boolean;
}

export default function ImageryPanel() {
  const site = useStore((s) => s.site!);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const s2 = site.layers.filter((l) => l.raster?.type === 'image' && l.source.name.startsWith('Sentinel-2'));
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');

  const search = async () => {
    setBusy('search');
    setErr(null);
    try {
      const r = await fetch(`/api/sites/${site.slug}/sentinel?months=36&cloud=20`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setItems(j);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const add = async (it: Item) => {
    setBusy(it.id);
    setErr(null);
    try {
      const r = await fetch(`/api/sites/${site.slug}/sentinel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: it }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      useStore.getState().commit((d) => upsertCollected(d, j));
      useStore.getState().toast(`Image du ${it.date} ajoutée`, 'ok');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="section-title mb-1">Imagerie Sentinel-2</div>
      <p className="mb-2 text-[11px] text-zinc-500">{s2.length} image(s) dans le site. Ajoutez d’autres dates pour comparer l’évolution du site.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={search} disabled={!!busy} data-testid="s2-search">
          {busy === 'search' ? <Loader2 size={13} className="animate-spin" /> : null} Chercher des dates
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
      {items && (
        <ul className="mt-2 max-h-48 overflow-y-auto text-[12px]">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between border-b border-zinc-100 py-0.5 dark:border-zinc-800">
              <span>
                {new Date(it.date).toLocaleDateString('fr-FR')} · {it.cloud} % nuages {!it.covers && <span className="text-amber-600" title="L’image ne couvre pas tout le site">(partielle)</span>}
              </span>
              <button className="btn-ghost" onClick={() => add(it)} disabled={!!busy} title="Ajouter cette date comme couche" data-testid="s2-add">
                {busy === it.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            </li>
          ))}
          {!items.length && <li className="text-zinc-500">Aucune image trouvée.</li>}
        </ul>
      )}
      {s2.length >= 2 && (
        <div className="mt-3 space-y-1">
          <div className="text-[12px] font-medium">Comparer deux dates côte à côte</div>
          <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Image de gauche…</option>
            {s2.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Image de droite…</option>
            {s2.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="btn" disabled={!a || !b || a === b} onClick={() => setCompare([a, b])} data-testid="s2-compare">
            <Columns2 size={13} /> Comparer
          </button>
        </div>
      )}
      {compare && <CompareView left={s2.find((l) => l.id === compare[0])!} right={s2.find((l) => l.id === compare[1])!} onClose={() => setCompare(null)} />}
    </div>
  );
}

function imageStyle(slug: string, l: Layer) {
  const st = plainStyle('#e7e5e4');
  const bb = l.raster!.bounds!;
  st.sources.img = {
    type: 'image',
    url: absUrl(`/api/sites/${slug}/${l.raster!.url}`),
    coordinates: [
      [bb[0], bb[3]],
      [bb[2], bb[3]],
      [bb[2], bb[1]],
      [bb[0], bb[1]],
    ],
  } as any;
  st.layers.push({ id: 'img', type: 'raster', source: 'img' });
  return st;
}

/** Deux cartes synchronisées, côte à côte. */
export function CompareView({ left, right, onClose }: { left: Layer; right: Layer; onClose: () => void }) {
  const slug = useStore((s) => s.site!.slug);
  const e1 = useRef<HTMLDivElement>(null);
  const e2 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = mapRef.map;
    const view = m ? { center: m.getCenter(), zoom: m.getZoom() } : { center: useStore.getState().site!.center as any, zoom: 15 };
    const a: MlMap = createMap(e1.current!, { ...view, style: imageStyle(slug, left) } as any);
    const b: MlMap = createMap(e2.current!, { ...view, style: imageStyle(slug, right) } as any);
    let lock = false;
    const sync = (src: MlMap, dst: MlMap) => () => {
      if (lock) return;
      lock = true;
      dst.jumpTo({ center: src.getCenter(), zoom: src.getZoom(), bearing: src.getBearing() });
      lock = false;
    };
    a.on('move', sync(a, b));
    b.on('move', sync(b, a));
    return () => {
      a.remove();
      b.remove();
    };
  }, [left, right, slug]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-6" role="dialog" aria-label="Comparaison d’images">
      <div className="flex items-center justify-between rounded-t-lg bg-white px-4 py-2 dark:bg-zinc-900">
        <div className="flex flex-1 text-[13px] font-medium">
          <span className="flex-1">{left.name}</span>
          <span className="flex-1 pl-4">{right.name}</span>
        </div>
        <button className="btn-ghost" onClick={onClose} aria-label="Fermer">
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 gap-1 rounded-b-lg bg-white p-1 dark:bg-zinc-900">
        <div className="relative flex-1">
          <div className="absolute inset-0">
            <div ref={e1} className="h-full w-full" />
          </div>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0">
            <div ref={e2} className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
