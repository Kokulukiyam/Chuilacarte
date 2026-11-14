'use client';
import { useEffect, useState } from 'react';
import { Copy, Crosshair, Focus, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import { toUtm } from '@/lib/proj';
import { zoomToSite } from '@/lib/mapview';
import { useClickOutside, useEscape } from './ui/hooks';

interface Menu {
  x: number;
  y: number;
  lngLat: [number, number];
}

/** Menu du clic droit sur la carte : coordonnées, recadrage, point d'annotation. */
export default function MapContextMenu() {
  const [m, setM] = useState<Menu | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setM(null), !!m);
  useEscape(() => setM(null), !!m);
  useEffect(() => {
    let off = () => {};
    let tries = 0;
    const t = setInterval(() => {
      const map = mapRef.map;
      if (!map) {
        if (++tries > 50) clearInterval(t);
        return;
      }
      clearInterval(t);
      const h = (e: any) => {
        // pendant un dessin, le clic droit appartient à l'outil
        if (useStore.getState().tool !== 'select') return;
        e.preventDefault();
        const r = map.getContainer().getBoundingClientRect();
        setM({ x: Math.min(e.point.x, r.width - 250), y: Math.min(e.point.y, r.height - 170), lngLat: [e.lngLat.lng, e.lngLat.lat] });
      };
      const close = () => setM(null);
      map.on('contextmenu', h);
      map.on('movestart', close);
      off = () => {
        map.off('contextmenu', h);
        map.off('movestart', close);
      };
    }, 100);
    return () => {
      clearInterval(t);
      off();
    };
  }, []);
  if (!m) return null;
  const st = useStore.getState();
  const utm = st.site!.utm;
  const [lng, lat] = m.lngLat;
  const en = toUtm(utm, m.lngLat);
  const copy = (text: string, what: string) => {
    setM(null);
    const done = () => st.toast(`${what} copiées : ${text}`, 'ok');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => st.toast('Copie impossible dans ce navigateur', 'error'));
    else st.toast(text, 'info');
  };
  const wgs = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const utmTxt = `${en[0].toFixed(2)} ${en[1].toFixed(2)}`;
  return (
    <div ref={ref} className="popover absolute z-20 w-60" style={{ left: m.x, top: m.y }} role="menu" data-testid="map-menu" onContextMenu={(e) => e.preventDefault()}>
      <button className="menu-item" role="menuitem" onClick={() => copy(wgs, 'Coordonnées')} data-testid="map-menu-copy">
        <Copy size={14} className="shrink-0 text-zinc-500" />
        <span className="min-w-0">
          <span className="block">Copier latitude, longitude</span>
          <span className="hint block font-mono">{wgs}</span>
        </span>
      </button>
      <button className="menu-item" role="menuitem" onClick={() => copy(utmTxt, 'Coordonnées UTM')}>
        <Crosshair size={14} className="shrink-0 text-zinc-500" />
        <span className="min-w-0">
          <span className="block">
            Copier UTM {utm.zone}
            {utm.south ? 'S' : 'N'} (E N, en m)
          </span>
          <span className="hint block font-mono">{utmTxt}</span>
        </span>
      </button>
      <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
      <button
        className="menu-item"
        role="menuitem"
        onClick={() => {
          setM(null);
          mapRef.map?.easeTo({ center: m.lngLat, zoom: Math.max(mapRef.map.getZoom(), 17), duration: 400 });
        }}
      >
        <MapPin size={14} className="shrink-0 text-zinc-500" /> Zoomer ici
      </button>
      <button
        className="menu-item"
        role="menuitem"
        onClick={() => {
          setM(null);
          zoomToSite();
        }}
      >
        <Focus size={14} className="shrink-0 text-zinc-500" /> Recadrer sur le site
      </button>
    </div>
  );
}
