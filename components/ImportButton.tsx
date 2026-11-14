'use client';
import { useEffect, useRef, useState } from 'react';
import { onUi } from '@/lib/uiEvents';
import { Loader2, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { makeLayer, userSource } from '@/lib/site';
import type { FC, GeomKind } from '@/lib/types';

export async function importFileToSite(file: File) {
  const st = useStore.getState();
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/import', { method: 'POST', body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `Erreur ${r.status}`);
  const layers: { name: string; fc: FC; geom: GeomKind; warning?: string }[] = j.layers;
  const ids: string[] = [];
  st.commit(
    (d) => {
      for (const l of layers) {
        const layer = makeLayer({
          name: l.name,
          role: 'imported',
          geom: l.geom,
          count: l.fc.features.length,
          source: { ...userSource(`Fichier importé : ${file.name}`), license: 'Selon la source du fichier' },
        });
        d.site.layers.unshift(layer);
        d.data[layer.id] = l.fc;
        ids.push(layer.id);
      }
      return { touched: ids };
    },
  );
  const warn = layers.find((l) => l.warning)?.warning;
  st.toast(`${layers.length} couche(s) importée(s) : ${layers.map((l) => `${l.name} (${l.fc.features.length})`).join(', ')}${warn ? ` — ${warn}` : ''}`, 'ok');
  if (ids[0]) st.selectLayer(ids[0]);
  return ids;
}

export default function ImportButton() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onUi('import', () => ref.current?.click()), []);
  return (
    <>
      <button className="btn" onClick={() => ref.current?.click()} disabled={busy} data-tip="Importer un fichier comme couche : GeoJSON, KML, GeoPackage, Shapefile zippé, DXF, CSV — ou glissez-le sur la carte" data-testid="import-layer">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} <span className="hidden min-[1400px]:inline">Importer</span>
      </button>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept=".geojson,.json,.kml,.kmz,.gpkg,.zip,.dxf,.csv"
        data-testid="import-layer-input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            await importFileToSite(f);
          } catch (x: any) {
            useStore.getState().toast(x.message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
