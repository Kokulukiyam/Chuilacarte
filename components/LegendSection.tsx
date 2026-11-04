'use client';
import { useStore } from '@/lib/store';
import type { Layer } from '@/lib/types';

export default function LegendSection({ layer }: { layer: Layer }) {
  const upd = (fn: (l: Layer) => void) =>
    useStore.getState().commit((d) => {
      const l = d.site.layers.find((x) => x.id === layer.id);
      if (l) fn(l);
    });
  return (
    <div className="space-y-1">
      <div className="section-title">Légende</div>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={layer.legend !== false} onChange={(e) => upd((l) => (l.legend = e.target.checked))} data-testid="legend-include" /> Afficher dans la légende des mises en page
      </label>
      <input
        key={layer.id + (layer.legendLabel || '')}
        className="input"
        placeholder={`Libellé (par défaut : ${layer.name})`}
        defaultValue={layer.legendLabel || ''}
        onBlur={(e) => e.target.value !== (layer.legendLabel || '') && upd((l) => (l.legendLabel = e.target.value || undefined))}
      />
    </div>
  );
}
