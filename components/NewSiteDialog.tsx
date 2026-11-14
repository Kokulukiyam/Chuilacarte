'use client';
import { useEscape } from './ui/hooks';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as turf from '@turf/turf';
import type { Map as MlMap } from 'maplibre-gl';
import { Search, Square, Hexagon, Upload, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { buildBaseStyle, createMap } from '@/lib/mapbase';
import { DrawController } from '@/lib/draw';
import { makeLayer, normalizeEmprise, newId, bufferedEmprise } from '@/lib/site';
import type { FC } from '@/lib/types';
import { fmtArea, metricArea, utmForLonLat } from '@/lib/proj';

interface GeoResult {
  name: string;
  type: string;
  center: [number, number];
  bbox: [number, number, number, number];
  geojson: any;
}

const BUFFERS = [0, 100, 250, 500, 1000, 2000];

export default function NewSiteDialog({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const router = useRouter();
  const [tab, setTab] = useState<'search' | 'draw' | 'import'>('search');
  const [name, setName] = useState('');
  const [buffer, setBuffer] = useState(500);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emprise, setEmprise] = useState<FC | null>(null);
  const [imported, setImported] = useState<{ name: string; fc: FC; geom: any }[] | null>(null);
  const [keepImport, setKeepImport] = useState(true);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const drawRef = useRef<DrawController | null>(null);

  useEffect(() => {
    if (!mapEl.current) return;
    let map: MlMap;
    let cancelled = false;
    (async () => {
      const style = await buildBaseStyle({ basemap: 'clair' });
      if (cancelled || !mapEl.current) return;
      map = createMap(mapEl.current, { center: [-17.45, 14.7], zoom: 11, style } as any);
      mapRef.current = map;
      map.on('style.load', () => {
      if (!map.getSource('preview')) {
        map.addSource('preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'preview-buf', type: 'line', source: 'preview', filter: ['==', ['get', 'k'], 'buf'], paint: { 'line-color': '#71717a', 'line-dasharray': [1, 2], 'line-width': 1.2 } });
        map.addLayer({ id: 'preview-fill', type: 'fill', source: 'preview', filter: ['==', ['get', 'k'], 'emp'], paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'preview-line', type: 'line', source: 'preview', filter: ['==', ['get', 'k'], 'emp'], paint: { 'line-color': '#dc2626', 'line-width': 2 } });
      }
      if (!drawRef.current) {
        drawRef.current = new DrawController(map);
        drawRef.current.onFinish = (f) => {
          setEmprise({ type: 'FeatureCollection', features: [f as any] });
          drawRef.current?.setMode('static');
        };
      }
      });
    })();
    return () => {
      cancelled = true;
      drawRef.current?.destroy();
      map?.remove();
    };
  }, []);

  // aperçu emprise + tampon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src: any = map.getSource('preview');
      if (!src) return;
      if (!emprise) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      try {
        const e = normalizeEmprise(emprise);
        const b = bufferedEmprise({ emprise: e, buffer });
        src.setData({ type: 'FeatureCollection', features: [{ ...b, properties: { k: 'buf' } }, { ...e, properties: { k: 'emp' } }] });
        const bb = turf.bbox(b) as [number, number, number, number];
        map.fitBounds(bb, { padding: 40, duration: 500, maxZoom: 17 });
      } catch (x: any) {
        setErr(x.message);
      }
    };
    if (map.isStyleLoaded() && map.getSource('preview')) apply();
    else map.once('idle', apply);
  }, [emprise, buffer]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<GeoResult[]>(`/api/geocode?q=${encodeURIComponent(q)}`);
      setResults(r);
      if (!r.length) setErr('Aucun résultat. Essayez « Médina, Dakar » ou « Fatick, Sénégal ».');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (r: GeoResult) => {
    let feat: any;
    if (r.geojson && /Polygon/.test(r.geojson.type)) feat = { type: 'Feature', properties: {}, geometry: r.geojson };
    else {
      const poly = turf.bboxPolygon(r.bbox);
      const u = utmForLonLat(r.center[0], r.center[1]);
      // un point ou une emprise minuscule : carré de 400 m autour du lieu
      if (metricArea(u, poly.geometry) < 20000) feat = turf.bboxPolygon(turf.bbox(turf.buffer(turf.point(r.center), 200, { units: 'meters' })!));
      else feat = poly;
    }
    setEmprise({ type: 'FeatureCollection', features: [feat] });
    if (!name) setName(r.name.split(',').slice(0, 2).join(',').trim());
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api<{ layers: { name: string; fc: FC; geom: any; warning?: string }[] }>('/api/import', { method: 'POST', body: fd });
      setImported(r.layers);
      const all: FC = { type: 'FeatureCollection', features: r.layers.flatMap((l) => l.fc.features) };
      setEmprise(all);
      if (!name) setName(r.layers[0].name);
      const w = r.layers.find((l) => l.warning);
      if (w) setErr(w.warning!);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!emprise || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const extraLayers =
        tab === 'import' && keepImport && imported
          ? imported.map((l) => ({ layer: { ...makeLayer({ name: l.name, role: 'imported', geom: l.geom, count: l.fc.features.length }), id: newId() }, data: l.fc }))
          : [];
      const site = await api<any>('/api/sites', { method: 'POST', json: { name: name.trim(), buffer, emprise, extraLayers } });
      router.push(`/sites/${site.slug}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const area = (() => {
    if (!emprise) return null;
    try {
      const e = normalizeEmprise(emprise);
      const c = turf.centroid(e).geometry.coordinates;
      return metricArea(utmForLonLat(c[0], c[1]), e.geometry);
    } catch {
      return null;
    }
  })();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Nouveau site" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal flex h-[min(760px,92vh)] w-[min(1200px,96vw)]">
        <div className="flex w-[380px] flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <div>
              <h2 className="font-display text-[17px] font-bold leading-tight">Nouveau site d’étude</h2>
              <p className="hint">Délimitez l’emprise, nommez le site, c’est parti.</p>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800">
            {(
              [
                ['search', 'Recherche', Search],
                ['draw', 'Dessin', Square],
                ['import', 'Import', Upload],
              ] as const
            ).map(([k, l, I]) => (
              <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
                <I size={14} /> {l}
              </button>
            ))}
          </div>
          <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
            {tab === 'search' && (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    search();
                  }}
                >
                  <input className="input" placeholder="Quartier, ville, adresse…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="geocode-input" autoFocus />
                  <button className="btn" disabled={busy}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </form>
                <ul className="space-y-1">
                  {results?.map((r, i) => (
                    <li key={i}>
                      <button className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => pick(r)} data-testid="geocode-result">
                        <div className="text-[13px]">{r.name}</div>
                        <div className="text-[11px] text-zinc-500">{r.type}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-zinc-500">Géocodage : Nominatim / © les contributeurs d’OpenStreetMap.</p>
              </>
            )}
            {tab === 'draw' && (
              <div className="space-y-2">
                <p className="text-zinc-600 dark:text-zinc-400">Dessinez l’emprise du site sur la carte.</p>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => drawRef.current?.setMode('rectangle')} data-testid="draw-rect">
                    <Square size={14} /> Rectangle
                  </button>
                  <button className="btn" onClick={() => drawRef.current?.setMode('polygon')} data-testid="draw-poly">
                    <Hexagon size={14} /> Polygone
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">Rectangle : cliquez deux coins. Polygone : cliquez les sommets, puis cliquez le premier point pour fermer.</p>
              </div>
            )}
            {tab === 'import' && (
              <div className="space-y-2">
                <label className="btn cursor-pointer">
                  <Upload size={14} /> Choisir un fichier…
                  <input
                    type="file"
                    className="hidden"
                    accept=".geojson,.json,.kml,.kmz,.gpkg,.zip,.dxf,.csv"
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                    data-testid="import-file"
                  />
                </label>
                <p className="text-[11px] text-zinc-500">GeoJSON, KML/KMZ, GeoPackage, Shapefile zippé, DXF géoréférencé (WGS84 ou UTM 28N), CSV.</p>
                {imported && (
                  <>
                    <ul className="text-[12px]">
                      {imported.map((l, i) => (
                        <li key={i}>
                          {l.name} — {l.fc.features.length} objet(s)
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={keepImport} onChange={(e) => setKeepImport(e.target.checked)} /> Ajouter aussi ces objets comme couche
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <label className="label">Nom du site</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Îlot Médina rue 11" data-testid="site-name" />
            </div>
            <div>
              <label className="label">Zone tampon autour de l’emprise</label>
              <div className="flex flex-wrap gap-1">
                {BUFFERS.map((b) => (
                  <button key={b} className={`chip ${buffer === b ? 'active' : ''}`} onClick={() => setBuffer(b)}>
                    {b === 0 ? 'Aucune' : b >= 1000 ? `${b / 1000} km` : `${b} m`}
                  </button>
                ))}
                <input type="number" className="input h-7 w-20" value={buffer} min={0} max={20000} step={50} onChange={(e) => setBuffer(Math.max(0, Number(e.target.value) || 0))} aria-label="Distance du tampon (m)" />
              </div>
            </div>
            {area !== null && <p className="well text-[12px] text-zinc-700 dark:text-zinc-300">Surface de l’emprise : <b>{fmtArea(area)}</b></p>}
            {err && <p className="text-[12px] text-amber-700 dark:text-amber-400">{err}</p>}
            {!emprise && !err && <p className="hint">Il manque l’emprise : cherchez un lieu, dessinez-la ou importez un fichier.</p>}
            <button className="btn-accent w-full py-2" disabled={!emprise || !name.trim() || busy} onClick={create} data-testid="create-site">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} Créer le site
            </button>
          </div>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0"><div ref={mapEl} className="h-full w-full" /></div>
        </div>
      </div>
    </div>
  );
}
