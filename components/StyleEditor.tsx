'use client';
import { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CATEGORY_PALETTE, PRESETS, RAMPS, cloneStyle, computeGradClasses } from '@/lib/styles';
import { OP_LABELS, matchAll } from '@/lib/filters';
import type { FilterRule, HatchKind, Layer, LayerStyle, PointShape } from '@/lib/types';

function upd(id: string, fn: (l: Layer) => void) {
  useStore.getState().commit((d) => {
    const l = d.site.layers.find((x) => x.id === id);
    if (l) fn(l);
  });
}

function Color({ value, onChange, label, testid }: { value: string; onChange: (v: string) => void; label: string; testid?: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700" data-testid={testid} />
      <span className="text-[12px]">{label}</span>
    </label>
  );
}

function Num({ value, onChange, label, min = 0, max = 50, step = 0.1 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px]">
      <span>{label}</span>
      <input type="number" className="input w-20" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function useFields(layerId: string) {
  const fc = useStore((s) => s.data[layerId]);
  return useMemo(() => {
    const m = new Map<string, { n: number; num: number; values: Map<string, number> }>();
    for (const f of fc?.features || []) {
      for (const [k, v] of Object.entries(f.properties || {})) {
        if (k.startsWith('_') || v === null || v === undefined || typeof v === 'object') continue;
        let e = m.get(k);
        if (!e) m.set(k, (e = { n: 0, num: 0, values: new Map() }));
        e.n++;
        if (Number.isFinite(Number(v)) && v !== '') e.num++;
        if (e.values.size < 200) e.values.set(String(v), (e.values.get(String(v)) || 0) + 1);
      }
    }
    return [...m.entries()].map(([name, e]) => ({ name, numeric: e.num === e.n && e.n > 0, values: e.values, count: e.n }));
  }, [fc]);
}

export default function StyleEditor({ layer }: { layer: Layer }) {
  const fields = useFields(layer.id);
  if (layer.kind !== 'vector' || layer.role === 'annotations') return null;
  const s = layer.style;
  const set = (fn: (s: LayerStyle) => void) => upd(layer.id, (l) => fn(l.style));
  const isPoly = layer.geom === 'polygon' || layer.geom === 'mixed';
  const isLine = layer.geom === 'line' || layer.geom === 'mixed';
  const isPoint = layer.geom === 'point' || layer.geom === 'mixed';
  const presets = PRESETS.filter((p) => p.geom === layer.geom || p.geom === 'any' || layer.geom === 'mixed');

  return (
    <div className="space-y-4" data-testid="style-editor">
      <div>
        <div className="section-title mb-1">Style prédéfini</div>
        <select
          className="input"
          value=""
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value);
            if (p) upd(layer.id, (l) => (l.style = cloneStyle(p.style)));
          }}
          data-testid="style-preset"
        >
          <option value="">Appliquer un style de la bibliothèque…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="section-title">Symbole</div>
        <div className="flex gap-1">
          {(['simple', 'categorized', 'graduated', ...(isPoint && layer.geom === 'point' ? (['heatmap'] as const) : [])] as const).map((m) => (
            <button key={m} className={`tool-btn border border-zinc-200 px-2 text-[12px] dark:border-zinc-700 ${s.mode === m ? 'active' : ''}`} onClick={() => set((x) => (x.mode = m))} data-testid={`style-mode-${m}`}>
              {m === 'simple' ? 'Simple' : m === 'categorized' ? 'Catégorisé' : m === 'graduated' ? 'Gradué' : 'Chaleur'}
            </button>
          ))}
        </div>
        {(isPoly || isPoint) && (
          <div className="grid grid-cols-2 gap-2">
            {s.mode === 'simple' && <Color label="Remplissage" value={s.fill} onChange={(v) => set((x) => (x.fill = v))} testid="style-fill" />}
            <label className="text-[12px]">
              Opacité {Math.round(s.fillOpacity * 100)} %
              <input type="range" min={0} max={1} step={0.05} value={s.fillOpacity} onChange={(e) => set((x) => (x.fillOpacity = Number(e.target.value)))} className="w-full" />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(s.mode === 'simple' || !isLine || layer.geom === 'mixed') && <Color label="Contour / trait" value={s.stroke} onChange={(v) => set((x) => (x.stroke = v))} testid="style-stroke" />}
          <Num label="Épaisseur" value={s.strokeWidth} min={0} max={20} step={0.1} onChange={(v) => set((x) => (x.strokeWidth = v))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px]">
            Type de trait
            <select className="input" value={s.dash} onChange={(e) => set((x) => (x.dash = e.target.value as any))}>
              <option value="solid">Continu</option>
              <option value="dash">Tirets</option>
              <option value="dot">Pointillés</option>
            </select>
          </label>
          <label className="text-[12px]">
            Opacité du trait
            <input type="range" min={0} max={1} step={0.05} value={s.strokeOpacity} onChange={(e) => set((x) => (x.strokeOpacity = Number(e.target.value)))} className="w-full" />
          </label>
        </div>
        {isPoly && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px]">
              Hachures
              <select className="input" value={s.hatch} onChange={(e) => set((x) => (x.hatch = e.target.value as HatchKind))} data-testid="style-hatch">
                <option value="none">Aucune</option>
                <option value="diag">Diagonales /</option>
                <option value="diag-rev">Diagonales \</option>
                <option value="cross">Croisées</option>
                <option value="horiz">Horizontales</option>
                <option value="vert">Verticales</option>
                <option value="dots">Points</option>
              </select>
            </label>
            {s.hatch !== 'none' && <Color label="Couleur hachures" value={s.hatchColor} onChange={(v) => set((x) => (x.hatchColor = v))} />}
          </div>
        )}
        {isPoint && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px]">
              Forme
              <select className="input" value={s.pointShape} onChange={(e) => set((x) => (x.pointShape = e.target.value as PointShape))} data-testid="style-shape">
                <option value="circle">Cercle</option>
                <option value="square">Carré</option>
                <option value="triangle">Triangle</option>
                <option value="diamond">Losange</option>
                <option value="star">Étoile</option>
                <option value="cross">Croix</option>
              </select>
            </label>
            <Num label="Taille" value={s.pointSize} min={1} max={60} step={0.5} onChange={(v) => set((x) => (x.pointSize = v))} />
          </div>
        )}
      </div>

      {s.mode === 'heatmap' && (
        <div className="grid grid-cols-2 gap-2">
          <Num label="Rayon (px)" value={s.heatmap?.radius ?? 30} min={2} max={200} step={1} onChange={(v) => set((x) => (x.heatmap = { radius: v, intensity: x.heatmap?.intensity ?? 1 }))} />
          <Num label="Intensité" value={s.heatmap?.intensity ?? 1} min={0.1} max={10} step={0.1} onChange={(v) => set((x) => (x.heatmap = { radius: x.heatmap?.radius ?? 30, intensity: v }))} />
        </div>
      )}
      {s.mode === 'categorized' && <CategorizedEditor layer={layer} fields={fields} />}
      {s.mode === 'graduated' && <GraduatedEditor layer={layer} fields={fields} />}

      <div className="space-y-2">
        <div className="section-title">Étiquettes</div>
        <select
          className="input"
          value={s.label?.field || ''}
          onChange={(e) =>
            set((x) => {
              x.label = e.target.value ? { field: e.target.value, size: x.label?.size || 11, color: x.label?.color || '#1f2937', halo: x.label?.halo || '#ffffff', weight: x.label?.weight || 'regular' } : null;
            })
          }
          data-testid="style-label-field"
        >
          <option value="">Pas d’étiquette</option>
          {fields.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        {s.label && (
          <div className="grid grid-cols-2 gap-2">
            <Num label="Taille" value={s.label.size} min={6} max={48} step={0.5} onChange={(v) => set((x) => (x.label!.size = v))} />
            <label className="text-[12px]">
              Graisse
              <select className="input" value={s.label.weight} onChange={(e) => set((x) => (x.label!.weight = e.target.value as any))}>
                <option value="regular">Normale</option>
                <option value="bold">Grasse</option>
              </select>
            </label>
            <Color label="Couleur" value={s.label.color} onChange={(v) => set((x) => (x.label!.color = v))} />
            <Color label="Halo" value={s.label.halo} onChange={(v) => set((x) => (x.label!.halo = v))} />
          </div>
        )}
      </div>
    </div>
  );
}

function CategorizedEditor({ layer, fields }: { layer: Layer; fields: ReturnType<typeof useFields> }) {
  const s = layer.style;
  const cat = s.categorized || { field: '', classes: [], other: '#9ca3af' };
  const set = (fn: (c: NonNullable<LayerStyle['categorized']>) => void) =>
    upd(layer.id, (l) => {
      l.style.categorized = l.style.categorized || { field: '', classes: [], other: '#9ca3af' };
      fn(l.style.categorized);
    });
  const classify = (field: string) => {
    const f = fields.find((x) => x.name === field);
    if (!f) return;
    const vals = [...f.values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    set((c) => {
      c.field = field;
      c.classes = vals.map(([v], i) => ({ value: v, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length], label: v }));
    });
  };
  return (
    <div className="space-y-2" data-testid="categorized-editor">
      <div className="section-title">Catégories</div>
      <div className="flex gap-1">
        <select className="input" value={cat.field} onChange={(e) => classify(e.target.value)} data-testid="cat-field">
          <option value="">Attribut…</option>
          {fields.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name} ({f.values.size}
              {f.values.size >= 200 ? '+' : ''} valeurs)
            </option>
          ))}
        </select>
        <button className="btn" title="Recalculer les catégories" onClick={() => classify(cat.field)} disabled={!cat.field}>
          <Wand2 size={13} />
        </button>
      </div>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {cat.classes.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input type="color" value={c.color} onChange={(e) => set((x) => (x.classes[i].color = e.target.value))} className="h-5 w-7 cursor-pointer" />
            <span className="w-20 truncate text-[11px] text-zinc-500" title={c.value}>
              {c.value}
            </span>
            <input className="input flex-1 py-0.5" value={c.label ?? c.value} onChange={(e) => set((x) => (x.classes[i].label = e.target.value))} title="Libellé dans la légende" />
            <button className="text-zinc-400 hover:text-red-600" onClick={() => set((x) => x.classes.splice(i, 1))}>
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Color label="Autres valeurs" value={cat.other} onChange={(v) => set((x) => (x.other = v))} />
        <button className="btn-ghost" onClick={() => set((x) => x.classes.push({ value: '', color: '#888888', label: '' }))}>
          <Plus size={12} /> Classe
        </button>
      </div>
    </div>
  );
}

function GraduatedEditor({ layer, fields }: { layer: Layer; fields: ReturnType<typeof useFields> }) {
  const s = layer.style;
  const fc = useStore((st) => st.data[layer.id]);
  const gr = s.graduated || { field: '', method: 'quantile' as const, ramp: 'orange', classes: [] };
  const [n, setN] = useState(Math.max(3, gr.classes.length || 5));
  const numeric = fields.filter((f) => f.numeric);
  const compute = (field: string, method: 'equal' | 'quantile', ramp: string, k = n) => {
    const vals = (fc?.features || []).map((f) => Number(f.properties?.[field])).filter(Number.isFinite);
    upd(layer.id, (l) => {
      l.style.graduated = { field, method, ramp, classes: computeGradClasses(vals, method, ramp, k) };
    });
  };
  return (
    <div className="space-y-2" data-testid="graduated-editor">
      <div className="section-title">Classes graduées</div>
      <select className="input" value={gr.field} onChange={(e) => compute(e.target.value, gr.method, gr.ramp)} data-testid="grad-field">
        <option value="">Attribut numérique…</option>
        {numeric.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-1">
        <select className="input" value={gr.method} onChange={(e) => compute(gr.field, e.target.value as any, gr.ramp)} disabled={!gr.field}>
          <option value="quantile">Quantiles</option>
          <option value="equal">Intervalles égaux</option>
        </select>
        <select className="input" value={gr.ramp} onChange={(e) => compute(gr.field, gr.method, e.target.value)} disabled={!gr.field}>
          {Object.keys(RAMPS).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="input"
          min={2}
          max={9}
          value={n}
          onChange={(e) => {
            const k = Math.max(2, Math.min(9, Number(e.target.value)));
            setN(k);
            if (gr.field) compute(gr.field, gr.method, gr.ramp, k);
          }}
          title="Nombre de classes"
        />
      </div>
      <ul className="space-y-1">
        {gr.classes.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[12px]">
            <input
              type="color"
              value={c.color}
              onChange={(e) =>
                upd(layer.id, (l) => {
                  l.style.graduated!.classes[i].color = e.target.value;
                })
              }
              className="h-5 w-7 cursor-pointer"
            />
            {fmt(c.min)} – {fmt(c.max)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('fr-FR') : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));

export function FilterEditor({ layer }: { layer: Layer }) {
  const fields = useFields(layer.id);
  const fc = useStore((s) => s.data[layer.id]);
  if (layer.kind !== 'vector') return null;
  const rules = layer.filter || [];
  const set = (fn: (r: FilterRule[]) => void) =>
    upd(layer.id, (l) => {
      l.filter = l.filter || [];
      fn(l.filter);
    });
  const matching = (() => {
    if (!rules.length || !fc) return null;
    return fc.features.filter((f) => matchAll(f.properties || {}, rules)).length;
  })();
  return (
    <div className="space-y-2" data-testid="filter-editor">
      <div className="flex items-center justify-between">
        <div className="section-title">Filtre attributaire</div>
        {matching !== null && (
          <span className="text-[11px] text-zinc-500">
            {matching} / {fc?.features.length} objets affichés
          </span>
        )}
      </div>
      {rules.map((r, i) => {
        const f = fields.find((x) => x.name === r.field);
        return (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
            <select className="input" value={r.field} onChange={(e) => set((x) => (x[i].field = e.target.value))} data-testid="filter-field">
              <option value="">Attribut…</option>
              {fields.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
            <select className="input" value={r.op} onChange={(e) => set((x) => (x[i].op = e.target.value as any))} data-testid="filter-op">
              {Object.entries(OP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {r.op === 'exists' ? (
              <span />
            ) : (
              <>
                <input className="input" list={`vals-${layer.id}-${i}`} value={r.value} onChange={(e) => set((x) => (x[i].value = e.target.value))} data-testid="filter-value" />
                <datalist id={`vals-${layer.id}-${i}`}>
                  {f && [...f.values.keys()].slice(0, 50).map((v) => <option key={v} value={v} />)}
                </datalist>
              </>
            )}
            <button className="text-zinc-400 hover:text-red-600" onClick={() => set((x) => x.splice(i, 1))} aria-label="Supprimer la condition">
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
      <button className="btn-ghost" onClick={() => set((x) => x.push({ field: fields[0]?.name || '', op: '=', value: '' }))} data-testid="filter-add">
        <Plus size={12} /> Ajouter une condition {rules.length ? '(ET)' : ''}
      </button>
    </div>
  );
}
