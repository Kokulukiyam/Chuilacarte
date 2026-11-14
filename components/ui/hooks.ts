'use client';
import { useEffect, useRef } from 'react';

/** Ferme (Échap) un dialogue ou un menu tant qu'il est monté. */
export function useEscape(onClose: () => void, active = true) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cb.current();
    };
    // phase de capture : passe avant les raccourcis de la carte
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [active]);
}

/** Ferme un menu au clic en dehors de l'élément. */
export function useClickOutside<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T>(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [active]);
  return ref;
}

/** Date relative courte en français (« aujourd’hui », « hier », « il y a 3 jours », puis la date). */
export function relativeDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => Math.floor(new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() / 86400000);
  const n = day(now) - day(d);
  if (n <= 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  if (n < 7) return `il y a ${n} jours`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}`;
}
