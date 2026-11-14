'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Redo2, Undo2, MousePointer2, Layers as LayersIcon, Moon, Sun, Check, Loader2, AlertTriangle, Keyboard, Search, ChevronDown, CloudCheck, Map as MapIcon } from 'lucide-react';
import { useStore, type Tool } from '@/lib/store';
import { BASEMAPS } from '@/lib/basemaps';
import { isDark, setTheme } from '@/lib/theme';
import ImportButton from './ImportButton';
import { useConfig } from '@/lib/config';
import { TOOLBAR_GROUPS } from './toolbarTools';
import ToolbarExtras from './ToolbarExtras';
import Logo from './ui/Logo';
import { useClickOutside, useEscape } from './ui/hooks';
import { onUi, openUi } from '@/lib/uiEvents';

export function ToolButton({ tool, icon: I, label, k }: { tool: Tool; icon: any; label: string; k?: string }) {
  const cur = useStore((s) => s.tool);
  return (
    <button
      className={`tool-btn ${cur === tool ? 'active' : ''}`}
      data-tip={label}
      data-key={k?.toUpperCase()}
      aria-label={label}
      aria-pressed={cur === tool}
      data-testid={`tool-${tool}`}
      onClick={() => useStore.getState().setTool(cur === tool ? 'select' : tool)}
    >
      <I size={16} />
    </button>
  );
}

/** Pastille de couleur évoquant le fond de carte. */
const BASEMAP_TINT: Record<string, string> = {
  vector: 'linear-gradient(135deg,#f3f1ed 50%,#cfd8dc 50%)',
  labels: 'linear-gradient(135deg,#f4ecd8 50%,#dce9f1 50%)',
  raster: 'linear-gradient(135deg,#5b6b3c 50%,#2f4a5c 50%)',
  sentinel: 'linear-gradient(135deg,#4c6b3c 50%,#8a7a55 50%)',
  relief: 'linear-gradient(135deg,#e9dfc8 50%,#b89f78 50%)',
  plain: 'linear-gradient(135deg,#ffffff 50%,#f7f5f0 50%)',
};

function BasemapMenu() {
  const site = useStore((s) => s.site!);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  useEscape(() => setOpen(false), open);
  useEffect(() => onUi('basemap', () => setOpen(true)), []);
  const set = (fn: (s: any) => void) => useStore.getState().patchSite(fn);
  const hasSentinel = site.layers.some((l) => l.source.name.startsWith('Sentinel-2') && l.raster?.type === 'image');
  const cfg = useConfig((s) => s.cfg);
  const unavailable = (b: (typeof BASEMAPS)[number]) =>
    b.kind === 'sentinel' && !hasSentinel
      ? 'Collectez d’abord l’imagerie Sentinel-2 du site'
      : b.requires === 'arcgis' && !cfg.arcgis
        ? 'Désactivé : renseignez ARCGIS_API_KEY dans .env.local (compte ArcGIS gratuit, voir README)'
        : b.requires === 'noncommercial' && !cfg.noncommercial
          ? 'Désactivé : licence non commerciale, activez ENABLE_NONCOMMERCIAL_SOURCES=true dans .env.local'
          : null;
  const cur = BASEMAPS.find((b) => b.id === site.basemap);
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)} data-testid="basemap-button" data-tip="Fond de carte et relief" aria-haspopup="menu" aria-expanded={open}>
        <LayersIcon size={14} /> <span className="hidden max-w-[130px] truncate 2xl:inline">{cur?.label || 'Fond'}</span>
        <ChevronDown size={12} className="text-zinc-400" />
      </button>
      {open && (
        <div className="popover absolute right-0 top-10 z-40 w-72" role="menu">
          <div className="section-title px-2 pb-1 pt-1">Fond de carte</div>
          {BASEMAPS.map((b) => {
            const why = unavailable(b);
            const dark = (b as any).dark;
            return (
              <button
                key={b.id}
                disabled={!!why}
                role="menuitemradio"
                aria-checked={site.basemap === b.id}
                className={`menu-item ${site.basemap === b.id ? 'font-semibold' : ''}`}
                onClick={() => {
                  set((s) => (s.basemap = b.id));
                  setOpen(false);
                }}
                data-testid={`basemap-${b.id}`}
                title={why || b.attribution}
              >
                <span className="h-5 w-5 shrink-0 rounded border border-zinc-300 dark:border-zinc-600" style={{ background: dark ? 'linear-gradient(135deg,#2a2621 50%,#110f0d 50%)' : BASEMAP_TINT[b.kind] || BASEMAP_TINT.plain }} />
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                {site.basemap === b.id && <Check size={14} className="text-accent-600 dark:text-accent-400" />}
              </button>
            );
          })}
          <div className="section-title mt-1.5 border-t border-zinc-200 px-2 pb-1 pt-2.5 dark:border-zinc-700">Relief en surimpression</div>
          <label className="menu-item">
            <input type="checkbox" checked={!!site.overlays?.hillshade} onChange={(e) => set((s) => (s.overlays = { ...s.overlays, hillshade: e.target.checked }))} /> Ombrage du relief
          </label>
          <label className="menu-item">
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
  const dirty = useStore((s) => s.dirtySite);
  if (saving === 'saving')
    return (
      <span className="flex items-center gap-1 text-[11px] text-zinc-500" data-tip="Enregistrement automatique en cours">
        <Loader2 size={12} className="animate-spin" /> <span className="hidden lg:inline">Enregistrement…</span>
      </span>
    );
  if (saving === 'error')
    return (
      <span className="flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300" data-tip={err || 'L’enregistrement a échoué'}>
        <AlertTriangle size={12} /> Non enregistré
      </span>
    );
  if (saving === 'saved')
    return (
      <span className="flex items-center gap-1 text-[11px] text-zinc-500" data-testid="saved" data-tip="Toutes les modifications sont enregistrées sur le disque">
        <CloudCheck size={13} className="text-emerald-600 dark:text-emerald-500" /> <span className="hidden lg:inline">Enregistré</span>
      </span>
    );
  if (dirty) return <span className="h-1.5 w-1.5 rounded-full bg-amber-500" data-tip="Modifications en attente d’enregistrement" />;
  return null;
}

const SEP = 'ml-1 flex items-center gap-0.5 border-l border-zinc-200 pl-1.5 dark:border-zinc-800';

export default function Toolbar() {
  const site = useStore((s) => s.site!);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const layoutMode = useStore((s) => s.layoutMode);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(isDark());
  }, []);
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const mod = mac ? '⌘' : 'Ctrl';
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-1.5 border-b border-zinc-200 bg-white px-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <Link href="/" className="rounded-md p-0.5 transition hover:opacity-80" title="Accueil" aria-label="Accueil">
        <Logo size={28} />
      </Link>
      <div className="ml-1 min-w-[84px] max-w-[240px] shrink">
        <div className="truncate text-[13.5px] font-semibold leading-tight" title={site.name} data-testid="toolbar-site-name">
          {site.name}
        </div>
        <div className="-mt-px flex h-3.5 items-center">
          <SaveState />
        </div>
      </div>
      <div className={SEP}>
        <button className="tool-btn" disabled={!canUndo} onClick={() => useStore.getState().undo()} data-tip="Annuler" data-key={`${mod} Z`} aria-label="Annuler" data-testid="undo">
          <Undo2 size={16} />
        </button>
        <button className="tool-btn" disabled={!canRedo} onClick={() => useStore.getState().redo()} data-tip="Rétablir" data-key={`${mod} Maj Z`} aria-label="Rétablir" data-testid="redo">
          <Redo2 size={16} />
        </button>
      </div>
      {!layoutMode && (
        <div className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]" role="toolbar" aria-label="Outils de dessin et de mesure">
          <div className={SEP}>
            <ToolButton tool="select" icon={MousePointer2} label="Sélection" k="v" />
          </div>
          {TOOLBAR_GROUPS.map((g, i) => (
            <div key={i} className={SEP}>
              {g.map((t) => (
                <ToolButton key={t.tool} {...t} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
        <button className="btn hidden text-zinc-500 min-[1680px]:inline-flex dark:text-zinc-400" onClick={() => openUi('palette')} aria-label="Rechercher une commande">
          <Search size={13} /> Rechercher… <span className="kbd ml-2">{mod} K</span>
        </button>
        <button className="icon-btn min-[1680px]:hidden" onClick={() => openUi('palette')} data-tip="Rechercher une commande" data-key={`${mod} K`} aria-label="Rechercher une commande">
          <Search size={15} />
        </button>
        {!layoutMode && <ImportButton />}
        <ToolbarExtras />
        {layoutMode ? (
          <button className="btn" onClick={() => useStore.getState().setUi({ layoutMode: false })} data-testid="layout-back">
            <MapIcon size={14} /> Revenir à la carte
          </button>
        ) : (
          <BasemapMenu />
        )}
        <button className="icon-btn" onClick={() => openUi('shortcuts')} data-tip="Raccourcis clavier" data-key="?" aria-label="Aide">
          <Keyboard size={16} />
        </button>
        <button
          className="icon-btn"
          data-tip={dark ? 'Mode clair' : 'Mode sombre'}
          aria-label="Mode sombre"
          onClick={() => {
            setTheme(!dark);
            setDark(!dark);
          }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
