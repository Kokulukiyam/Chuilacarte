'use client';
import * as turf from '@turf/turf';
import { mapRef } from './mapref';
import { useStore } from './store';
import { bufferedEmprise } from './site';

/** Recadre la carte sur le site (emprise + zone tampon). */
export function zoomToSite(duration = 500) {
  const site = useStore.getState().site;
  const map = mapRef.map;
  if (!site || !map) return;
  const b = turf.bbox(bufferedEmprise(site)) as [number, number, number, number];
  map.fitBounds(b, { padding: 40, duration, bearing: 0 });
}

/** Dénominateur d'échelle approché de la carte à l'écran (96 dpi), à la latitude du centre. */
export function screenScale(zoom: number, lat: number) {
  const mPerPx = (78271.51696 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return mPerPx / 0.0002645833;
}

/** Arrondit un dénominateur d'échelle pour l'affichage (2 chiffres significatifs). */
export function roundScale(d: number) {
  if (!Number.isFinite(d) || d <= 0) return 0;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(d)) - 1);
  return Math.round(d / p) * p;
}
