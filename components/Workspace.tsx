'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { flushNow, startAutosave, saveThumbnail } from '@/lib/autosave';
import type { FC, Site } from '@/lib/types';
import MapView from './MapView';
import Toolbar from './Toolbar';
import LayersPanel from './LayersPanel';
import RightPanel from './RightPanel';
import Toast from './Toast';
import { installShortcuts } from '@/lib/shortcuts';
import BottomPanel from './BottomPanel';

export default function Workspace({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const ready = useStore((s) => !!s.site && s.site.slug === slug);
  const layoutMode = useStore((s) => s.layoutMode);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const site = await api<Site>(`/api/sites/${slug}`);
        const data: Record<string, FC> = {};
        await Promise.all(
          site.layers
            .filter((l) => l.kind === 'vector')
            .map(async (l) => {
              data[l.id] = await api<FC>(`/api/sites/${slug}/layers/${l.id}`).catch(() => ({ type: 'FeatureCollection', features: [] }) as FC);
            }),
        );
        if (!cancelled) {
          useStore.getState().init(site, data);
          document.title = `${site.name} — Chuilacarte`;
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    })();
    const stop = startAutosave();
    const stopKeys = installShortcuts();
    const before = () => {
      flushNow();
    };
    window.addEventListener('beforeunload', before);
    return () => {
      cancelled = true;
      stop();
      stopKeys();
      window.removeEventListener('beforeunload', before);
      flushNow();
      saveThumbnail(slug);
    };
  }, [slug]);

  if (error)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-red-600">{error}</p>
        <a className="btn" href="/">
          Retour à l’accueil
        </a>
      </div>
    );
  if (!ready) return <div className="flex h-screen items-center justify-center text-zinc-500">Chargement du site…</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {!layoutMode && <LayersPanel />}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MapView />
          </div>
          <BottomPanel />
        </div>
        <RightPanel />
      </div>
      <Toast />
    </div>
  );
}
