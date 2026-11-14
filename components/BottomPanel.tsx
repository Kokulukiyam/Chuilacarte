'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, X, Filter, Download, Search } from 'lucide-react';
import * as turf from '@turf/turf';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import { matchAll } from '@/lib/filters';
import { fmtNum, metricArea, metricLength } from '@/lib/proj';

const PAGE = 200;

/** Table attributaire de la couche sélectionnée. */
export default function BottomPanel() {
  const [layerId, setLayerId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const [onlyFiltered, setOnlyFiltered] = useState(true);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [height, setHeight] = useState(280);
  const layer = useStore((s) => s.site!.layers.find((l) => l.id === layerId));
  const fc = useStore((s) => (layerId ? s.data[layerId] : undefined));
  const sel = useStore((s) => s.selection);
  const utm = useStore((s) => s.site!.utm);

  useEffect(() => {
    const h = (e: any) => {
      setLayerId(e.detail);
      setPage(0);
      setSort(null);
    };
    window.addEventListener('chuilacarte-table', h);
    return () => window.removeEventListener('chuilacarte-table', h);
  }, []);

  const cols = useMemo(() => {
    const s = new Set<string>();
    for (const f of fc?.features.slice(0, 2000) || []) for (const k of Object.keys(f.properties || {})) if (!k.startsWith('_')) s.add(k);
    return [...s];
  }, [fc]);

  const rows = useMemo(() => {
    let r = fc?.features || [];
    if (onlyFiltered && layer?.filter?.length) r = r.filter((f) => matchAll(f.properties || {}, layer.filter));
    if (q.trim()) {
      const qq = q.toLowerCase();
      r = r.filter((f) => Object.values(f.properties || {}).some((v) => String(v ?? '').toLowerCase().includes(qq)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const va = a.properties?.[sort.k];
        const vb = b.properties?.[sort.k];
        const na = Number(va);
        const nb = Number(vb);
        if (va === undefined || va === null || va === '') return 1;
        if (vb === undefined || vb === null || vb === '') return -1;
        if (Number.isFinite(na) && Number.isFinite(nb)) return (na - nb) * sort.dir;
        return String(va).localeCompare(String(vb), 'fr') * sort.dir;
      });
    }
    return r;
  }, [fc, sort, onlyFiltered, layer?.filter, q]);

  if (!layerId || !layer || layer.kind !== 'vector') return null;
  const geomKind = layer.geom;
  const setCell = (fid: string, k: string, v: string, old: any) => {
    const n = Number(v);
    const val = v !== '' && Number.isFinite(n) && typeof old === 'number' ? n : v;
    useStore.getState().commit(
      (d) => {
        const c = d.data[layerId];
        d.data[layerId] = { ...c, features: c.features.map((f) => (f.properties?._fid === fid ? { ...f, properties: { ...f.properties, [k]: val } } : f)) };
      },
      { touched: [layerId] },
    );
  };
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = height;
    const move = (ev: MouseEvent) => setHeight(Math.max(140, Math.min(window.innerHeight - 220, h0 + y0 - ev.clientY)));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  /** Les lignes affichées (filtre, recherche et tri compris), en CSV lisible par un tableur français. */
  const exportCsv = () => {
    const cell = (v: any) => {
      const t = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const extra = geomKind === 'polygon' ? ['surface_m2'] : geomKind === 'line' ? ['longueur_m'] : [];
    const lines = [[...cols, ...extra].map(cell).join(';')];
    for (const f of rows) {
      const m = geomKind === 'polygon' ? [Math.round(metricArea(utm, f.geometry) * 10) / 10] : geomKind === 'line' ? [Math.round(metricLength(utm, f.geometry) * 10) / 10] : [];
      lines.push([...cols.map((c) => f.properties?.[c]), ...m].map(cell).join(';'));
    }
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${layer.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'couche'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    useStore.getState().toast(`${rows.length} ligne${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''} en CSV`, 'ok');
  };
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.ceil(rows.length / PAGE);
  return (
    <div className="relative flex shrink-0 flex-col border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ height }} data-testid="attribute-table">
      <div className="absolute inset-x-0 -top-1 z-20 h-2 cursor-row-resize hover:bg-accent-500/30" onMouseDown={startResize} role="separator" aria-orientation="horizontal" aria-label="Hauteur de la table" />
      <div className="flex items-center gap-3 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <span className="max-w-[260px] truncate font-semibold">{layer.name}</span>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {rows.length} / {fc?.features.length || 0} objets
        </span>
        <span className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="input w-52 py-0.5 pl-7" placeholder="Rechercher dans la table…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
        </span>
        {layer.filter?.length > 0 && (
          <label className="flex items-center gap-1 text-[12px]">
            <input type="checkbox" checked={onlyFiltered} onChange={(e) => setOnlyFiltered(e.target.checked)} />
            <Filter size={12} /> Respecter le filtre
          </label>
        )}
        {pages > 1 && (
          <span className="flex items-center gap-1 text-[12px]">
            <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹
            </button>
            page {page + 1}/{pages}
            <button className="btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              ›
            </button>
          </span>
        )}
        <button className="btn-ghost ml-auto py-0.5 text-[12px]" onClick={exportCsv} disabled={!rows.length} data-tip="Télécharger les lignes affichées (point-virgule, UTF-8, pour Excel ou LibreOffice)" data-testid="table-csv">
          <Download size={13} /> CSV
        </button>
        <button className="icon-btn h-6 w-6" onClick={() => setLayerId(null)} aria-label="Fermer la table">
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="data">
          <thead>
            <tr>
              <th className="w-10">#</th>
              {cols.map((c) => (
                <th key={c} className="cursor-pointer select-none whitespace-nowrap" onClick={() => setSort(sort?.k === c ? { k: c, dir: sort.dir === 1 ? -1 : 1 } : { k: c, dir: 1 })}>
                  <span className="inline-flex items-center gap-0.5">
                    {c} {sort?.k === c && (sort.dir === 1 ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </span>
                </th>
              ))}
              {geomKind === 'polygon' && <th className="whitespace-nowrap text-right">surface (m²)</th>}
              {geomKind === 'line' && <th className="whitespace-nowrap text-right">longueur (m)</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="hint py-6 text-center">
                  {fc?.features.length ? 'Aucune ligne ne correspond.' : 'Cette couche ne contient aucun objet.'}
                </td>
              </tr>
            )}
            {pageRows.map((f, i) => {
              const fid = f.properties?._fid;
              const selected = sel?.layerId === layerId && sel.fid === fid;
              return (
                <tr
                  key={fid || i}
                  className={`cursor-pointer ${selected ? 'bg-accent-50 dark:bg-accent-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  onClick={() => {
                    useStore.getState().select({ layerId, fid });
                    try {
                      const bb = turf.bbox(f as any);
                      mapRef.map?.fitBounds(bb as any, { padding: 120, maxZoom: 18.5, duration: 400 });
                    } catch {
                      /* rien */
                    }
                  }}
                >
                  <td className="text-zinc-400">{page * PAGE + i + 1}</td>
                  {cols.map((c) => (
                    <td key={c} className="max-w-[220px]">
                      <input
                        key={`${fid}-${c}-${String(f.properties?.[c] ?? '')}`}
                        className="w-full min-w-[60px] truncate bg-transparent outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800"
                        defaultValue={f.properties?.[c] === null || f.properties?.[c] === undefined ? '' : String(f.properties[c])}
                        onBlur={(e) => {
                          const old = f.properties?.[c];
                          if (e.target.value !== (old === null || old === undefined ? '' : String(old))) setCell(fid, c, e.target.value, old);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    </td>
                  ))}
                  {geomKind === 'polygon' && <td className="text-right">{fmtNum(metricArea(utm, f.geometry), 1)}</td>}
                  {geomKind === 'line' && <td className="text-right">{fmtNum(metricLength(utm, f.geometry), 1)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
