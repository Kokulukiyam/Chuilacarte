'use client';
import { Copy, Merge, RotateCcw, RotateCw, Scissors, SplitSquareHorizontal, Trash2, Expand, Shrink, PenLine, Check, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { deleteSelection, duplicateSelection, explodeSelection, mergeSelection, startVertexEdit, stopVertexEdit, transformSelection } from '@/lib/edit';
import type { Layer } from '@/lib/types';

export default function EditSection({ layer }: { layer: Layer }) {
  const sel = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const drawTarget = useStore((s) => s.drawTarget);
  if (layer.kind !== 'vector') return null;
  const has = sel && sel.layerId === layer.id;
  const n = has ? sel!.fids?.length || 1 : 0;
  const st = useStore.getState;
  const startAdd = () => {
    const t = layer.geom === 'point' ? 'draw-point' : layer.geom === 'line' ? 'draw-line' : 'draw-polygon';
    st().setTool(t as any);
    useStore.setState({ drawTarget: layer.id });
    st().toast(`Dessinez le nouvel objet : il sera ajouté à « ${layer.name} » (Échap pour arrêter)`, 'info');
  };
  return (
    <div className="space-y-2" data-testid="edit-section">
      <div className="section-title">Édition des géométries</div>
      {layer.role !== 'annotations' && (
        <button className={`btn ${drawTarget === layer.id && tool.startsWith('draw-') ? 'on' : ''}`} onClick={startAdd} data-testid="edit-add">
          <Plus size={13} /> Ajouter un objet à cette couche
        </button>
      )}
      {!has ? (
        <p className="text-[11px] text-zinc-500">Cliquez un objet de cette couche sur la carte (Maj + clic pour en sélectionner plusieurs).</p>
      ) : (
        <>
          <p className="text-[11px] text-zinc-500">{n} objet(s) sélectionné(s)</p>
          <div className="flex flex-wrap gap-1">
            {tool === 'edit' ? (
              <button className="btn" onClick={() => (stopVertexEdit(), st().setTool('select'))} data-testid="edit-done">
                <Check size={13} /> Terminer
              </button>
            ) : (
              <button className="btn" onClick={() => startVertexEdit()} title="Déplacer les sommets ou tout l’objet (glisser)" data-testid="edit-vertices">
                <PenLine size={13} /> Modifier / déplacer
              </button>
            )}
            <button className="btn" onClick={() => st().setTool('split')} title="Tracer une ligne de coupe" data-testid="edit-split">
              <Scissors size={13} /> Découper
            </button>
            <button className="btn" onClick={mergeSelection} disabled={n < 2} title="Fusionner les objets sélectionnés" data-testid="edit-merge">
              <Merge size={13} /> Fusionner
            </button>
            <button className="btn" onClick={explodeSelection} title="Séparer un objet multiple">
              <SplitSquareHorizontal size={13} /> Séparer
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button className="btn" onClick={() => transformSelection('rotate', -5)} title="Rotation −5°">
              <RotateCcw size={13} />
            </button>
            <button className="btn" onClick={() => transformSelection('rotate', 5)} title="Rotation +5°">
              <RotateCw size={13} />
            </button>
            <button className="btn" onClick={() => transformSelection('scale', 1.1)} title="Agrandir de 10 %">
              <Expand size={13} />
            </button>
            <button className="btn" onClick={() => transformSelection('scale', 1 / 1.1)} title="Réduire de 10 %">
              <Shrink size={13} />
            </button>
            {(
              [
                ['↑', [0, 1]],
                ['↓', [0, -1]],
                ['←', [-1, 0]],
                ['→', [1, 0]],
              ] as const
            ).map(([l, v]) => (
              <button key={l} className="btn px-2" onClick={() => transformSelection('move', v as any)} title="Déplacer de 1 m">
                {l}
              </button>
            ))}
            <button className="btn" onClick={duplicateSelection} title="Dupliquer">
              <Copy size={13} />
            </button>
            <button className="btn-danger" onClick={deleteSelection} title="Supprimer (Suppr)" data-testid="edit-delete">
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
