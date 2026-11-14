'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
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
import LayoutEditor from './LayoutEditor';
import { useConfig } from '@/lib/config';
import '@/lib/annotate';
import '@/lib/edit';
import '@/lib/analysisTools';
import '@/lib/projectTools';
import { AnnotationBar } from './AnnotationProps';
import Dialogs from './ui/Dialogs';
import Tooltips from './ui/Tooltips';
import Logo from './ui/Logo';
import StatusBar from './StatusBar';
import ToolHint from './ToolHint';
import MapContextMenu from './MapContextMenu';
import ShortcutsDialog from './ShortcutsDialog';
import CommandPalette from './CommandPalette';
import { importFileToSite } from './ImportButton';
import { onUi } from '@/lib/uiEvents';

/** Écran d'attente : la silhouette de l'espace de travail, pour éviter le saut à l'affichage. */
function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col overflow-hidden" aria-busy="true" aria-label="Chargement du site">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <Logo size={28} />
        <div className="skeleton h-4 w-36" />
        <div className="skeleton ml-6 h-6 w-80" />
        <div className="skeleton ml-auto h-7 w-72" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[270px] shrink-0 space-y-2.5 border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {[70, 85, 60, 75, 90, 55, 80, 65].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-zinc-950">Chargement du site…</div>
        <div className="w-[340px] shrink-0 border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export default function Workspace({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const ready = useStore((s) => !!s.site && s.site.slug === slug);
  const layoutMode = useStore((s) => s.layoutMode);
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [shortcuts, setShortcuts] = useState(false);
  const [palette, setPalette] = useState(false);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);

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
    useConfig.getState().load();
    const stop = startAutosave();
    const stopKeys = installShortcuts();
    const offShortcuts = onUi('shortcuts', () => setShortcuts(true));
    const offPalette = onUi('palette', () => setPalette((p) => !p));
    const before = () => {
      flushNow();
    };
    window.addEventListener('beforeunload', before);
    return () => {
      cancelled = true;
      stop();
      stopKeys();
      offShortcuts();
      offPalette();
      window.removeEventListener('beforeunload', before);
      flushNow();
      saveThumbnail(slug);
    };
  }, [slug]);

  if (error)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo size={40} />
        <div>
          <p className="font-display text-xl font-bold">Ce site ne s’ouvre pas</p>
          <p className="mt-1 max-w-md text-zinc-600 dark:text-zinc-400">{error}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => location.reload()}>
            Réessayer
          </button>
          <a className="btn-primary" href="/">
            Retour à l’accueil
          </a>
        </div>
      </div>
    );
  if (!ready) return <LoadingScreen />;

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const onDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    if (layoutMode) return;
    for (const f of Array.from(e.dataTransfer.files)) {
      try {
        await importFileToSite(f);
      } catch (x: any) {
        useStore.getState().toast(`${f.name} : ${x.message}`, 'error');
      }
    }
  };

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      onDragEnter={(e) => {
        if (!hasFiles(e) || layoutMode) return;
        dragDepth.current++;
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        if (--dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDropping(false);
        }
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={onDrop}
    >
      <Toolbar />
      <div className="relative flex min-h-0 flex-1">
        {!layoutMode && left && <LayersPanel />}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MapView />
            <AnnotationBar />
            {!layoutMode && <ToolHint />}
            {!layoutMode && <MapContextMenu />}
          </div>
          <BottomPanel />
          <StatusBar left={left} right={right} onToggleLeft={() => setLeft(!left)} onToggleRight={() => setRight(!right)} />
        </div>
        {right && <RightPanel />}
        {layoutMode && <LayoutEditor />}
      </div>
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center bg-accent-600/15 p-10 backdrop-blur-[1px]" data-testid="drop-zone">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent-600 bg-white/95 px-12 py-9 text-center shadow-modal dark:border-accent-400 dark:bg-zinc-900/95">
            <Upload size={28} className="text-accent-600 dark:text-accent-400" />
            <p className="text-[15px] font-semibold">Déposez pour importer comme couche</p>
            <p className="hint">GeoJSON, KML/KMZ, GeoPackage, Shapefile zippé, DXF, CSV</p>
          </div>
        </div>
      )}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <Dialogs />
      <Tooltips />
      <Toast />
    </div>
  );
}
