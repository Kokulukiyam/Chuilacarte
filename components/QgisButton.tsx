'use client';
import { useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { flushNow } from '@/lib/autosave';
import { download, keepCopy } from '@/lib/layout/export';

export async function exportQgis() {
  const site = useStore.getState().site!;
  await flushNow();
  const r = await fetch(`/api/sites/${site.slug}/qgis`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  const blob = await r.blob();
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'qgis.zip';
  download(blob, name);
  await keepCopy(site, name, blob);
  return name;
}

export default function QgisButton() {
  const [busy, setBusy] = useState(false);
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  return (
    <button
      className="btn"
      disabled={busy}
      data-testid="export-qgis"
      title="Dossier QGIS : GeoPackage de toutes les couches (UTM du site) + projet .qgs stylé + fond XYZ"
      onClick={async () => {
        setBusy(true);
        try {
          const n = await exportQgis();
          useStore.getState().toast(`Dossier QGIS exporté : ${n} (décompressez puis ouvrez le fichier .qgs)`, 'ok');
        } catch (e: any) {
          useStore.getState().toast(`Échec de l’export QGIS : ${e.message}`, 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} QGIS
    </button>
  );
}
