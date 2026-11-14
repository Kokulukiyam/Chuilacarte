'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, DownloadCloud, Download, Eye, EyeOff, Focus, Home, Keyboard, Layers, Map as MapIcon, Moon, MousePointer2, PanelRight, Printer, Redo2, Search, Undo2, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { BASEMAPS } from '@/lib/basemaps';
import { TOOL_KEYS } from '@/lib/shortcuts';
import { isDark, setTheme } from '@/lib/theme';
import { openUi } from '@/lib/uiEvents';
import { zoomToSite } from '@/lib/mapview';
import { ALL_TOOLS } from './toolbarTools';
import { zoomToLayer } from './LayersPanel';
import { RIGHT_TABS } from './rightTabs';
import { useEscape } from './ui/hooks';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: any;
  k?: string;
  run: () => void;
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palette de commandes (Ctrl/⌘ K) : outils, actions, fonds de carte et couches, au clavier. */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const router = useRouter();
  const site = useStore((s) => s.site!);
  const layoutMode = useStore((s) => s.layoutMode);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const cmds = useMemo(() => {
    const st = useStore.getState;
    const keyOf = (tool: string) => Object.entries(TOOL_KEYS).find(([, t]) => t === tool)?.[0].toUpperCase();
    const out: Cmd[] = [];
    if (!layoutMode) {
      out.push({ id: 'collect', group: 'Actions', label: 'Collecter les données du site', icon: DownloadCloud, run: () => openUi('collect') });
      out.push({ id: 'import', group: 'Actions', label: 'Importer un fichier comme couche', hint: 'GeoJSON, KML, GeoPackage, Shapefile, DXF, CSV', icon: Upload, run: () => openUi('import') });
      out.push({ id: 'layout', group: 'Actions', label: 'Ouvrir la mise en page', hint: 'Planches PNG, PDF, SVG', icon: Printer, run: () => st().setUi({ layoutMode: true }) });
      out.push({ id: 'export', group: 'Actions', label: 'Exporter les données…', hint: 'GeoPackage, GeoJSON, DXF, QGIS', icon: Download, run: () => openUi('export') });
      out.push({ id: 'fit', group: 'Actions', label: 'Recadrer la carte sur le site', icon: Focus, k: '0', run: () => zoomToSite() });
      out.push({ id: '3d', group: 'Actions', label: st().mode3d ? 'Revenir à la vue en plan' : 'Passer en vue 3D', icon: Box, k: '3', run: () => st().setUi({ mode3d: !st().mode3d }) });
    } else {
      out.push({ id: 'layout-close', group: 'Actions', label: 'Fermer la mise en page', icon: MapIcon, run: () => st().setUi({ layoutMode: false }) });
    }
    out.push({ id: 'undo', group: 'Actions', label: 'Annuler', icon: Undo2, run: () => st().undo() });
    out.push({ id: 'redo', group: 'Actions', label: 'Rétablir', icon: Redo2, run: () => st().redo() });
    out.push({ id: 'theme', group: 'Actions', label: isDark() ? 'Passer en mode clair' : 'Passer en mode sombre', icon: Moon, run: () => setTheme(!isDark()) });
    out.push({ id: 'keys', group: 'Actions', label: 'Voir les raccourcis clavier', icon: Keyboard, k: '?', run: () => openUi('shortcuts') });
    out.push({ id: 'home', group: 'Actions', label: 'Revenir à la liste des sites', icon: Home, run: () => router.push('/') });
    if (!layoutMode) {
      out.push({ id: 'tool-select', group: 'Outils', label: 'Sélection', icon: MousePointer2, k: 'V', run: () => st().setTool('select') });
      for (const t of ALL_TOOLS) out.push({ id: `tool-${t.tool}`, group: 'Outils', label: t.label, icon: t.icon, k: keyOf(t.tool), run: () => st().setTool(t.tool) });
      for (const t of [{ id: 'couche', label: 'Couche' }, ...RIGHT_TABS, { id: 'site', label: 'Site' }])
        out.push({ id: `tab-${t.id}`, group: 'Panneaux', label: `Panneau « ${t.label} »`, icon: PanelRight, run: () => st().setUi({ rightTab: t.id as any }) });
      for (const b of BASEMAPS)
        if (!(b as any).requires && b.kind !== 'sentinel')
          out.push({ id: `bm-${b.id}`, group: 'Fonds de carte', label: b.label, hint: site.basemap === b.id ? 'fond actuel' : undefined, icon: Layers, run: () => st().patchSite((s) => void (s.basemap = b.id)) });
      for (const l of site.layers) {
        out.push({ id: `layer-${l.id}`, group: 'Couches', label: l.name, hint: 'sélectionner et zoomer', icon: Focus, run: () => (st().selectLayer(l.id), zoomToLayer(l.id)) });
        out.push({
          id: `vis-${l.id}`,
          group: 'Couches',
          label: `${l.visible ? 'Masquer' : 'Afficher'} « ${l.name} »`,
          icon: l.visible ? EyeOff : Eye,
          run: () => st().commit((d) => void (d.site.layers.find((x) => x.id === l.id)!.visible = !l.visible)),
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.layers, site.basemap, layoutMode]);

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return cmds.filter((c) => c.group !== 'Couches' && c.group !== 'Fonds de carte');
    return cmds.filter((c) => words.every((w) => norm(`${c.label} ${c.group} ${c.hint || ''}`).includes(w))).slice(0, 60);
  }, [cmds, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const run = (c?: Cmd) => {
    if (!c) return;
    onClose();
    c.run();
  };
  let lastGroup = '';
  return (
    <div className="modal-backdrop items-start pt-[12vh]" role="dialog" aria-modal="true" aria-label="Palette de commandes" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-testid="command-palette">
      <div className="modal w-[min(560px,96vw)]">
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search size={16} className="shrink-0 text-zinc-400" />
          <input
            autoFocus
            className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-zinc-400"
            placeholder="Outil, action, couche, fond de carte…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(shown.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(shown[idx]);
              }
            }}
            aria-label="Rechercher une commande"
            data-testid="command-input"
          />
          <span className="kbd shrink-0">Échap</span>
        </div>
        <div ref={list} className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
          {shown.length === 0 && <p className="hint px-3 py-6 text-center">Aucune commande ne correspond à « {q} ».</p>}
          {shown.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const I = c.icon;
            return (
              <div key={c.id}>
                {head && <div className="section-title px-2.5 pb-1 pt-2">{head}</div>}
                <button
                  role="option"
                  aria-selected={i === idx}
                  data-active={i === idx}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] ${i === idx ? 'bg-accent-50 text-accent-900 dark:bg-accent-900/30 dark:text-accent-50' : ''}`}
                  onMouseMove={() => idx !== i && setIdx(i)}
                  onClick={() => run(c)}
                >
                  <I size={15} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="hint shrink-0">{c.hint}</span>}
                  {c.k && <span className="kbd shrink-0">{c.k}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-zinc-200 px-4 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> naviguer
          </span>
          <span>
            <span className="kbd">Entrée</span> lancer
          </span>
          <span className="ml-auto">Tapez un nom de couche pour la retrouver</span>
        </div>
      </div>
    </div>
  );
}
