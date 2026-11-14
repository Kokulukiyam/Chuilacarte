'use client';
import { useEscape } from './ui/hooks';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, X, XCircle, Download } from 'lucide-react';
import { useStore } from '@/lib/store';
import { upsertCollected, type CollectedMeta } from '@/lib/layerops';
import type { CollectReport, CollectReportItem, FC } from '@/lib/types';
import { flushNow } from '@/lib/autosave';

interface CollectorInfo {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

export default function CollectDialog({ onClose }: { onClose: () => void }) {
  const slug = useStore((s) => s.site!.slug);
  const [list, setList] = useState<CollectorInfo[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, 'run' | 'ok' | 'err'>>({});
  const [logs, setLogs] = useState<{ source: string; message: string }[]>([]);
  const [items, setItems] = useState<CollectReportItem[]>([]);
  const [done, setDone] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);
  useEscape(() => !running && onClose());

  useEffect(() => {
    fetch('/api/collectors')
      .then((r) => r.json())
      .then((l: CollectorInfo[]) => {
        setList(l);
        setSel(Object.fromEntries(l.map((c) => [c.id, c.defaultOn])));
      });
  }, []);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  const run = async () => {
    setRunning(true);
    setDone(false);
    setLogs([]);
    setItems([]);
    setStatus({});
    await flushNow();
    const sources = list.filter((c) => sel[c.id]).map((c) => c.id);
    const pending: { meta: CollectedMeta; fc?: FC }[] = [];
    try {
      const r = await fetch(`/api/sites/${slug}/collect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sources }) });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let report: CollectReport | null = null;
      for (;;) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const o = JSON.parse(line);
          if (o.type === 'start') setStatus((s) => ({ ...s, [o.source]: 'run' }));
          if (o.type === 'log' || o.type === 'note') setLogs((l) => [...l, { source: o.source, message: o.message }]);
          if (o.type === 'item') {
            setItems((x) => [...x, o.item]);
          }
          if (o.type === 'layer') {
            setStatus((s) => ({ ...s, [o.source]: 'ok' }));
            const meta: CollectedMeta = o.layer;
            let fc: FC | undefined;
            if (meta.role !== 'raster' && !meta.raster) {
              fc = await fetch(`/api/sites/${slug}/layers/${meta.id}`, { cache: 'no-store' }).then((x) => x.json());
            }
            pending.push({ meta, fc });
          }
          if (o.type === 'item' && !o.item.ok) {
            const c = list.find((x) => x.label === o.item.source);
            if (c) setStatus((s) => ({ ...s, [c.id]: 'err' }));
          }
          if (o.type === 'done') report = o.report;
        }
      }
      // une seule modification annulable pour toute la collecte
      useStore.getState().commit(
        (d) => {
          for (const p of pending) upsertCollected(d, p.meta, p.fc);
          if (report) d.site.reports = [...(d.site.reports || []).slice(-9), report];
        },
        // les fichiers des couches sont déjà écrits par le serveur : seul site.json est à enregistrer
        { touched: [] },
      );
      setDone(true);
      const failed = report?.items.filter((i) => !i.ok).length || 0;
      useStore.getState().toast(`Collecte terminée : ${pending.length} couches${failed ? `, ${failed} source(s) en échec` : ''}`, failed ? 'info' : 'ok');
    } catch (e: any) {
      useStore.getState().toast(`Collecte interrompue : ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const totals = new Map<string, { ok: boolean; count: number; layers: string[]; error?: string }>();
  for (const it of items) {
    const t = totals.get(it.source) || { ok: true, count: 0, layers: [] };
    if (!it.ok) {
      t.ok = false;
      t.error = it.error;
    } else if (it.count || it.layer) {
      if (it.count) {
        t.count += it.count;
        t.layers.push(`${it.layer} : ${it.count}`);
      }
    }
    totals.set(it.source, t);
  }

  const nSel = list.filter((c) => sel[c.id]).length;
  const nDone = Object.values(status).filter((v) => v !== 'run').length;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Collecter les données" onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div className="modal flex max-h-[90vh] w-[min(920px,96vw)] flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-display text-[17px] font-bold leading-tight">Collecter les données du site</h2>
            <p className="hint">Sur l’emprise du site et sa zone tampon. Une nouvelle collecte remplace les données, en gardant vos styles.</p>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={running} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-0 overflow-hidden">
          <div className="overflow-y-auto border-r border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="section-title">
                Sources · {nSel} sur {list.length}
              </span>
              <button className="btn-ghost py-0.5 text-[12px]" disabled={running || !list.length} onClick={() => setSel(Object.fromEntries(list.map((c) => [c.id, nSel < list.length])))}>
                {nSel < list.length ? 'Tout cocher' : 'Tout décocher'}
              </button>
            </div>
            {!list.length && (
              <div className="space-y-3 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-9" />
                ))}
              </div>
            )}
            <ul>
              {list.map((c) => (
                <li key={c.id}>
                 <label className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 ${running ? '' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60'}`}>
                  <input type="checkbox" className="mt-0.5" checked={!!sel[c.id]} disabled={running} onChange={(e) => setSel({ ...sel, [c.id]: e.target.checked })} data-testid={`collector-${c.id}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {c.label}
                      {status[c.id] === 'run' && <Loader2 size={13} className="animate-spin text-zinc-500" />}
                      {status[c.id] === 'ok' && <CheckCircle2 size={13} className="text-emerald-600" />}
                      {status[c.id] === 'err' && <XCircle size={13} className="text-red-600" />}
                    </div>
                    <div className="hint">{c.description}</div>
                  </div>
                 </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-col">
            {done || items.length ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="collect-summary">
                <div className="section-title mb-2">Résumé</div>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th className="text-right">Objets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...totals.entries()].map(([s, t]) => (
                      <tr key={s}>
                        <td>
                          <div className="flex items-center gap-1 font-medium">
                            {t.ok ? <CheckCircle2 size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-red-600" />} {s}
                          </div>
                          {t.layers.map((l) => (
                            <div key={l} className="pl-4 text-[11px] text-zinc-500">
                              {l}
                            </div>
                          ))}
                          {t.error && <div className="pl-4 text-[11px] text-red-600">Échec : {t.error}</div>}
                        </td>
                        <td className="text-right align-top">{t.ok ? t.count : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 space-y-0.5 text-[11px] text-zinc-500">
                  {logs
                    .filter((l) => !/^(Overpass : requête|API OSM : tuile|Overture : lecture|WorldCover : tuile|geoBoundaries : |Relief : lecture|Sentinel-2 : rendu|WorldPop : fichier|Open Buildings : lecture)/.test(l.message))
                    .map((l, i) => (
                      <div key={i}>· {l.message}</div>
                    ))}
                  <div ref={logEnd} />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
                  {running ? <Loader2 size={22} className="animate-spin" /> : <Download size={22} />}
                </span>
                {running ? (
                  <p className="text-zinc-600 dark:text-zinc-300" aria-live="polite">{logs[logs.length - 1]?.message || 'Connexion aux sources…'}</p>
                ) : (
                  <p className="max-w-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Choisissez les sources puis lancez la collecte. Comptez de quelques secondes à quelques minutes selon la taille du site.
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
              {running && (
                <div className="mr-auto flex min-w-0 flex-1 items-center gap-2 pl-1" aria-label="Avancement de la collecte">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-accent-600 transition-all duration-500 dark:bg-accent-400" style={{ width: `${Math.max(4, (nDone / Math.max(1, nSel)) * 100)}%` }} />
                  </div>
                  <span className="hint shrink-0 tabular-nums">
                    {nDone} / {nSel}
                  </span>
                </div>
              )}
              {done && (
                <button className="btn" onClick={onClose}>
                  Fermer
                </button>
              )}
              <button className="btn-accent" onClick={run} disabled={running || !list.some((c) => sel[c.id])} data-testid="collect-run">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {running ? 'Collecte en cours…' : done ? 'Relancer' : 'Collecter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
