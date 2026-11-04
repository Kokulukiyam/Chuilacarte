'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Redo2,
  Undo2,
  MousePointer2,
  Upload,
  Layers as LayersIcon,
  Moon,
  Sun,
  Check,
  Loader2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useStore, type Tool } from '@/lib/store';
import { BASEMAPS } from '@/lib/basemaps';
import { isDark, setTheme } from '@/lib/theme';
import ImportButton from './ImportButton';
import { TOOLBAR_GROUPS } from './toolbarTools';

export function ToolButton({ tool, icon: I, label, k }: { tool: Tool; icon: any; label: string; k?: string }) {
  const cur = useStore((s) => s.tool);
  return (
    <button
      className={`tool-btn ${cur === tool ? 'active' : ''}`}
      title={`${label}${k ? ` (${k.toUpperCase()})` : ''}`}
      aria-label={label}
      data-testid={`tool-${tool}`}
      onClick={() => useStore.getState().setTool(cur === tool ? 'select' : tool)}
    >
      <I size={16} />
    </button>
  );
}

function BasemapMenu() {
  const site = useStore((s) => s.site!);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const set = (fn: (s: any) => void) => useStore.getState().patchSite(fn);
  const hasSentinel = site.layers.some((l) => l.source.name.startsWith('Sentinel-2') && l.raster?.type === 'image');
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)} data-testid="basemap-button">
        <LayersIcon size={14} /> {BASEMAPS.find((b) => b.id === site.basemap)?.label || 'Fond'}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-64 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="section-title px-1 pb-1">Fond de carte</div>
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              disabled={b.kind === 'sentinel' && !hasSentinel}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800 ${site.basemap === b.id ? 'font-semibold' : ''}`}
              onClick={() => {
                set((s) => (s.basemap = b.id));
                setOpen(false);
              }}
              data-testid={`basemap-${b.id}`}
              title={b.kind === 'sentinel' && !hasSentinel ? 'Collectez d’abord l’imagerie Sentinel-2 du site' : b.attribution}
            >
              {b.label}
              {site.basemap === b.id && <Check size={14} />}
            </button>
          ))}
          <div className="section-title mt-2 border-t border-zinc-200 px-1 pb-1 pt-2 dark:border-zinc-700">Superpositions</div>
          <label className="flex items-center gap-2 px-2 py-1">
            <input type="checkbox" checked={!!site.overlays?.hillshade} onChange={(e) => set((s) => (s.overlays = { ...s.overlays, hillshade: e.target.checked }))} /> Ombrage du relief
          </label>
          <label className="flex items-center gap-2 px-2 py-1">
            <input type="checkbox" checked={!!site.overlays?.contours} onChange={(e) => set((s) => (s.overlays = { ...s.overlays, contours: e.target.checked }))} /> Courbes de niveau
          </label>
        </div>
      )}
    </div>
  );
}

function SaveState() {
  const saving = useStore((s) => s.saving);
  const err = useStore((s) => s.saveError);
  if (saving === 'saving') return <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Loader2 size={12} className="animate-spin" /> Enregistrement…</span>;
  if (saving === 'error') return <span className="flex items-center gap-1 text-[11px] text-red-600" title={err}><AlertTriangle size={12} /> Non enregistré</span>;
  if (saving === 'saved') return <span className="flex items-center gap-1 text-[11px] text-zinc-500" data-testid="saved"><Check size={12} /> Enregistré</span>;
  return null;
}

export default function Toolbar() {
  const site = useStore((s) => s.site!);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const layoutMode = useStore((s) => s.layoutMode);
  const [dark, setDark] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => setDark(isDark()), []);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Link href="/" className="btn-ghost" title="Accueil">
        <ArrowLeft size={16} />
      </Link>
      <div className="mr-2 max-w-[220px] truncate font-semibold" title={site.name}>
        {site.name}
      </div>
      <div className="flex items-center gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
        <button className="tool-btn" disabled={!canUndo} onClick={() => useStore.getState().undo()} title="Annuler (Ctrl+Z)" aria-label="Annuler" data-testid="undo">
          <Undo2 size={16} />
        </button>
        <button className="tool-btn" disabled={!canRedo} onClick={() => useStore.getState().redo()} title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir" data-testid="redo">
          <Redo2 size={16} />
        </button>
      </div>
      {!layoutMode && (
        <div className="flex items-center gap-0.5 overflow-x-auto border-l border-zinc-200 pl-2 dark:border-zinc-800">
          <ToolButton tool="select" icon={MousePointer2} label="Sélection" k="v" />
          {TOOLBAR_GROUPS.map((g, i) => (
            <div key={i} className="flex items-center gap-0.5 border-l border-zinc-200 pl-1 dark:border-zinc-800">
              {g.map((t) => (
                <ToolButton key={t.tool} {...t} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <SaveState />
        <ToolbarExtras />
        {!layoutMode && <ImportButton />}
        <BasemapMenu />
        <button className="btn-ghost" onClick={() => setHelp(!help)} title="Raccourcis clavier" aria-label="Aide">
          <Info size={16} />
        </button>
        <button
          className="btn-ghost"
          title="Mode sombre"
          aria-label="Mode sombre"
          onClick={() => {
            setTheme(!dark);
            setDark(!dark);
          }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
    </header>
  );
}

import { TOOL_KEYS } from '@/lib/shortcuts';
import { TOOL_LABELS } from './toolbarTools';
import ToolbarExtras from './ToolbarExtras';

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed right-4 top-14 z-50 w-72 rounded-md border border-zinc-200 bg-white p-3 text-[12px] shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={onClose}>
      <div className="section-title mb-2">Raccourcis clavier</div>
      <ul className="space-y-0.5">
        {Object.entries(TOOL_KEYS).map(([k, t]) => (
          <li key={k} className="flex justify-between">
            <span>{TOOL_LABELS[t] || t}</span>
            <span className="kbd">{k.toUpperCase()}</span>
          </li>
        ))}
        <li className="flex justify-between"><span>Annuler / rétablir</span><span className="kbd">Ctrl Z / Ctrl Maj Z</span></li>
        <li className="flex justify-between"><span>Vue 3D</span><span className="kbd">3</span></li>
        <li className="flex justify-between"><span>Supprimer l’objet sélectionné</span><span className="kbd">Suppr</span></li>
        <li className="flex justify-between"><span>Revenir à la sélection</span><span className="kbd">Échap</span></li>
      </ul>
    </div>
  );
}
