'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { FileDown, Image as ImageIcon, Loader2, Plus, Save, Trash2, X, Crosshair, Copy } from 'lucide-react';
import { askText } from '@/lib/dialogs';
import { useStore } from '@/lib/store';
import { BASEMAPS } from '@/lib/basemaps';
import { useConfig } from '@/lib/config';
import { siteBBox } from '@/lib/site';
import { applyScale, newLayout, pageSize, relayout } from '@/lib/layout/defaults';
import { fitScale, makeProjector, SCALES } from '@/lib/layout/geo';
import { renderLayoutSvg, FONT_STACKS, defaultSymbolScale } from '@/lib/layout/svg';
import { renderBasemap, type BasemapRender } from '@/lib/layout/basemap';
import { fmtNum } from '@/lib/proj';
import { exportLayout, fetchInset } from '@/lib/layout/export';
import { flushNow } from '@/lib/autosave';
import type { Layout, LayoutElement } from '@/lib/types';
import { buildLegend } from '@/lib/layout/legend';

const ELEMENT_LABELS: Record<LayoutElement['type'], string> = {
  title: 'Titre',
  subtitle: 'Sous-titre',
  legend: 'Légende',
  scalebar: 'Barre d’échelle',
  north: 'Flèche du nord',
  cartouche: 'Cartouche',
  inset: 'Encart de situation',
  text: 'Texte libre',
  logo: 'Logo',
};

const DEFAULT_SIZES: Record<LayoutElement['type'], [number, number, Record<string, any>]> = {
  title: [120, 12, { text: 'Titre', size: 20, weight: 'bold' }],
  subtitle: [120, 8, { text: 'Sous-titre', size: 12 }],
  legend: [70, 80, { title: 'Légende', size: 7.5, columns: 1 }],
  scalebar: [60, 12, { size: 7, segments: 4 }],
  north: [10, 14, {}],
  cartouche: [80, 45, { size: 6.5 }],
  inset: [50, 40, { title: 'Situation' }],
  text: [60, 15, { text: 'Texte', size: 9 }],
  logo: [30, 20, {}],
};

function updateLayout(id: string, fn: (l: Layout) => void) {
  useStore.getState().commit((d) => {
    const l = d.site.layouts.find((x) => x.id === id);
    if (l) fn(l);
  });
}

export default function LayoutEditor() {
  const site = useStore((s) => s.site!);
  const data = useStore((s) => s.data);
  const cfg = useConfig((s) => s.cfg);
  const [layoutId, setLayoutId] = useState<string | null>(site.layouts[0]?.id || null);
  const layout = site.layouts.find((l) => l.id === layoutId) || null;
  const [sel, setSel] = useState<string | null>(null);
  const [bm, setBm] = useState<BasemapRender | null>(null);
  const [bmBusy, setBmBusy] = useState(false);
  const [inset, setInset] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ el: string; handle?: string; x0: number; y0: number; orig: any; dx: number; dy: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 800, h: 600 });

  // création automatique d'une première mise en page
  useEffect(() => {
    if (!site.layouts.length) {
      const l = newLayout(site);
      useStore.getState().commit((d) => void d.site.layouts.push(l));
      setLayoutId(l.id);
    } else if (!layout) setLayoutId(site.layouts[0].id);
    fetch('/api/templates')
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
    fetchInset(site).then(setInset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [!!layout]);

  // échelle d'affichage : la page tient dans la zone
  const fit = layout ? Math.min((wrapSize.w - 48) / layout.width, (wrapSize.h - 48) / layout.height) : 1;
  const pxPerMm = fit * zoom;

  // fond de carte de l'aperçu (résolution écran), recalculé après une pause
  const bmKey = layout ? JSON.stringify([layout.center, layout.scale, layout.basemap, layout.mapFrame, layout.width, layout.height, layout.bearing, site.overlays, site.layers.filter((l) => (l.kind === 'raster' || l.style.mode === 'heatmap') && l.visible).map((l) => [l.id, l.opacity, l.raster, l.style.heatmap])]) : '';
  useEffect(() => {
    if (!layout) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setBmBusy(true);
      try {
        const dpi = Math.max(50, Math.min(150, pxPerMm * 25.4 * (window.devicePixelRatio || 1)));
        const r = await renderBasemap(layout, site, { dpi, maxMegapixels: 12, data: useStore.getState().data });
        if (!cancelled) setBm(r);
      } catch (e) {
        console.warn('aperçu du fond', e);
      } finally {
        if (!cancelled) setBmBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmKey, Math.round(pxPerMm * 4)]);

  const preview = useMemo(() => {
    if (!layout) return null;
    // pendant un glisser du cadre, la carte suit par une translation CSS (plus fluide)
    return renderLayoutSvg({ layout, site, data, basemap: bm?.tiles, basemapLabels: bm?.labelTiles, background: bm?.background, inset, basemapUsed: bm?.used, editor: true, selectedElement: sel });
  }, [layout, site, data, bm, inset, sel]);

  if (!layout) return <div className="flex flex-1 items-center justify-center text-zinc-500">Préparation de la mise en page…</div>;
  const set = (fn: (l: Layout) => void) => updateLayout(layout.id, fn);
  const selEl = layout.elements.find((e) => e.id === sel);

  const toMm = (e: React.PointerEvent) => {
    const svg = wrap.current!.querySelector('svg')!;
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * layout.width, ((e.clientY - r.top) / r.height) * layout.height];
  };
  const onDown = (e: React.PointerEvent) => {
    const t = e.target as Element;
    const id = t.getAttribute('data-el');
    if (!id) {
      setSel(null);
      return;
    }
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSel(id);
    const [x, y] = toMm(e);
    const orig = id === '__map' ? { ...(layout.mapFrame || makeProjector(layout).frame), center: layout.center } : { ...layout.elements.find((x) => x.id === id) };
    setDrag({ el: id, handle: t.getAttribute('data-handle') || undefined, x0: x, y0: y, orig, dx: 0, dy: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const [x, y] = toMm(e);
    setDrag({ ...drag, dx: x - drag.x0, dy: y - drag.y0 });
  };
  const onUp = () => {
    if (!drag) return;
    const { el, handle, dx, dy, orig } = drag;
    setDrag(null);
    if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
    set((l) => {
      if (el === '__map') {
        if (handle === 'se') l.mapFrame = { x: orig.x, y: orig.y, w: Math.max(30, orig.w + dx), h: Math.max(30, orig.h + dy) };
        else {
          // glisser dans le cadre : déplacer la carte (le contenu suit la souris)
          const pr = makeProjector({ ...l, center: orig.center });
          const c = pr.frame;
          l.center = pr.unproject(c.x + c.w / 2 - dx, c.y + c.h / 2 - dy);
        }
        return;
      }
      const it = l.elements.find((x) => x.id === el);
      if (!it) return;
      if (handle === 'se') {
        it.w = Math.max(5, orig.w + dx);
        it.h = Math.max(4, orig.h + dy);
      } else {
        it.x = Math.round((orig.x + dx) * 10) / 10;
        it.y = Math.round((orig.y + dy) * 10) / 10;
      }
    });
  };

  // aperçu pendant le glisser (sans réécrire la mise en page)
  let liveSvg = preview?.svg || '';
  if (drag && preview) {
    const tmp: Layout = structuredClone(layout);
    if (drag.el === '__map') {
      if (drag.handle === 'se') tmp.mapFrame = { x: drag.orig.x, y: drag.orig.y, w: Math.max(30, drag.orig.w + drag.dx), h: Math.max(30, drag.orig.h + drag.dy) };
    } else {
      const it = tmp.elements.find((x) => x.id === drag.el);
      if (it) {
        if (drag.handle === 'se') {
          it.w = Math.max(5, drag.orig.w + drag.dx);
          it.h = Math.max(4, drag.orig.h + drag.dy);
        } else {
          it.x = drag.orig.x + drag.dx;
          it.y = drag.orig.y + drag.dy;
        }
      }
    }
    if (drag.el !== '__map' || drag.handle === 'se') liveSvg = renderLayoutSvg({ layout: tmp, site, data, basemap: bm?.tiles, basemapLabels: bm?.labelTiles, background: bm?.background, inset, basemapUsed: bm?.used, editor: true, selectedElement: sel }).svg;
    else liveSvg = preview.svg.replace('<g id="carte" clip-path="url(#cadre)">', `<g clip-path="url(#cadre)"><g id="carte" transform="translate(${drag.dx} ${drag.dy})">`).replace('<rect id="cadre-carte"', '</g><rect id="cadre-carte"');
  }

  const addElement = (type: LayoutElement['type']) => {
    const [w, h, props] = DEFAULT_SIZES[type];
    const f = makeProjector(layout).frame;
    const e: LayoutElement = { id: nanoid(6), type, x: f.x + 5, y: f.y + 5, w, h, props: { ...props } };
    set((l) => void l.elements.push(e));
    setSel(e.id);
  };
  const runExport = async (kind: 'png' | 'pdf' | 'svg') => {
    setBusy(kind);
    try {
      await flushNow();
      const r = await exportLayout(kind, layout, site, useStore.getState().data, { onProgress: (m) => setBusy(`${kind}:${m}`) });
      useStore.getState().toast(`Export ${kind.toUpperCase()} : ${r.name} (${fmtNum(r.size / 1e6, 1)} Mo)${r.note ? ` — ${r.note}` : ''}${r.legendOverflow ? ' — attention : légende incomplète' : ''}`, 'ok');
    } catch (e: any) {
      console.error(e);
      useStore.getState().toast(`Échec de l’export ${kind.toUpperCase()} : ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };
  const legendGroups = buildLegend(site, data);

  return (
    <div className="absolute inset-0 z-20 flex bg-zinc-200 dark:bg-zinc-950" data-testid="layout-editor">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 pl-3 pr-1.5 dark:border-zinc-800">
          <span className="section-title">Mise en page</span>
          <button className="btn-ghost py-0.5 text-[12px]" onClick={() => useStore.getState().setUi({ layoutMode: false })} data-tip="Revenir à la carte" data-testid="layout-close">
            <X size={14} /> Fermer
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div className="flex gap-1">
            <select className="input" value={layout.id} onChange={(e) => setLayoutId(e.target.value)} data-testid="layout-select">
              {site.layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              title="Nouvelle mise en page"
              onClick={() => {
                const l = newLayout(site);
                // « Planche A3 », puis « Planche A3 (2) »… : le nom suit le format (relayout) et reste unique
                const names = new Set(site.layouts.map((x) => x.name));
                for (let k = 2; names.has(l.name); k++) l.name = `Planche ${l.format} (${k})`;
                useStore.getState().commit((d) => void d.site.layouts.push(l));
                setLayoutId(l.id);
              }}
            >
              <Plus size={13} />
            </button>
            <button
              className="btn"
              title="Dupliquer"
              onClick={() => {
                const l = { ...structuredClone(layout), id: nanoid(8), name: `${layout.name} (copie)` };
                useStore.getState().commit((d) => void d.site.layouts.push(l));
                setLayoutId(l.id);
              }}
            >
              <Copy size={13} />
            </button>
            <button
              className="btn"
              title="Supprimer cette mise en page"
              disabled={site.layouts.length < 2}
              onClick={() => {
                const st = useStore.getState();
                st.commit((d) => void (d.site.layouts = d.site.layouts.filter((x) => x.id !== layout.id)));
                setLayoutId(site.layouts.find((x) => x.id !== layout.id)?.id || null);
                st.toast(`Mise en page « ${layout.name} » supprimée`, 'info', { label: 'Annuler', run: () => useStore.getState().undo() });
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <input key={layout.id} className="input" defaultValue={layout.name} onBlur={(e) => e.target.value.trim() && e.target.value !== layout.name && set((l) => (l.name = e.target.value.trim()))} aria-label="Nom de la mise en page" />
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Format
              <select
                className="input"
                value={layout.format}
                onChange={(e) => {
                  const f = e.target.value as Layout['format'];
                  set((l) => Object.assign(l, relayout(site, l, f, l.orientation, f === 'custom' ? [l.width, l.height] : undefined)));
                }}
                data-testid="layout-format"
              >
                {['A4', 'A3', 'A2', 'A1', 'A0', 'custom'].map((f) => (
                  <option key={f} value={f}>
                    {f === 'custom' ? 'Personnalisé' : f}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Orientation
              <select className="input" value={layout.orientation} onChange={(e) => set((l) => Object.assign(l, relayout(site, l, l.format, e.target.value as any, l.format === 'custom' ? [l.height, l.width] : undefined)))} data-testid="layout-orientation">
                <option value="landscape">Paysage</option>
                <option value="portrait">Portrait</option>
              </select>
            </label>
          </div>
          {layout.format === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="field">
                Largeur (mm)
                <input type="number" className="input" defaultValue={layout.width} min={50} max={3000} onBlur={(e) => set((l) => Object.assign(l, relayout(site, l, 'custom', Number(e.target.value) >= l.height ? 'landscape' : 'portrait', [Number(e.target.value), l.height])))} />
              </label>
              <label className="field">
                Hauteur (mm)
                <input type="number" className="input" defaultValue={layout.height} min={50} max={3000} onBlur={(e) => set((l) => Object.assign(l, relayout(site, l, 'custom', l.width >= Number(e.target.value) ? 'landscape' : 'portrait', [l.width, Number(e.target.value)])))} />
              </label>
            </div>
          )}
          <div>
            <label className="field">Échelle</label>
            <div className="flex gap-1">
              <select className="input" value={SCALES.includes(layout.scale) ? layout.scale : 'libre'} onChange={(e) => e.target.value !== 'libre' && set((l) => applyScale(l, Number(e.target.value)))} data-testid="layout-scale">
                {SCALES.map((s) => (
                  <option key={s} value={s}>
                    1/{s.toLocaleString('fr-FR')}
                  </option>
                ))}
                <option value="libre">Libre…</option>
              </select>
              <input type="number" className="input w-28" min={50} max={1000000} value={layout.scale} onChange={(e) => Number(e.target.value) >= 50 && set((l) => applyScale(l, Math.round(Number(e.target.value))))} aria-label="Échelle libre" data-testid="layout-scale-free" />
            </div>
          </div>
          <div className="flex gap-1">
            <button className="btn flex-1" onClick={() => set((l) => ((l.center = site.center), applyScale(l, fitScale(l, siteBBox(site)))))} title="Centrer sur le site et ajuster l’échelle">
              <Crosshair size={13} /> Cadrer le site
            </button>
            <label className="flex items-center gap-1 text-[12px]">
              Rotation
              <input type="number" className="input w-16" value={layout.bearing || 0} step={1} onChange={(e) => set((l) => (l.bearing = Number(e.target.value) || 0))} />°
            </label>
          </div>
          <label className="field">
            Épaisseurs et symboles : ×{fmtNum(layout.symbolScale ?? defaultSymbolScale(layout), 2)}
            <input type="range" min={0.5} max={3} step={0.05} value={layout.symbolScale ?? defaultSymbolScale(layout)} onChange={(e) => set((l) => (l.symbolScale = Number(e.target.value)))} className="w-full" data-testid="layout-symbolscale" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Fond de carte
              <select className="input" value={layout.basemap} onChange={(e) => set((l) => (l.basemap = e.target.value))} data-testid="layout-basemap">
                {BASEMAPS.filter((b) => !(b.requires === 'arcgis' && !cfg.arcgis) && !(b.requires === 'noncommercial' && !cfg.noncommercial)).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.screenOnly ? ' (remplacé à l’export)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Police
              <select className="input" value={layout.font} onChange={(e) => set((l) => (l.font = e.target.value))} data-testid="layout-font">
                {Object.keys(FONT_STACKS).map((f) => (
                  <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="section-title mb-1">Éléments</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ELEMENT_LABELS) as LayoutElement['type'][]).map((t) => (
                <button key={t} className="btn px-2 py-1 text-[11px]" onClick={() => addElement(t)} data-testid={`add-${t}`}>
                  <Plus size={11} /> {ELEMENT_LABELS[t]}
                </button>
              ))}
            </div>
            <ul className="mt-2 text-[12px]">
              <li>
                <button className={`w-full rounded px-1.5 py-1 text-left ${sel === '__map' ? 'bg-accent-100 font-medium text-accent-900 dark:bg-accent-900/40 dark:text-accent-50' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} onClick={() => setSel('__map')}>
                  Cadre de carte
                </button>
              </li>
              {layout.elements.map((e) => (
                <li key={e.id}>
                  <button className={`w-full truncate rounded px-1.5 py-1 text-left ${sel === e.id ? 'bg-accent-100 font-medium text-accent-900 dark:bg-accent-900/40 dark:text-accent-50' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} onClick={() => setSel(e.id)}>
                    {ELEMENT_LABELS[e.type]}
                    {e.props.text ? ` — ${String(e.props.text).slice(0, 30)}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selEl && <ElementProps layout={layout} el={selEl} onDelete={() => (set((l) => void (l.elements = l.elements.filter((x) => x.id !== selEl.id))), setSel(null))} legendGroups={legendGroups} />}
          {sel === '__map' && <p className="text-[11px] text-zinc-500">Glissez dans le cadre pour déplacer la carte ; poignée en bas à droite pour redimensionner le cadre.</p>}

          <div className="space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="section-title">Modèles</div>
            <button
              className="btn"
              onClick={async () => {
                const name = await askText('Enregistrer comme modèle', { label: 'Nom du modèle', okLabel: 'Enregistrer', initial: `${layout.format} ${layout.orientation === 'landscape' ? 'paysage' : 'portrait'} — ${layout.font}` });
                if (!name) return;
                const r = await fetch('/api/templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, layout }) });
                const t = await r.json();
                setTemplates([...templates, t]);
                useStore.getState().toast(`Modèle « ${name} » enregistré`, 'ok');
              }}
              data-testid="template-save"
            >
              <Save size={13} /> Enregistrer comme modèle
            </button>
            {templates.length > 0 && (
              <ul className="text-[12px]">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <button
                      className="truncate text-left hover:underline"
                      onClick={() =>
                        set((l) => {
                          const tl = t.layout as Layout;
                          Object.assign(l, { ...tl, id: l.id, name: l.name, center: l.center, scale: l.scale });
                          // textes propres au site
                          for (const e of l.elements) if (e.type === 'title') e.props.text = e.props.text || site.name;
                        })
                      }
                      title="Appliquer ce modèle"
                    >
                      {t.name}
                    </button>
                    <button
                      className="text-zinc-400 hover:text-red-600"
                      onClick={async () => {
                        await fetch(`/api/templates?id=${t.id}`, { method: 'DELETE' });
                        setTemplates(templates.filter((x) => x.id !== t.id));
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="shrink-0 space-y-1.5 border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="section-title">Exporter la planche</div>
            <div className="grid grid-cols-3 gap-1">
              {(['png', 'pdf', 'svg'] as const).map((k) => (
                <button key={k} className="btn-accent" disabled={!!busy} onClick={() => runExport(k)} data-testid={`export-${k}`}>
                  {busy?.startsWith(k) ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} {k.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="hint">{busy ? busy.split(':').slice(1).join(':') || 'Export en cours…' : 'PNG 300 dpi au format choisi · PDF vectoriel · SVG pour Illustrator. Une copie est gardée dans le dossier exports/ du site.'}</p>
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 text-[12px] dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-medium">
            {layout.format === 'custom' ? `${layout.width} × ${layout.height} mm` : `${layout.format} ${layout.orientation === 'landscape' ? 'paysage' : 'portrait'}`} · 1/{layout.scale.toLocaleString('fr-FR')}
          </span>
          {bmBusy && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Loader2 size={12} className="animate-spin" /> fond de carte…
            </span>
          )}
          {bm?.note && <span className="text-amber-700 dark:text-amber-400">{bm.note}</span>}
          {preview?.legendOverflow && <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">Légende incomplète : agrandissez son cadre</span>}
          <span className="ml-auto flex items-center gap-1">
            Zoom
            <button className="icon-btn h-6 w-6" onClick={() => setZoom(Math.max(0.25, zoom / 1.25))} aria-label="Dézoomer" data-tip="Dézoomer">
              −
            </button>
            <span className="w-11 text-center tabular-nums">{Math.round(zoom * 100)} %</span>
            <button className="icon-btn h-6 w-6" onClick={() => setZoom(Math.min(6, zoom * 1.25))} aria-label="Zoomer" data-tip="Zoomer">
              +
            </button>
            <button className="btn-ghost py-0.5 text-[12px]" onClick={() => setZoom(1)} data-tip="Afficher toute la planche">
              Ajuster
            </button>
          </span>
        </div>
        <div ref={wrap} className="relative min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            <div
              className="bg-white shadow-modal ring-1 ring-zinc-300 dark:ring-zinc-700"
              style={{ width: layout.width * pxPerMm, height: layout.height * pxPerMm, touchAction: 'none' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              data-testid="layout-page"
              dangerouslySetInnerHTML={{ __html: liveSvg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="${layout.width * pxPerMm}" height="${layout.height * pxPerMm}"`) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ElementProps({ layout, el, onDelete, legendGroups }: { layout: Layout; el: LayoutElement; onDelete: () => void; legendGroups: ReturnType<typeof buildLegend> }) {
  const site = useStore((s) => s.site!);
  const set = (fn: (p: Record<string, any>, e: LayoutElement) => void) => updateLayout(layout.id, (l) => {
    const e = l.elements.find((x) => x.id === el.id);
    if (e) fn(e.props, e);
  });
  const p = el.props;
  const txt = (k: string, label: string, rows = 1) => (
    <label className="field">
      {label}
      {rows > 1 ? (
        <textarea key={el.id + k} className="input" rows={rows} defaultValue={p[k] || ''} onBlur={(e) => e.target.value !== (p[k] || '') && set((pp) => (pp[k] = e.target.value))} />
      ) : (
        <input key={el.id + k} className="input" defaultValue={p[k] || ''} onBlur={(e) => e.target.value !== (p[k] || '') && set((pp) => (pp[k] = e.target.value))} data-testid={`prop-${k}`} />
      )}
    </label>
  );
  const num = (k: string, label: string, min: number, max: number, step = 0.5, def?: number) => (
    <label className="field">
      {label}
      <input type="number" className="input" min={min} max={max} step={step} value={p[k] ?? def ?? ''} onChange={(e) => set((pp) => (pp[k] = Number(e.target.value)))} />
    </label>
  );
  return (
    <div className="space-y-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-700" data-testid="element-props">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{ELEMENT_LABELS[el.type]}</span>
        <button className="btn-ghost text-red-600" onClick={onDelete} title="Retirer l’élément">
          <Trash2 size={13} />
        </button>
      </div>
      {(el.type === 'title' || el.type === 'subtitle' || el.type === 'text') && (
        <>
          {txt('text', 'Texte', el.type === 'text' ? 3 : 1)}
          <div className="grid grid-cols-2 gap-2">
            {num('size', 'Taille (pt)', 4, 200, 0.5)}
            <label className="field">
              Graisse
              <select className="input" value={p.weight || (el.type === 'title' ? 'bold' : 'regular')} onChange={(e) => set((pp) => (pp.weight = e.target.value))}>
                <option value="light">Fine</option>
                <option value="regular">Normale</option>
                <option value="bold">Grasse</option>
              </select>
            </label>
            <label className="field">
              Alignement
              <select className="input" value={p.align || 'left'} onChange={(e) => set((pp) => (pp.align = e.target.value))}>
                <option value="left">Gauche</option>
                <option value="center">Centré</option>
                <option value="right">Droite</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="color" value={p.color || '#18181b'} onChange={(e) => set((pp) => (pp.color = e.target.value))} /> Couleur
            </label>
            <label className="col-span-2 flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={!!p.uppercase} onChange={(e) => set((pp) => (pp.uppercase = e.target.checked))} /> Capitales
            </label>
          </div>
        </>
      )}
      {el.type === 'legend' && (
        <>
          {txt('title', 'Titre de la légende')}
          <div className="grid grid-cols-2 gap-2">
            {num('size', 'Taille (pt)', 4, 40, 0.5)}
            {num('columns', 'Colonnes', 1, 4, 1)}
          </div>
          <div className="text-[12px] font-medium">Entrées (libellés modifiables)</div>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {site.layers
              .filter((l) => l.visible && l.legend !== false)
              .filter((l) => legendGroups.some((g) => g.layerId === l.id))
              .map((l) => (
                <li key={l.id} className="flex items-center gap-1">
                  <input type="checkbox" checked={!(p.hidden || []).includes(l.id)} onChange={(e) => set((pp) => (pp.hidden = e.target.checked ? (pp.hidden || []).filter((x: string) => x !== l.id) : [...(pp.hidden || []), l.id]))} title="Afficher dans la légende" />
                  <input
                    key={el.id + l.id}
                    className="input py-0.5"
                    defaultValue={p.labels?.[l.id] || l.legendLabel || l.name}
                    onBlur={(e) => set((pp) => (pp.labels = { ...(pp.labels || {}), [l.id]: e.target.value }))}
                  />
                </li>
              ))}
          </ul>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={p.frame !== false} onChange={(e) => set((pp) => (pp.frame = e.target.checked))} /> Cadre et fond blanc
          </label>
        </>
      )}
      {el.type === 'scalebar' && (
        <div className="grid grid-cols-2 gap-2">
          {num('size', 'Taille du texte (pt)', 4, 30)}
          {num('segments', 'Segments', 1, 10, 1)}
          <label className="col-span-2 flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={p.showRatio !== false} onChange={(e) => set((pp) => (pp.showRatio = e.target.checked))} /> Afficher « Échelle 1/… »
          </label>
        </div>
      )}
      {el.type === 'cartouche' && (
        <>
          {txt('projet', 'Nom du projet')}
          {txt('auteur', 'Auteur')}
          {txt('date', 'Date (vide = aujourd’hui)')}
          {txt('moa', 'Maître d’ouvrage')}
          {txt('phase', 'Phase (esquisse, APS…)')}
          {txt('planche', 'N° de planche')}
          {txt('mention', 'Mention libre')}
          {num('size', 'Taille (pt)', 4, 30)}
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={p.showSources !== false} onChange={(e) => set((pp) => (pp.showSources = e.target.checked))} /> Sources dans le cartouche
          </label>
        </>
      )}
      {el.type === 'inset' && txt('title', 'Titre de l’encart')}
      {el.type === 'logo' && (
        <label className="btn cursor-pointer">
          <ImageIcon size={13} /> Choisir une image…
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 3e6) return useStore.getState().toast('Image trop lourde (3 Mo au maximum)', 'error');
              const r = new FileReader();
              r.onload = () => set((pp) => (pp.href = r.result));
              r.readAsDataURL(f);
            }}
          />
        </label>
      )}
      <div className="grid grid-cols-4 gap-1 text-[11px]">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <label key={k}>
            {k.toUpperCase()} (mm)
            <input type="number" className="input px-1" value={Math.round(el[k] * 10) / 10} onChange={(e) => set((_, ee) => (ee[k] = Number(e.target.value)))} />
          </label>
        ))}
      </div>
    </div>
  );
}

export { pageSize };
