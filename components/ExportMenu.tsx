'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Download, FileBox, FileJson, FolderOpen, Loader2, PencilRuler, Printer } from 'lucide-react';
import { exportQgis } from './QgisButton';
import { useClickOutside, useEscape } from './ui/hooks';
import { onUi } from '@/lib/uiEvents';
import { useStore } from '@/lib/store';
import { flushNow } from '@/lib/autosave';
import { download, keepCopy } from '@/lib/layout/export';

export async function exportData(format: 'geojson' | 'gpkg' | 'dxf') {
  const st = useStore.getState();
  const site = st.site!;
  await flushNow();
  const r = await fetch(`/api/sites/${site.slug}/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  const blob = await r.blob();
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || `export.${format}`;
  download(blob, name);
  await keepCopy(site, name, blob);
  return name;
}

export function LayoutButton() {
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  return (
    <button className="btn-primary" onClick={() => useStore.getState().setUi({ layoutMode: true })} data-testid="layout-open" data-tip="Composer une planche à l’échelle et l’exporter en PNG, PDF ou SVG">
      <Printer size={14} /> <span className="hidden lg:inline">Mise en page</span>
    </button>
  );
}

type Fmt = 'geojson' | 'gpkg' | 'dxf' | 'qgis';

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Fmt | null>(null);
  const layoutMode = useStore((s) => s.layoutMode);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  useEscape(() => setOpen(false), open);
  useEffect(() => onUi('export', () => setOpen(true)), []);
  if (layoutMode) return null;
  const run = async (f: Fmt) => {
    setBusy(f);
    setOpen(false);
    const st = useStore.getState();
    try {
      if (f === 'qgis') st.toast(`Dossier QGIS exporté : ${await exportQgis()} (décompressez puis ouvrez le fichier .qgs)`, 'ok');
      else st.toast(`Export : ${await exportData(f)}`, 'ok');
    } catch (e: any) {
      st.toast(`Échec de l’export${f === 'qgis' ? ' QGIS' : ''} : ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };
  const Item = ({ f, icon: I, title, sub }: { f: Fmt; icon: any; title: string; sub: string }) => (
    <button className="menu-item items-start" role="menuitem" onClick={() => run(f)} disabled={!!busy} data-testid={`export-${f}`}>
      <I size={15} className="mt-0.5 shrink-0 text-zinc-500" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="hint block">{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)} data-testid="export-menu" data-tip="Exporter les données ou la carte" aria-haspopup="menu" aria-expanded={open}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} <span className="hidden min-[1400px]:inline">{busy ? 'Export…' : 'Exporter'}</span>
        <ChevronDown size={12} className="text-zinc-400" />
      </button>
      {open && (
        <div className="popover absolute right-0 top-10 z-40 w-80" role="menu">
          <div className="section-title px-2 pb-1 pt-1">Données · couches visibles</div>
          <Item f="gpkg" icon={FileBox} title="GeoPackage" sub="UTM du site, styles QGIS inclus" />
          <Item f="geojson" icon={FileJson} title="GeoJSON" sub="WGS84, une couche par fichier (zip)" />
          <Item f="dxf" icon={PencilRuler} title="DXF pour AutoCAD" sub="En mètres, UTM du site" />
          <div className="section-title mt-1.5 border-t border-zinc-200 px-2 pb-1 pt-2.5 dark:border-zinc-700">Projet complet</div>
          <Item f="qgis" icon={FolderOpen} title="Dossier QGIS" sub="Toutes les couches + projet .qgs stylé + fond XYZ" />
          <div className="section-title mt-1.5 border-t border-zinc-200 px-2 pb-1 pt-2.5 dark:border-zinc-700">Carte</div>
          <button className="menu-item items-start" role="menuitem" onClick={() => (setOpen(false), useStore.getState().setUi({ layoutMode: true }))}>
            <Printer size={15} className="mt-0.5 shrink-0 text-zinc-500" />
            <span>
              <span className="block font-medium">Planche à l’échelle</span>
              <span className="hint block">PNG 300 dpi, PDF vectoriel, SVG — via la mise en page</span>
            </span>
          </button>
          <p className="hint px-2 pb-1 pt-1.5">Le filtre attributaire de chaque couche est appliqué.</p>
        </div>
      )}
    </div>
  );
}
