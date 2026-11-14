'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, GripVertical, Trash2, Image as ImageIcon, Table2, Focus, Search, X, DownloadCloud, Upload } from 'lucide-react';
import * as turf from '@turf/turf';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import type { Layer } from '@/lib/types';
import { openUi } from '@/lib/uiEvents';

const MULTI = 'conic-gradient(#4c78a8 0 25%, #f58518 0 50%, #54a24b 0 75%, #e45756 0)';

/** Symbole de la couche tel qu'il est dessiné : ligne, point ou surface. */
function Swatch({ l }: { l: Layer }) {
  if (l.kind === 'raster')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400">
        <ImageIcon size={13} />
      </span>
    );
  const s = l.style;
  const multi = s.mode !== 'simple';
  const dashed = s.dash && s.dash !== 'solid';
  if (l.geom === 'line')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center">
        <span className="block w-full rounded-full" style={{ height: Math.max(2, Math.min(4, s.strokeWidth || 2)), background: multi ? 'linear-gradient(90deg,#4c78a8,#f58518,#e45756)' : dashed ? `repeating-linear-gradient(90deg, ${s.stroke} 0 4px, transparent 4px 6px)` : s.stroke }} />
      </span>
    );
  if (l.geom === 'point')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="block h-2.5 w-2.5 rounded-full border" style={{ background: multi ? MULTI : s.fill, borderColor: s.stroke }} />
      </span>
    );
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="block h-3 w-3 rounded-[3px] border" style={{ background: multi ? MULTI : s.fillOpacity < 0.05 ? 'transparent' : s.fill, borderColor: s.stroke, borderStyle: dashed ? 'dashed' : 'solid' }} />
    </span>
  );
}

export function zoomToLayer(id: string) {
  const st = useStore.getState();
  const l = st.site?.layers.find((x) => x.id === id);
  const map = mapRef.map;
  if (!l || !map) return;
  let bb: number[] | null = null;
  if (l.kind === 'raster') {
    if (l.raster?.bounds) bb = l.raster.bounds;
    else if (l.raster?.corners) bb = turf.bbox(turf.multiPoint(l.raster.corners));
  } else {
    const fc = st.data[id];
    if (fc?.features.length) bb = turf.bbox(fc);
  }
  if (bb && bb.every(Number.isFinite)) map.fitBounds(bb as any, { padding: 60, maxZoom: 18, duration: 500 });
  else st.toast(`« ${l.name} » ne contient aucun objet`, 'info');
}

export function deleteLayer(id: string) {
  const st = useStore.getState();
  const l = st.site?.layers.find((x) => x.id === id);
  if (!l) return;
  st.commit(
    (d) => {
      d.site.layers = d.site.layers.filter((y) => y.id !== id);
      delete d.data[id];
    },
    { touched: [id] },
  );
  if (st.selectedLayerId === id) st.selectLayer(null);
  st.toast(`Couche « ${l.name} » supprimée`, 'info', { label: 'Annuler', run: () => useStore.getState().undo() });
}

const WIDTH_KEY = 'chuilacarte-largeur-couches';
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function LayersPanel() {
  const layers = useStore((s) => s.site!.layers);
  const selected = useStore((s) => s.selectedLayerId);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [onlyVisible, setOnlyVisible] = useState(false);
  const [width, setWidth] = useState(270);
  const searchRef = useRef<HTMLInputElement>(null);
  const st = useStore.getState;

  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(WIDTH_KEY));
      if (w >= 220 && w <= 480) setWidth(w);
    } catch {}
  }, []);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    let w = w0;
    const move = (ev: MouseEvent) => {
      w = Math.max(220, Math.min(480, w0 + ev.clientX - x0));
      setWidth(w);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      try {
        localStorage.setItem(WIDTH_KEY, String(w));
      } catch {}
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    st().commit((d) => {
      const arr = d.site.layers;
      const [x] = arr.splice(from, 1);
      arr.splice(to, 0, x);
    });
  };

  const nVisible = layers.filter((l) => l.visible).length;
  const filtering = !!q.trim() || onlyVisible;
  const shown = useMemo(() => {
    const qq = norm(q.trim());
    return layers.map((l, i) => ({ l, i })).filter(({ l }) => (!onlyVisible || l.visible) && (!qq || norm(`${l.name} ${l.source.name}`).includes(qq)));
  }, [layers, q, onlyVisible]);

  return (
    <aside className="relative flex shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ width }} data-testid="layers-panel">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-200 pl-3 pr-1.5 dark:border-zinc-800">
        <span className="section-title">Couches</span>
        <span className="ml-1 text-[11px] tabular-nums text-zinc-400" data-tip={`${nVisible} couche${nVisible > 1 ? 's' : ''} affichée${nVisible > 1 ? 's' : ''} sur ${layers.length}`}>
          {nVisible}/{layers.length}
        </span>
        <span className="ml-auto flex items-center">
          <button
            className={`icon-btn h-6 w-6 ${onlyVisible ? '!bg-accent-100 !text-accent-800 dark:!bg-accent-900/50 dark:!text-accent-200' : ''}`}
            onClick={() => setOnlyVisible(!onlyVisible)}
            data-tip={onlyVisible ? 'Lister toutes les couches' : 'Ne lister que les couches affichées'}
            aria-pressed={onlyVisible}
            aria-label="Ne lister que les couches affichées"
          >
            <Eye size={13} />
          </button>
          <button
            className={`icon-btn h-6 w-6 ${searching ? '!bg-accent-100 !text-accent-800 dark:!bg-accent-900/50 dark:!text-accent-200' : ''}`}
            onClick={() => {
              if (searching) setQ('');
              setSearching(!searching);
            }}
            data-tip="Chercher une couche"
            aria-pressed={searching}
            aria-label="Chercher une couche"
          >
            <Search size={13} />
          </button>
        </span>
      </div>
      {searching && (
        <div className="relative shrink-0 border-b border-zinc-200 p-1.5 dark:border-zinc-800">
          <input
            ref={searchRef}
            className="input py-1 pr-7 text-[12.5px]"
            placeholder="Nom de couche ou source…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setQ('');
                setSearching(false);
              }
            }}
            data-testid="layer-search"
          />
          {q && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100" onClick={() => setQ('')} aria-label="Effacer">
              <X size={13} />
            </button>
          )}
        </div>
      )}
      <ul className="flex-1 overflow-y-auto pb-4 pt-0.5" aria-label="Couches du site">
        {shown.map(({ l, i }) => {
          const sel = selected === l.id;
          const empty = l.kind === 'vector' && l.count === 0;
          return (
            <li
              key={l.id}
              aria-current={sel || undefined}
              draggable={!filtering}
              onDragStart={(e) => {
                setDrag(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragOver={(e) => {
                if (drag === null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                if (drag === null) return;
                e.preventDefault();
                move(drag, i);
                setDrag(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              className={`group relative flex h-[30px] cursor-pointer items-center gap-1.5 border-t-2 pl-1 pr-2 ${over === i && drag !== null && drag !== i ? 'border-accent-500' : 'border-transparent'} ${
                sel ? 'bg-accent-50 dark:bg-accent-900/25' : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
              } ${drag === i ? 'opacity-40' : ''}`}
              onClick={() => st().selectLayer(l.id)}
              onDoubleClick={() => zoomToLayer(l.id)}
              data-testid="layer-item"
              data-layer-id={l.id}
            >
              {sel && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent-600 dark:bg-accent-400" />}
              <GripVertical size={12} className={`shrink-0 text-zinc-300 dark:text-zinc-600 ${filtering ? 'invisible' : 'cursor-grab opacity-0 group-hover:opacity-100'}`} />
              <button
                className={`flex h-6 w-5 shrink-0 items-center justify-center rounded ${l.visible ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-600'} hover:text-zinc-900 dark:hover:text-zinc-100`}
                title={`${l.visible ? 'Masquer' : 'Afficher'} (Alt + clic : seule cette couche)`}
                aria-label={l.visible ? 'Masquer' : 'Afficher'}
                data-testid="layer-visibility"
                onClick={(e) => {
                  e.stopPropagation();
                  st().commit((d) => {
                    if (e.altKey) {
                      // Alt + clic : n'afficher que cette couche ; à nouveau : tout réafficher
                      const solo = d.site.layers.every((y) => y.visible === (y.id === l.id));
                      for (const y of d.site.layers) y.visible = solo ? true : y.id === l.id;
                      return;
                    }
                    const x = d.site.layers.find((y) => y.id === l.id)!;
                    x.visible = !x.visible;
                  });
                }}
              >
                {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <span className={l.visible ? '' : 'opacity-40'}>
                <Swatch l={l} />
              </span>
              <span className={`min-w-0 flex-1 truncate ${sel ? 'font-medium' : ''} ${l.visible ? '' : 'text-zinc-400 dark:text-zinc-500'}`} title={`${l.name} — ${l.source.name}`}>
                {l.name}
              </span>
              {l.kind === 'vector' && l.count !== undefined && (
                <span className={`shrink-0 text-[10.5px] tabular-nums group-hover:hidden ${empty ? 'italic text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>{empty ? 'vide' : l.count.toLocaleString('fr-FR')}</span>
              )}
              <span className="hidden shrink-0 items-center group-hover:flex">
                <button
                  className="icon-btn h-6 w-6"
                  title="Zoomer sur la couche"
                  aria-label="Zoomer sur la couche"
                  onClick={(e) => {
                    e.stopPropagation();
                    zoomToLayer(l.id);
                  }}
                >
                  <Focus size={13} />
                </button>
                {l.kind === 'vector' && (
                  <button
                    className="icon-btn h-6 w-6"
                    title="Table attributaire"
                    aria-label="Table attributaire"
                    onClick={(e) => {
                      e.stopPropagation();
                      st().selectLayer(l.id);
                      window.dispatchEvent(new CustomEvent('chuilacarte-table', { detail: l.id }));
                    }}
                  >
                    <Table2 size={13} />
                  </button>
                )}
                <button
                  className="icon-btn h-6 w-6 hover:!text-red-600"
                  title="Supprimer la couche"
                  aria-label="Supprimer la couche"
                  data-testid="layer-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(l.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          );
        })}
        {filtering && shown.length === 0 && <li className="hint px-3 py-4 text-center">Aucune couche ne correspond.</li>}
        {layers.length <= 2 && !filtering && (
          <li className="mx-3 mt-3 rounded-lg border border-dashed border-zinc-300 p-3 text-center dark:border-zinc-700">
            <p className="hint mb-2">Le site n’a pas encore de données.</p>
            <div className="flex flex-col gap-1.5">
              <button className="btn-accent" onClick={() => openUi('collect')}>
                <DownloadCloud size={14} /> Collecter les données
              </button>
              <button className="btn justify-center" onClick={() => openUi('import')}>
                <Upload size={14} /> Importer un fichier
              </button>
            </div>
          </li>
        )}
      </ul>
      <div className="hint shrink-0 border-t border-zinc-200 px-3 py-1.5 dark:border-zinc-800">Glisser : ordre d’affichage · double-clic : zoom</div>
      <div className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize hover:bg-accent-500/30" onMouseDown={startResize} onDoubleClick={() => setWidth(270)} role="separator" aria-orientation="vertical" aria-label="Largeur du panneau des couches" />
    </aside>
  );
}
