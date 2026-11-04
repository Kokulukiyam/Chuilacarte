'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, FileStack, Loader2, Printer } from 'lucide-react';
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
    <button className="btn" onClick={() => useStore.getState().setUi({ layoutMode: true })} data-testid="layout-open" title="Mise en page et exports de qualité">
      <Printer size={14} /> Mise en page
    </button>
  );
}

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const layoutMode = useStore((s) => s.layoutMode);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (layoutMode) return null;
  const run = async (f: 'geojson' | 'gpkg' | 'dxf') => {
    setBusy(f);
    try {
      const n = await exportData(f);
      useStore.getState().toast(`Export : ${n}`, 'ok');
    } catch (e: any) {
      useStore.getState().toast(`Échec de l’export : ${e.message}`, 'error');
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen(!open)} data-testid="export-menu">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exporter
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-72 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="section-title px-1 pb-1">Couches visibles</div>
          <button className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => run('gpkg')} data-testid="export-gpkg">
            <FileStack size={13} className="mr-1 inline" /> GeoPackage <span className="text-[11px] text-zinc-500">(UTM du site, styles QGIS inclus)</span>
          </button>
          <button className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => run('geojson')} data-testid="export-geojson">
            <FileStack size={13} className="mr-1 inline" /> GeoJSON <span className="text-[11px] text-zinc-500">(WGS84, une couche par fichier, zip)</span>
          </button>
          <button className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => run('dxf')} data-testid="export-dxf">
            <FileStack size={13} className="mr-1 inline" /> DXF AutoCAD <span className="text-[11px] text-zinc-500">(mètres, UTM du site)</span>
          </button>
          <div className="section-title mt-2 border-t border-zinc-200 px-1 pb-1 pt-2 dark:border-zinc-700">Carte</div>
          <button className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => useStore.getState().setUi({ layoutMode: true })}>
            <Printer size={13} className="mr-1 inline" /> PNG 300 dpi, PDF, SVG → mise en page
          </button>
          <p className="px-2 pt-1 text-[11px] text-zinc-500">Le filtre attributaire de chaque couche est appliqué.</p>
        </div>
      )}
    </div>
  );
}
