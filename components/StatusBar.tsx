'use client';
import { useEffect, useState } from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import { toUtm } from '@/lib/proj';
import { roundScale, screenScale } from '@/lib/mapview';

const fr = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Barre d'état sous la carte : position du curseur (WGS84 et UTM du site), échelle approchée, sélection. */
export default function StatusBar({ left, right, onToggleLeft, onToggleRight }: { left: boolean; right: boolean; onToggleLeft: () => void; onToggleRight: () => void }) {
  const utm = useStore((s) => s.site!.utm);
  const nSel = useStore((s) => (s.selection ? s.selection.fids?.length || 1 : 0));
  const layoutMode = useStore((s) => s.layoutMode);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [view, setView] = useState<{ zoom: number; lat: number; bearing: number } | null>(null);

  useEffect(() => {
    let off = () => {};
    let tries = 0;
    const attach = () => {
      const map = mapRef.map;
      if (!map) return false;
      let raf = 0;
      const mm = (e: any) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setPos([e.lngLat.lng, e.lngLat.lat]));
      };
      const out = () => setPos(null);
      const mv = () => setView({ zoom: map.getZoom(), lat: map.getCenter().lat, bearing: map.getBearing() });
      map.on('mousemove', mm);
      map.on('mouseout', out);
      map.on('move', mv);
      mv();
      off = () => {
        cancelAnimationFrame(raf);
        map.off('mousemove', mm);
        map.off('mouseout', out);
        map.off('move', mv);
      };
      return true;
    };
    const t = setInterval(() => {
      if (attach() || ++tries > 50) clearInterval(t);
    }, 100);
    return () => {
      clearInterval(t);
      off();
    };
  }, []);

  if (layoutMode) return null;
  const en = pos ? toUtm(utm, pos) : null;
  const wgs = pos ? `${fr(Math.abs(pos[1]), 5)}° ${pos[1] >= 0 ? 'N' : 'S'}  ${fr(Math.abs(pos[0]), 5)}° ${pos[0] >= 0 ? 'E' : 'O'}` : null;
  const scale = view ? roundScale(screenScale(view.zoom, view.lat)) : 0;
  return (
    <footer className="flex h-6 shrink-0 select-none items-center gap-3 border-t border-zinc-200 bg-white px-1 text-[11px] tabular-nums text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" data-testid="status-bar">
      <button className={`icon-btn h-5 w-6 ${left ? '' : 'text-accent-600 dark:text-accent-400'}`} onClick={onToggleLeft} data-tip={left ? 'Masquer le panneau des couches' : 'Afficher le panneau des couches'} aria-label="Panneau des couches" aria-pressed={left}>
        <PanelLeft size={13} />
      </button>
      {wgs ? (
        <>
          <span className="whitespace-pre" data-testid="status-wgs" data-tip="Position du curseur (WGS84)">
            {wgs}
          </span>
          <span className="hidden whitespace-pre text-zinc-400 lg:inline dark:text-zinc-500" data-tip={`Position du curseur en UTM ${utm.zone}${utm.south ? 'S' : 'N'} (EPSG:${utm.epsg}), en mètres`}>
            E {fr(en![0])}  N {fr(en![1])}
          </span>
        </>
      ) : (
        <span className="text-zinc-400 dark:text-zinc-500">Survolez la carte pour lire les coordonnées</span>
      )}
      <span className="ml-auto" />
      {nSel > 0 && (
        <span className="rounded bg-accent-100 px-1.5 font-medium text-accent-800 dark:bg-accent-900/50 dark:text-accent-200">
          {nSel} objet{nSel > 1 ? 's' : ''} sélectionné{nSel > 1 ? 's' : ''}
        </span>
      )}
      {view && Math.abs(view.bearing) > 0.5 && (
        <button className="hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => mapRef.map?.easeTo({ bearing: 0, duration: 300 })} data-tip="Carte tournée : cliquez pour remettre le nord en haut">
          ↻ {fr(view.bearing)}°
        </button>
      )}
      {scale > 0 && <span data-tip="Échelle approchée à l’écran. L’échelle exacte se règle dans la mise en page.">≈ 1/{fr(scale)}</span>}
      <span className="hidden text-zinc-400 md:inline dark:text-zinc-500">
        UTM {utm.zone}
        {utm.south ? 'S' : 'N'} · EPSG:{utm.epsg}
      </span>
      <button className={`icon-btn h-5 w-6 ${right ? '' : 'text-accent-600 dark:text-accent-400'}`} onClick={onToggleRight} data-tip={right ? 'Masquer le panneau de droite' : 'Afficher le panneau de droite'} aria-label="Panneau de droite" aria-pressed={right}>
        <PanelRight size={13} />
      </button>
    </footer>
  );
}
