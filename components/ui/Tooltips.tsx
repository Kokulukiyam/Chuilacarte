'use client';
import { useEffect, useRef, useState } from 'react';

interface Tip {
  text: string;
  k?: string;
  x: number;
  y: number;
  below: boolean;
}

/**
 * Infobulles de l'application : tout élément portant `data-tip` (et, en option, `data-key` pour le raccourci)
 * affiche une bulle immédiate, placée hors des conteneurs qui rognent (barre d'outils défilante).
 */
export default function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<any>(null);
  useEffect(() => {
    let cur: Element | null = null;
    const hide = () => {
      clearTimeout(timer.current);
      cur = null;
      setTip(null);
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest?.('[data-tip]');
      if (el === cur) return;
      hide();
      if (!el) return;
      cur = el;
      timer.current = setTimeout(() => {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        const below = r.top < 90 || el.getAttribute('data-tip-side') === 'bottom';
        setTip({ text: el.getAttribute('data-tip') || '', k: el.getAttribute('data-key') || undefined, x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: below ? r.bottom + 6 : r.top - 6, below });
      }, 350);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', hide, true);
      document.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
      clearTimeout(timer.current);
    };
  }, []);
  if (!tip || !tip.text) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[80] flex max-w-[260px] items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-1 text-[11.5px] font-medium leading-snug text-white shadow-pop animate-fade dark:bg-zinc-100 dark:text-zinc-900"
      style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
    >
      {tip.text}
      {tip.k && <span className="rounded bg-white/20 px-1 text-[10px] dark:bg-zinc-900/15">{tip.k}</span>}
    </div>
  );
}
