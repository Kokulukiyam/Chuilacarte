'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { fmtArea, fmtLength, metricArea, metricLength } from '@/lib/proj';
import { bufferedEmprise } from '@/lib/site';
import { attributionsFor } from '@/lib/attribution';
import ImageryPanel from './ImageryPanel';

export default function SitePanel() {
  const site = useStore((s) => s.site!);
  const [buf, setBuf] = useState(String(site.buffer));
  const area = metricArea(site.utm, site.emprise.geometry);
  const per = metricLength(site.utm, site.emprise.geometry);
  const bufArea = metricArea(site.utm, bufferedEmprise(site).geometry);
  const attrs = attributionsFor(site, site.layers.filter((l) => l.visible));
  return (
    <div className="space-y-4 p-3" data-testid="site-panel">
      <div>
        <label className="label">Nom du site</label>
        <input
          className="input"
          defaultValue={site.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== site.name) useStore.getState().commit((d) => void (d.site.name = v));
          }}
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={2} defaultValue={site.description || ''} onBlur={(e) => useStore.getState().patchSite((s) => void (s.description = e.target.value))} />
      </div>
      <div>
        <label className="label">Zone tampon (m)</label>
        <div className="flex gap-2">
          <input className="input" type="number" min={0} max={20000} step={50} value={buf} onChange={(e) => setBuf(e.target.value)} data-testid="buffer-input" />
          <button
            className="btn"
            onClick={() => {
              const v = Math.max(0, Math.min(20000, Math.round(Number(buf) || 0)));
              useStore.getState().commit((d) => {
                d.site.buffer = v;
              });
              // le serveur régénère la zone tampon ; on recharge la géométrie
              setTimeout(async () => {
                const r = await fetch(`/api/sites/${site.slug}/layers/tampon`);
                if (r.ok) useStore.getState().setLayerData('tampon', await r.json());
              }, 1500);
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-zinc-500">Surface de l’emprise</dt>
        <dd>{fmtArea(area)}</dd>
        <dt className="text-zinc-500">Périmètre</dt>
        <dd>{fmtLength(per)}</dd>
        <dt className="text-zinc-500">Avec la zone tampon</dt>
        <dd>{fmtArea(bufArea)}</dd>
        <dt className="text-zinc-500">Projection métrique</dt>
        <dd>
          UTM {site.utm.zone}
          {site.utm.south ? 'S' : 'N'} (EPSG:{site.utm.epsg})
        </dd>
        <dt className="text-zinc-500">Centre</dt>
        <dd>
          {site.center[1].toFixed(5)}, {site.center[0].toFixed(5)}
        </dd>
      </dl>
      <ImageryPanel />
      <div>
        <div className="section-title mb-1">Sources affichées</div>
        <ul className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          {attrs.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
      {site.reports.length > 0 && (
        <div>
          <div className="section-title mb-1">Dernière collecte</div>
          <ReportView />
        </div>
      )}
    </div>
  );
}

export function ReportView() {
  const site = useStore((s) => s.site!);
  const r = site.reports[site.reports.length - 1];
  if (!r) return null;
  return (
    <div className="text-[12px]">
      <div className="mb-1 text-zinc-500">{new Date(r.date).toLocaleString('fr-FR')}</div>
      <table className="data">
        <tbody>
          {r.items.map((it, i) => (
            <tr key={i}>
              <td>{it.ok ? '✓' : '✗'}</td>
              <td>
                {it.source}
                {it.layer ? ` — ${it.layer}` : ''}
                {it.error && <div className="text-[11px] text-red-600">{it.error}</div>}
              </td>
              <td className="text-right">{it.ok ? it.count : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
