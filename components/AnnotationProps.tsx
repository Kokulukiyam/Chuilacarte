'use client';
import { useStore } from '@/lib/store';
import { ANN_LABELS, markerLegend, type AnnKind } from '@/lib/annotations';
import { useAnnStyle } from '@/lib/annotate';
import type { Layer } from '@/lib/types';

function setFeatureProps(layerId: string, fid: string, p: Record<string, any>) {
  useStore.getState().commit(
    (d) => {
      const fc = d.data[layerId];
      d.data[layerId] = { ...fc, features: fc.features.map((f) => (f.properties?._fid === fid ? { ...f, properties: { ...f.properties, ...p } } : f)) };
    },
    { touched: [layerId] },
  );
}

/** Propriétés graphiques de l'annotation sélectionnée + liste des repères numérotés. */
export default function AnnotationProps({ layer }: { layer: Layer }) {
  const sel = useStore((s) => s.selection);
  const fc = useStore((s) => s.data[layer.id]);
  if (layer.role !== 'annotations') return null;
  const f = sel && sel.layerId === layer.id ? fc?.features.find((x) => x.properties?._fid === sel.fid) : undefined;
  const p = f?.properties || {};
  const kind = p._kind as AnnKind | undefined;
  const set = (o: Record<string, any>) => f && setFeatureProps(layer.id, sel!.fid, o);
  const markers = markerLegend(fc);
  return (
    <div className="space-y-3" data-testid="annotation-props">
      {f && kind && (
        <div className="space-y-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
          <div className="section-title">{ANN_LABELS[kind] || 'Annotation'}</div>
          {(kind === 'text' || kind === 'dimension') && (
            <label className="block text-[12px]">
              {kind === 'text' ? 'Texte' : 'Texte de la cote (vide = longueur mesurée)'}
              <textarea
                key={sel!.fid}
                className="input"
                rows={2}
                defaultValue={p._text || ''}
                onBlur={(e) => e.target.value !== (p._text || '') && set({ _text: e.target.value, ...(kind === 'text' ? { texte: e.target.value } : {}) })}
                data-testid="ann-text"
              />
            </label>
          )}
          {kind === 'marker' && (
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <label className="text-[12px]">
                N°
                <input type="number" className="input" value={p._num} min={1} onChange={(e) => set({ _num: Number(e.target.value), numero: Number(e.target.value) })} />
              </label>
              <label className="text-[12px]">
                Légende
                <input key={sel!.fid} className="input" defaultValue={p._legend || ''} onBlur={(e) => set({ _legend: e.target.value, legende: e.target.value })} data-testid="ann-legend" />
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <label className="flex items-center gap-2">
              <input type="color" value={p._color || '#dc2626'} onChange={(e) => set({ _color: e.target.value })} className="h-6 w-8" /> Couleur
            </label>
            {kind !== 'text' && kind !== 'marker' && (
              <label>
                Épaisseur
                <input type="number" className="input" min={0.2} max={20} step={0.2} value={p._width ?? 2} onChange={(e) => set({ _width: Number(e.target.value) })} />
              </label>
            )}
            {(kind === 'text' || kind === 'marker' || kind === 'dimension' || kind === 'point') && (
              <label>
                Taille
                <input type="number" className="input" min={6} max={96} step={1} value={p._size ?? 16} onChange={(e) => set({ _size: Number(e.target.value) })} data-testid="ann-size" />
              </label>
            )}
            {kind === 'text' && (
              <>
                <label>
                  Graisse
                  <select className="input" value={p._weight || 'regular'} onChange={(e) => set({ _weight: e.target.value })}>
                    <option value="regular">Normale</option>
                    <option value="bold">Grasse</option>
                  </select>
                </label>
                <label>
                  Rotation (°)
                  <input type="number" className="input" value={p._rotation ?? 0} step={5} onChange={(e) => set({ _rotation: Number(e.target.value) })} />
                </label>
                <label className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={p._halo !== 'none'} onChange={(e) => set({ _halo: e.target.checked ? '#ffffff' : 'none' })} /> Halo blanc
                </label>
              </>
            )}
            {(kind === 'polygon' || kind === 'rectangle' || kind === 'circle') && (
              <label>
                Remplissage {Math.round((p._fillOpacity ?? 0.12) * 100)} %
                <input type="range" min={0} max={1} step={0.05} value={p._fillOpacity ?? 0.12} onChange={(e) => set({ _fillOpacity: Number(e.target.value) })} className="w-full" />
              </label>
            )}
            {kind === 'arrow' && (
              <label className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={!!p._double} onChange={(e) => set({ _double: e.target.checked })} /> Double flèche
              </label>
            )}
          </div>
        </div>
      )}
      {markers.length > 0 && (
        <div>
          <div className="section-title mb-1">Repères numérotés</div>
          <ol className="space-y-0.5 text-[12px]" data-testid="marker-list">
            {markers.map((m) => (
              <li key={m.num} className="flex gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: m.color }}>
                  {m.num}
                </span>
                <span>{m.text || <i className="text-zinc-400">sans légende</i>}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Barre flottante de réglage pendant le dessin d'annotations. */
export function AnnotationBar() {
  const tool = useStore((s) => s.tool);
  const a = useAnnStyle();
  const target = useStore((s) => s.drawTarget);
  if (!tool.startsWith('draw-') || target) return null;
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-3 rounded-md border border-zinc-200 bg-white/95 px-3 py-1.5 text-[12px] shadow dark:border-zinc-700 dark:bg-zinc-900/95" data-testid="annotation-bar">
      <label className="flex items-center gap-1">
        <input type="color" value={a.color} onChange={(e) => a.set({ color: e.target.value })} className="h-5 w-7" /> Couleur
      </label>
      <label className="flex items-center gap-1">
        Trait
        <input type="number" className="input w-14 py-0.5" min={0.5} max={12} step={0.5} value={a.width} onChange={(e) => a.set({ width: Number(e.target.value) })} />
      </label>
      <label className="flex items-center gap-1">
        Texte
        <input type="number" className="input w-14 py-0.5" min={8} max={72} value={a.size} onChange={(e) => a.set({ size: Number(e.target.value) })} />
      </label>
      <select className="input w-24 py-0.5" value={a.weight} onChange={(e) => a.set({ weight: e.target.value })}>
        <option value="regular">Normal</option>
        <option value="bold">Gras</option>
      </select>
      <span className="text-zinc-500">Double-clic ou clic sur le dernier point pour terminer · Échap pour annuler</span>
    </div>
  );
}
