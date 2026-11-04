'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fmtArea, fmtLength, metricArea, metricLength } from '@/lib/proj';

/** Attributs de l'objet sélectionné, modifiables. */
export default function FeatureInfo() {
  const sel = useStore((s) => s.selection);
  const site = useStore((s) => s.site!);
  const f = useStore((s) => (s.selection ? s.data[s.selection.layerId]?.features.find((x) => x.properties?._fid === s.selection!.fid) : undefined));
  const [newKey, setNewKey] = useState('');
  if (!sel || !f) return null;
  const props = f.properties || {};
  const keys = Object.keys(props).filter((k) => !k.startsWith('_'));
  const setProp = (k: string, v: any) =>
    useStore.getState().commit(
      (d) => {
        const fc = d.data[sel.layerId];
        d.data[sel.layerId] = {
          ...fc,
          features: fc.features.map((x) => (x.properties?._fid === sel.fid ? { ...x, properties: { ...x.properties, [k]: v } } : x)),
        };
      },
      { touched: [sel.layerId] },
    );
  const delProp = (k: string) =>
    useStore.getState().commit(
      (d) => {
        const fc = d.data[sel.layerId];
        d.data[sel.layerId] = {
          ...fc,
          features: fc.features.map((x) => {
            if (x.properties?._fid !== sel.fid) return x;
            const p = { ...x.properties };
            delete p[k];
            return { ...x, properties: p };
          }),
        };
      },
      { touched: [sel.layerId] },
    );
  const g = f.geometry;
  const isPoly = g && /Polygon/.test(g.type);
  const isLine = g && /LineString/.test(g.type);
  return (
    <div data-testid="feature-info">
      <div className="section-title mb-1">Objet sélectionné</div>
      <div className="mb-2 text-[12px] text-zinc-600 dark:text-zinc-400">
        {g?.type}
        {isPoly && ` · surface ${fmtArea(metricArea(site.utm, g))} · périmètre ${fmtLength(metricLength(site.utm, g))}`}
        {isLine && ` · longueur ${fmtLength(metricLength(site.utm, g))}`}
      </div>
      <table className="data">
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td className="w-[40%] align-top font-medium text-zinc-600 dark:text-zinc-400">{k}</td>
              <td>
                <input
                  key={`${sel.fid}-${k}-${String(props[k])}`}
                  className="w-full bg-transparent outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800"
                  defaultValue={props[k] === null || props[k] === undefined ? '' : typeof props[k] === 'object' ? JSON.stringify(props[k]) : String(props[k])}
                  onBlur={(e) => {
                    const v = e.target.value;
                    const old = props[k] === null || props[k] === undefined ? '' : String(props[k]);
                    if (v === old) return;
                    const n = Number(v);
                    setProp(k, v !== '' && Number.isFinite(n) && typeof props[k] === 'number' ? n : v);
                  }}
                />
              </td>
              <td className="w-5">
                <button className="text-zinc-400 hover:text-red-600" onClick={() => delProp(k)} title="Supprimer l’attribut">
                  <Trash2 size={11} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (newKey.trim() && !newKey.startsWith('_')) {
            setProp(newKey.trim(), '');
            setNewKey('');
          }
        }}
      >
        <input className="input" placeholder="Nouvel attribut" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <button className="btn" title="Ajouter un attribut">
          <Plus size={13} />
        </button>
      </form>
    </div>
  );
}
