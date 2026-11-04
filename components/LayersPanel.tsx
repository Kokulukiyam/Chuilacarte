'use client';
import { useState } from 'react';
import { Eye, EyeOff, GripVertical, Trash2, Image as ImageIcon, Spline, Square, Circle, Shapes, Table2, Focus } from 'lucide-react';
import * as turf from '@turf/turf';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import type { Layer } from '@/lib/types';

function GeomIcon({ l }: { l: Layer }) {
  if (l.kind === 'raster') return <ImageIcon size={13} />;
  if (l.geom === 'line') return <Spline size={13} />;
  if (l.geom === 'point') return <Circle size={13} />;
  if (l.geom === 'polygon') return <Square size={13} />;
  return <Shapes size={13} />;
}

function Swatch({ l }: { l: Layer }) {
  if (l.kind === 'raster') return null;
  const s = l.style;
  const c = l.geom === 'line' ? s.stroke : s.fillOpacity < 0.05 ? 'transparent' : s.fill;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-sm border"
      style={{
        background: s.mode !== 'simple' ? 'conic-gradient(#4c78a8 0 25%, #f58518 0 50%, #54a24b 0 75%, #e45756 0)' : c,
        borderColor: s.stroke,
        borderStyle: s.dash === 'solid' ? 'solid' : 'dashed',
      }}
    />
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
}

export default function LayersPanel() {
  const layers = useStore((s) => s.site!.layers);
  const selected = useStore((s) => s.selectedLayerId);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const st = useStore.getState;

  const move = (from: number, to: number) => {
    if (from === to) return;
    st().commit((d) => {
      const arr = d.site.layers;
      const [x] = arr.splice(from, 1);
      arr.splice(to, 0, x);
    });
  };

  return (
    <aside className="flex w-[270px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" data-testid="layers-panel">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="section-title">Couches</span>
        <span className="text-[11px] text-zinc-400">{layers.length}</span>
      </div>
      <ul className="flex-1 overflow-y-auto pb-4">
        {layers.map((l, i) => (
          <li
            key={l.id}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = drag ?? Number(e.dataTransfer.getData('text/plain'));
              move(from, i);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            className={`group flex cursor-pointer items-center gap-1.5 border-t-2 px-2 py-1 ${over === i && drag !== null && drag !== i ? 'border-blue-500' : 'border-transparent'} ${selected === l.id ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
            onClick={() => st().selectLayer(l.id)}
            onDoubleClick={() => zoomToLayer(l.id)}
            data-testid="layer-item"
            data-layer-id={l.id}
          >
            <GripVertical size={12} className="shrink-0 cursor-grab text-zinc-300 dark:text-zinc-600" />
            <button
              className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              title={l.visible ? 'Masquer' : 'Afficher'}
              aria-label={l.visible ? 'Masquer' : 'Afficher'}
              data-testid="layer-visibility"
              onClick={(e) => {
                e.stopPropagation();
                st().commit((d) => {
                  const x = d.site.layers.find((y) => y.id === l.id)!;
                  x.visible = !x.visible;
                });
              }}
            >
              {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <Swatch l={l} />
            <span className="shrink-0 text-zinc-400">
              <GeomIcon l={l} />
            </span>
            <span className={`min-w-0 flex-1 truncate ${l.visible ? '' : 'text-zinc-400'}`} title={`${l.name} — ${l.source.name}`}>
              {l.name}
            </span>
            {l.count !== undefined && l.kind === 'vector' && <span className="text-[10px] text-zinc-400">{l.count}</span>}
            <span className="hidden shrink-0 gap-0.5 group-hover:flex">
              <button
                className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
                title="Zoomer sur la couche"
                onClick={(e) => {
                  e.stopPropagation();
                  zoomToLayer(l.id);
                }}
              >
                <Focus size={13} />
              </button>
              {l.kind === 'vector' && (
                <button
                  className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
                  title="Table attributaire"
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
                className="text-zinc-400 hover:text-red-600"
                title="Supprimer la couche"
                data-testid="layer-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(`Supprimer la couche « ${l.name} » ?`)) return;
                  st().commit(
                    (d) => {
                      d.site.layers = d.site.layers.filter((y) => y.id !== l.id);
                      delete d.data[l.id];
                    },
                    { touched: [l.id] },
                  );
                  if (st().selectedLayerId === l.id) st().selectLayer(null);
                }}
              >
                <Trash2 size={13} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
