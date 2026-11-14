'use client';
import { useStore } from '@/lib/store';
import FeatureInfo from './FeatureInfo';
import { MousePointerClick } from 'lucide-react';
import { LAYER_SECTIONS } from './layerSections';

function LayerEmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <MousePointerClick size={20} />
      </span>
      <p className="font-medium">Aucune couche sélectionnée</p>
      <p className="hint mt-1 max-w-[230px]">Cliquez une couche dans la liste de gauche, ou un objet sur la carte, pour régler son style, ses étiquettes et ses attributs.</p>
    </div>
  );
}

export default function LayerPanel() {
  const layer = useStore((s) => s.site!.layers.find((l) => l.id === s.selectedLayerId));
  const selection = useStore((s) => s.selection);
  if (!layer) return <LayerEmptyState />;
  const upd = (fn: (l: any) => void) =>
    useStore.getState().commit((d) => {
      const l = d.site.layers.find((x) => x.id === layer.id);
      if (l) fn(l);
    });
  return (
    <div className="space-y-4 p-3 [&>*+*]:border-t [&>*+*]:border-zinc-200/70 [&>*+*]:pt-4 dark:[&>*+*]:border-zinc-800" data-testid="layer-panel">
      <div>
        <label className="label">Nom de la couche</label>
        <input key={layer.id} className="input" defaultValue={layer.name} onBlur={(e) => e.target.value.trim() && e.target.value !== layer.name && upd((l) => (l.name = e.target.value.trim()))} data-testid="layer-name" />
      </div>
      <div>
        <label className="label flex justify-between">Opacité de la couche <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{Math.round(layer.opacity * 100)} %</span></label>
        <input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(e) => upd((l) => (l.opacity = Number(e.target.value)))} className="w-full" data-testid="layer-opacity" />
      </div>
      {LAYER_SECTIONS.map((S, i) => (
        <S key={i} layer={layer} />
      ))}
      <div className="well space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
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
