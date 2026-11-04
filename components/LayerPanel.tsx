'use client';
import { useStore } from '@/lib/store';
import FeatureInfo from './FeatureInfo';
import { LAYER_SECTIONS } from './layerSections';

export default function LayerPanel() {
  const layer = useStore((s) => s.site!.layers.find((l) => l.id === s.selectedLayerId));
  const selection = useStore((s) => s.selection);
  if (!layer) return <p className="p-4 text-zinc-500">Sélectionnez une couche dans le panneau de gauche, ou un objet sur la carte.</p>;
  const upd = (fn: (l: any) => void) =>
    useStore.getState().commit((d) => {
      const l = d.site.layers.find((x) => x.id === layer.id);
      if (l) fn(l);
    });
  return (
    <div className="space-y-4 p-3" data-testid="layer-panel">
      <div>
        <label className="label">Nom de la couche</label>
        <input key={layer.id} className="input" defaultValue={layer.name} onBlur={(e) => e.target.value.trim() && e.target.value !== layer.name && upd((l) => (l.name = e.target.value.trim()))} data-testid="layer-name" />
      </div>
      <div>
        <label className="label">Opacité : {Math.round(layer.opacity * 100)} %</label>
        <input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(e) => upd((l) => (l.opacity = Number(e.target.value)))} className="w-full" data-testid="layer-opacity" />
      </div>
      {LAYER_SECTIONS.map((S, i) => (
        <S key={i} layer={layer} />
      ))}
      <div className="rounded-md bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
        <div>
          <b>Source :</b> {layer.source.name}
        </div>
        {layer.source.license && (
          <div>
            <b>Licence :</b> {layer.source.license}
          </div>
        )}
        {layer.source.attribution && (
          <div>
            <b>Attribution :</b> {layer.source.attribution}
          </div>
        )}
        <div>
          <b>Date :</b> {new Date(layer.source.collectedAt).toLocaleString('fr-FR')}
        </div>
      </div>
      {selection && selection.layerId === layer.id && <FeatureInfo />}
    </div>
  );
}
