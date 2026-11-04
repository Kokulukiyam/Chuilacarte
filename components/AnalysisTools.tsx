'use client';
import { useEffect, useMemo, useState } from 'react';
import { Calculator, Columns2, Download, Footprints, LineChart, Loader2, Hexagon, Flame, Circle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { synthesis, synthesisCsv, synthesisRows, densityGrid, type Synthesis } from '@/lib/analysis';
import { useAnalysis, listZones, bufferFeatures, addAnalysisLayer, gradStyleFor } from '@/lib/analysisTools';
import { useConfig } from '@/lib/config';
import { download } from '@/lib/layout/export';
import { fmtLength, fmtNum } from '@/lib/proj';
import { bufferedEmprise } from '@/lib/site';
import { baseStyle } from '@/lib/styles';

function Section({ title, icon: I, children, testid }: { title: string; icon: any; children: React.ReactNode; testid?: string }) {
  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="section-title flex items-center gap-1.5">
        <I size={12} /> {title}
      </div>
      {children}
    </div>
  );
}

export function SynthesisSection() {
  const site = useStore((s) => s.site!);
  const data = useStore((s) => s.data);
  const sel = useStore((s) => s.selection);
  const zones = useMemo(() => listZones(), [site, data, sel]);
  const [za, setZa] = useState('emprise');
  const [zb, setZb] = useState('');
  const [bl, setBl] = useState('');
  const [res, setRes] = useState<Synthesis[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const h = (e: any) => setZa(e.detail);
    window.addEventListener('chuilacarte-zone', h);
    return () => window.removeEventListener('chuilacarte-zone', h);
  }, []);
  const buildings = site.layers.filter((l) => l.role === 'buildings' && l.kind === 'vector');
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const list = [za, zb].filter(Boolean).map((id) => zones.find((z) => z.id === id)!).filter(Boolean);
        // même couche de bâti pour toutes les zones comparées
        const first = synthesis(site, data, list[0], { buildingsLayer: bl || undefined });
        const blId = bl || site.layers.find((l) => l.name === first.batiments_couche && l.role === 'buildings')?.id;
        setRes([first, ...list.slice(1).map((z) => synthesis(site, data, z, { buildingsLayer: blId }))]);
      } catch (e: any) {
        useStore.getState().toast(`Synthèse : ${e.message}`, 'error');
      } finally {
        setBusy(false);
      }
    }, 20);
  };
  const rows = res?.map(synthesisRows);
  return (
    <Section title="Synthèse d’une zone" icon={Calculator} testid="synthesis">
      <label className="block text-[12px]">
        Zone
        <select className="input" value={za} onChange={(e) => setZa(e.target.value)} data-testid="zone-a">
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[12px]">
        Comparer avec (facultatif)
        <select className="input" value={zb} onChange={(e) => setZb(e.target.value)} data-testid="zone-b">
          <option value="">—</option>
          {zones
            .filter((z) => z.id !== za)
            .map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-[12px]">
        Couche de bâti
        <select className="input" value={bl} onChange={(e) => setBl(e.target.value)}>
          <option value="">Automatique (la plus complète)</option>
          {buildings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-1">
        <button className="btn-primary" onClick={run} disabled={busy} data-testid="synthesis-run">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />} Calculer
        </button>
        <button className="btn" onClick={() => useStore.getState().setTool('zone')} title="Dessiner une nouvelle zone (îlot, quartier…)" data-testid="zone-draw">
          <Hexagon size={13} /> Dessiner une zone
        </button>
        {res && (
          <button
            className="btn"
            onClick={() => download(new Blob([synthesisCsv(res)], { type: 'text/csv;charset=utf-8' }), `synthese-${site.slug}-${new Date().toISOString().slice(0, 10)}.csv`)}
            data-testid="synthesis-csv"
          >
            <Download size={13} /> CSV
          </button>
        )}
      </div>
      {rows && (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-700">
          <table className="data" data-testid="synthesis-table">
            <thead>
              <tr>
                <th>Indicateur</th>
                {res!.map((r) => (
                  <th key={r.zone}>{r.zone}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows[0].map((row, i) => (
                <tr key={i}>
                  <td className="text-zinc-600 dark:text-zinc-400">{row[0]}</td>
                  {rows.map((r, j) => (
                    <td key={j} className="font-medium">
                      {r[i][1]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-1 text-[10px] text-zinc-500">Sources : {[...new Set(res!.flatMap((r) => r.sources))].join(' ; ')}. Surfaces et longueurs en UTM {site.utm.zone}N.</p>
        </div>
      )}
      {res && res.length === 2 && <p className="flex items-center gap-1 text-[11px] text-zinc-500"><Columns2 size={11} /> Comparaison côte à côte de deux zones.</p>}
    </Section>
  );
}

export function BufferSection() {
  const site = useStore((s) => s.site!);
  const selected = useStore((s) => s.selectedLayerId);
  const sel = useStore((s) => s.selection);
  const [dist, setDist] = useState(100);
  const [dissolve, setDissolve] = useState(true);
  const layer = site.layers.find((l) => l.id === selected && l.kind === 'vector');
  const hasSel = sel && layer && sel.layerId === layer.id;
  return (
    <Section title="Zone tampon" icon={Circle} testid="buffer-section">
      {!layer ? (
        <p className="text-[11px] text-zinc-500">Sélectionnez une couche (ou un objet) pour créer une zone tampon autour.</p>
      ) : (
        <>
          <p className="text-[12px]">
            {hasSel ? `${sel!.fids?.length || 1} objet(s) sélectionné(s)` : `Tous les objets de « ${layer.name} »`}
          </p>
          <div className="flex items-center gap-2">
            <input type="number" className="input w-24" min={1} max={20000} value={dist} onChange={(e) => setDist(Number(e.target.value))} data-testid="buffer-distance" /> m
            <label className="flex items-center gap-1 text-[12px]">
              <input type="checkbox" checked={dissolve} onChange={(e) => setDissolve(e.target.checked)} /> Fusionner
            </label>
            <button
              className="btn"
              onClick={() => {
                try {
                  bufferFeatures(layer.id, dist, !!hasSel, dissolve);
                } catch (e: any) {
                  useStore.getState().toast(e.message, 'error');
                }
              }}
              data-testid="buffer-run"
            >
              Créer
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

export function IsochroneSection() {
  const a = useAnalysis();
  const cfg = useConfig((s) => s.cfg);
  const tool = useStore((s) => s.tool);
  return (
    <Section title="Isochrones" icon={Footprints} testid="isochrone-section">
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={a.isoMode} onChange={(e) => a.set({ isoMode: e.target.value })} data-testid="iso-mode">
          <option value="walk">À pied</option>
          <option value="bike">À vélo</option>
          <option value="car">En voiture</option>
        </select>
        <input className="input" value={a.isoMinutes} onChange={(e) => a.set({ isoMinutes: e.target.value })} title="Durées en minutes, séparées par des virgules" data-testid="iso-minutes" />
      </div>
      <button className={`btn ${tool === 'isochrone' ? 'ring-2 ring-violet-500' : ''}`} onClick={() => useStore.getState().setTool('isochrone')} disabled={a.isoBusy} data-testid="iso-run">
        {a.isoBusy ? <Loader2 size={13} className="animate-spin" /> : <Footprints size={13} />} {tool === 'isochrone' ? 'Cliquez le point de départ sur la carte' : 'Choisir le point de départ'}
      </button>
      <p className="text-[11px] text-zinc-500">{cfg.ors ? 'Calcul : OpenRouteService (clé fournie).' : 'Calcul : Valhalla (serveur public FOSSGIS, sans clé). Ajoutez ORS_API_KEY pour OpenRouteService.'}</p>
    </Section>
  );
}

export function ProfileSection() {
  const a = useAnalysis();
  const p = a.profile;
  const tool = useStore((s) => s.tool);
  return (
    <Section title="Profil topographique" icon={LineChart} testid="profile-section">
      <button className={`btn ${tool === 'profile' ? 'ring-2 ring-teal-500' : ''}`} onClick={() => useStore.getState().setTool('profile')} disabled={a.profileBusy} data-testid="profile-run">
        {a.profileBusy ? <Loader2 size={13} className="animate-spin" /> : <LineChart size={13} />} {tool === 'profile' ? 'Tracez la ligne (double-clic pour finir)' : 'Tracer une ligne de profil'}
      </button>
      {p && <ProfileChart p={p} />}
    </Section>
  );
}

function ProfileChart({ p }: { p: NonNullable<ReturnType<typeof useAnalysis.getState>['profile']> }) {
  const W = 300;
  const H = 140;
  const pad = { l: 34, r: 8, t: 8, b: 22 };
  const zs = p.points.map((x) => x.z).filter((z): z is number => z !== null);
  const zmin = Math.floor(Math.min(...zs) - 1);
  const zmax = Math.ceil(Math.max(...zs) + 1);
  const X = (d: number) => pad.l + (d / p.length) * (W - pad.l - pad.r);
  const Y = (z: number) => H - pad.b - ((z - zmin) / Math.max(1, zmax - zmin)) * (H - pad.t - pad.b);
  const path = p.points.filter((x) => x.z !== null).map((x, i) => `${i ? 'L' : 'M'}${X(x.d).toFixed(1)},${Y(x.z!).toFixed(1)}`).join('');
  const area = `${path}L${X(p.length)},${H - pad.b}L${X(0)},${H - pad.b}Z`;
  const csv = () =>
    download(
      new Blob([`﻿distance_m;altitude_m;longitude;latitude\r\n${p.points.map((x) => `${x.d};${x.z ?? ''};${x.lon.toFixed(7)};${x.lat.toFixed(7)}`).join('\r\n')}`], { type: 'text/csv' }),
      'profil.csv',
    );
  return (
    <div data-testid="profile-chart">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="rounded bg-zinc-50 dark:bg-zinc-800">
        <path d={area} fill="#99f6e4" opacity={0.6} />
        <path d={path} fill="none" stroke="#0f766e" strokeWidth={1.5} />
        {[zmin, (zmin + zmax) / 2, zmax].map((z) => (
          <g key={z}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(z)} y2={Y(z)} stroke="#d4d4d8" strokeWidth={0.5} />
            <text x={pad.l - 3} y={Y(z) + 3} fontSize={8} textAnchor="end" fill="#71717a">
              {Math.round(z)} m
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={X(p.length * t)} y={H - 8} fontSize={8} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'} fill="#71717a">
            {fmtLength(p.length * t)}
          </text>
        ))}
      </svg>
      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
        Longueur {fmtLength(p.length)} · altitude {fmtNum(p.min, 1)} à {fmtNum(p.max, 1)} m · dénivelé +{fmtNum(p.up, 1)} / −{fmtNum(p.down, 1)} m
      </div>
      <div className="text-[10px] text-zinc-500">{p.note}</div>
      <button className="btn-ghost mt-1" onClick={csv}>
        <Download size={12} /> CSV du profil
      </button>
    </div>
  );
}

export function DensitySection() {
  const site = useStore((s) => s.site!);
  const data = useStore((s) => s.data);
  const pts = site.layers
    .filter((l) => l.kind === 'vector' && l.style.mode !== 'heatmap' && (l.geom === 'point' || l.geom === 'mixed') && data[l.id]?.features.some((f) => f.geometry?.type === 'Point'))
    .sort((a, b) => Number(b.role === 'amenities') - Number(a.role === 'amenities') || Number(a.role === 'annotations') - Number(b.role === 'annotations'));
  const [lid, setLid] = useState('');
  const [cell, setCell] = useState(100);
  const layer = pts.find((l) => l.id === lid) || pts[0];
  return (
    <Section title="Carte de chaleur et densité" icon={Flame} testid="density-section">
      {!pts.length ? (
        <p className="text-[11px] text-zinc-500">Aucune couche de points (collectez les équipements ou importez des points).</p>
      ) : (
        <>
          <select className="input" value={layer?.id} onChange={(e) => setLid(e.target.value)} data-testid="density-layer">
            {pts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-1">
            <button
              className="btn"
              onClick={() => {
                const fc = { type: 'FeatureCollection' as const, features: data[layer.id].features.filter((f) => f.geometry?.type === 'Point') };
                addAnalysisLayer(`Chaleur — ${layer.name}`, fc, {
                  geom: 'point',
                  style: { ...baseStyle({ fillOpacity: 0.8 }), mode: 'heatmap' as any, heatmap: { radius: 30, intensity: 1 } } as any,
                });
              }}
              data-testid="heatmap-run"
            >
              <Flame size={13} /> Carte de chaleur
            </button>
            <input type="number" className="input w-20" value={cell} min={20} max={2000} step={10} onChange={(e) => setCell(Number(e.target.value))} title="Taille des hexagones (m)" />
            <button
              className="btn"
              onClick={() => {
                const fc = densityGrid(site, data[layer.id].features as any, cell, bufferedEmprise(site));
                addAnalysisLayer(`Densité (${cell} m) — ${layer.name}`, fc, { geom: 'polygon', style: { ...gradStyleFor(fc, 'nombre', 'rouge'), label: null } });
              }}
              data-testid="density-run"
            >
              <Hexagon size={13} /> Densité (hexagones)
            </button>
          </div>
        </>
      )}
    </Section>
  );
}
