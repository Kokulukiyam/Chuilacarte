'use client';
import { useEffect, useRef, useState } from 'react';
import { Box, Crosshair, FileUp, Hexagon, ImagePlus, Loader2, Move, RotateCcw, RotateCw, Sun, Target, Check, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { mapRef } from '@/lib/mapref';
import { applyCalage, computeShadows, importPlanDxf, importPlanImage, projectFigures, setPlacement, startDrawProject, updateCalageOverlay, useCalage, useShadow } from '@/lib/projectTools';
import { fmtArea, fmtNum, toUtm, fromUtm } from '@/lib/proj';
import type { Layer } from '@/lib/types';

function Section({ title, icon: I, children, testid }: { title: string; icon: any; children: React.ReactNode; testid?: string }) {
  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="section-title flex items-center gap-1.5">
        <I size={12} /> {title}
      </div>
      {children}
    </div>
  );
}

export default function ProjectPanel() {
  const site = useStore((s) => s.site!);
  const selected = useStore((s) => s.selectedLayerId);
  const projects = site.layers.filter((l) => l.role === 'project');
  const current = projects.find((l) => l.id === selected) || projects[0];
  const [busy, setBusy] = useState<string | null>(null);
  const [units, setUnits] = useState<'auto' | 'm' | 'cm' | 'mm'>('auto');
  const dxfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const toast = useStore.getState().toast;
  return (
    <div className="space-y-5 p-3" data-testid="project-panel">
      <Section title="Implanter un projet" icon={FileUp}>
        <div className="flex flex-wrap gap-1">
          <button className="btn" onClick={() => dxfRef.current?.click()} disabled={!!busy} data-testid="project-import-dxf">
            {busy === 'dxf' ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} Plan DXF
          </button>
          <button className="btn" onClick={() => imgRef.current?.click()} disabled={!!busy} data-testid="project-import-image">
            {busy === 'img' ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Image / scan
          </button>
          <button className="btn" onClick={startDrawProject} data-testid="project-draw">
            <Hexagon size={13} /> Dessiner l’emprise
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12px]">
          Unités du DXF
          <select className="input w-32" value={units} onChange={(e) => setUnits(e.target.value as any)} data-testid="project-units">
            <option value="auto">Automatique</option>
            <option value="m">mètres</option>
            <option value="cm">centimètres</option>
            <option value="mm">millimètres</option>
          </select>
        </label>
        <input
          ref={dxfRef}
          type="file"
          accept=".dxf"
          className="hidden"
          data-testid="project-dxf-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy('dxf');
            try {
              const r = await importPlanDxf(f, units);
              toast(r.isLocal ? `Plan importé (${r.count} objets, unités : ${r.units}). Calez-le : déplacer, tourner ou calage par points.` : `Plan géoréférencé importé (${r.count} objets).`, 'ok');
            } catch (x: any) {
              toast(x.message, 'error');
            } finally {
              setBusy(null);
            }
          }}
        />
        <input
          ref={imgRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          data-testid="project-image-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy('img');
            try {
              await importPlanImage(f);
              toast('Image importée : calez-la (déplacer, tourner, échelle ou calage par points) et réglez sa transparence.', 'ok');
            } catch (x: any) {
              toast(x.message, 'error');
            } finally {
              setBusy(null);
            }
          }}
        />
        {projects.length > 0 && (
          <select className="input" value={current?.id} onChange={(e) => useStore.getState().selectLayer(e.target.value, { keepTab: true })} data-testid="project-select">
            {projects.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </Section>
      {current?.placement && <CalageSection layer={current} />}
      {current && current.kind === 'vector' && <ProjectFigures layer={current} />}
      <View3dSection />
      <ShadowSection />
    </div>
  );
}

function CalageSection({ layer }: { layer: Layer }) {
  const p = layer.placement!;
  const cal = useCalage();
  const tool = useStore((s) => s.tool);
  const site = useStore((s) => s.site!);
  const set = (fn: (x: typeof p) => void, history = true) => setPlacement(layer.id, fn, { history });
  const nudge = (dx: number, dy: number) =>
    set((x) => {
      const o = toUtm(site.utm, x.anchor);
      x.anchor = fromUtm(site.utm, [o[0] + dx, o[1] + dy]);
    });
  useEffect(() => {
    if (cal.layerId !== layer.id) cal.set({ layerId: layer.id, pairs: [], pending: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id]);

  // déplacement à la souris : on glisse le plan sur la carte
  useEffect(() => {
    const map = mapRef.map;
    if (!map || !cal.moveMode) return;
    map.dragPan.disable();
    map.getCanvas().style.cursor = 'move';
    let start: { lng: number; lat: number; anchor: [number, number] } | null = null;
    const down = (e: any) => {
      const l = useStore.getState().site!.layers.find((x) => x.id === layer.id);
      if (!l?.placement) return;
      start = { lng: e.lngLat.lng, lat: e.lngLat.lat, anchor: l.placement.anchor };
    };
    const move = (e: any) => {
      if (!start) return;
      const s = useStore.getState().site!;
      const a = toUtm(s.utm, [start.lng, start.lat]);
      const b = toUtm(s.utm, [e.lngLat.lng, e.lngLat.lat]);
      const o = toUtm(s.utm, start.anchor);
      setPlacement(layer.id, (x) => (x.anchor = fromUtm(s.utm, [o[0] + b[0] - a[0], o[1] + b[1] - a[1]])), { history: false });
    };
    const up = () => {
      if (start) set(() => {}); // une entrée d'historique à la fin du glisser
      start = null;
    };
    map.on('mousedown', down);
    map.on('mousemove', move);
    map.on('mouseup', up);
    return () => {
      map.off('mousedown', down);
      map.off('mousemove', move);
      map.off('mouseup', up);
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal.moveMode, layer.id]);
  useEffect(() => {
    updateCalageOverlay();
  }, [cal.pairs, cal.pending, layer.placement]);

  return (
    <Section title="Caler le plan" icon={Target} testid="calage-section">
      <div className="flex flex-wrap gap-1">
        <button className={`btn ${cal.moveMode ? 'on' : ''}`} onClick={() => cal.set({ moveMode: !cal.moveMode })} data-testid="calage-move">
          <Move size={13} /> {cal.moveMode ? 'Terminer le déplacement' : 'Déplacer à la souris'}
        </button>
        <button
          className="btn"
          onClick={() => {
            const c = mapRef.map?.getCenter();
            if (c) set((x) => (x.anchor = [c.lng, c.lat]));
          }}
          title="Placer au centre de la vue"
        >
          <Crosshair size={13} /> Centrer
        </button>
      </div>
      <div className="flex items-center gap-1">
        {(
          [
            ['←', -1, 0],
            ['→', 1, 0],
            ['↑', 0, 1],
            ['↓', 0, -1],
          ] as const
        ).map(([l, dx, dy]) => (
          <button key={l} className="btn px-2" onClick={() => nudge(dx, dy)} title="Déplacer de 1 m">
            {l}
          </button>
        ))}
        <button className="btn px-2" onClick={() => set((x) => (x.rotation -= 1))} title="Rotation −1°">
          <RotateCw size={13} />
        </button>
        <button className="btn px-2" onClick={() => set((x) => (x.rotation += 1))} title="Rotation +1°">
          <RotateCcw size={13} />
        </button>
      </div>
      <label className="field">
        Rotation : {fmtNum(p.rotation, 1)}°
        <input type="range" min={-180} max={180} step={0.5} value={p.rotation} onChange={(e) => set((x) => (x.rotation = Number(e.target.value)), false)} onPointerUp={() => set(() => {})} className="w-full" data-testid="calage-rotation" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Rotation (°)
          <input type="number" className="input" step={0.1} value={Number(p.rotation.toFixed(2))} onChange={(e) => set((x) => (x.rotation = Number(e.target.value) || 0))} />
        </label>
        <label className="field">
          {p.units === 'px' ? 'Échelle (m par pixel)' : 'Facteur d’échelle'}
          <input type="number" className="input" step={p.units === 'px' ? 0.001 : 0.01} min={0.0001} value={Number(p.scale.toPrecision(5))} onChange={(e) => Number(e.target.value) > 0 && set((x) => (x.scale = Number(e.target.value)))} data-testid="calage-scale" />
        </label>
      </div>
      {layer.kind === 'raster' && (
        <label className="field">
          Transparence : {Math.round((1 - layer.opacity) * 100)} %
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) =>
              useStore.getState().commit((d) => {
                const l = d.site.layers.find((x) => x.id === layer.id);
                if (l) l.opacity = Number(e.target.value);
              })
            }
            className="w-full"
            data-testid="calage-opacity"
          />
        </label>
      )}
      <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
        <div className="mb-1 text-[12px] font-medium">Calage par points (2 ou 3)</div>
        <p className="hint">
          {tool !== 'calage'
            ? 'Cliquez un point du plan, puis le point correspondant sur la carte. Répétez 2 ou 3 fois.'
            : cal.pending
              ? `Point ${cal.pairs.length + 1} : cliquez maintenant l’emplacement réel sur la carte.`
              : `Point ${cal.pairs.length + 1} : cliquez un point reconnaissable sur le plan.`}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {tool !== 'calage' ? (
            <button className="btn" onClick={() => (cal.set({ pairs: [], pending: null }), useStore.getState().setTool('calage'))} data-testid="calage-points">
              <Target size={13} /> Commencer
            </button>
          ) : (
            <>
              <button
                className="btn-primary"
                disabled={cal.pairs.length < 2}
                onClick={() => {
                  try {
                    const h = applyCalage();
                    useStore.getState().toast(`Calage appliqué : rotation ${fmtNum(h.rotation, 2)}°, échelle ${fmtNum(h.scale, 5)}${cal.pairs.length > 2 ? `, écart moyen ${fmtNum(h.rms, 2)} m` : ''}`, 'ok');
                  } catch (e: any) {
                    useStore.getState().toast(e.message, 'error');
                  }
                }}
                data-testid="calage-apply"
              >
                <Check size={13} /> Appliquer ({cal.pairs.length} pts)
              </button>
              <button className="btn-ghost" onClick={() => (cal.set({ pairs: [], pending: null }), useStore.getState().setTool('select'), updateCalageOverlay())}>
                <X size={13} /> Annuler
              </button>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

function ProjectFigures({ layer }: { layer: Layer }) {
  const data = useStore((s) => s.data);
  const sel = useStore((s) => s.selection);
  const fig = projectFigures(layer, data);
  const set = (fn: (p: NonNullable<Layer['project']>) => void) =>
    useStore.getState().commit((d) => {
      const l = d.site.layers.find((x) => x.id === layer.id);
      if (!l) return;
      l.project = l.project || { levels: 3, levelHeight: 3 };
      fn(l.project);
    });
  const selPoly = (() => {
    if (!sel || sel.layerId === layer.id) return null;
    const f = data[sel.layerId]?.features.find((x) => x.properties?._fid === sel.fid);
    return f?.geometry && /Polygon/.test(f.geometry.type) ? f : null;
  })();
  return (
    <Section title="Programme et calculs" icon={Box} testid="project-figures">
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Niveaux
          <input type="number" className="input" min={1} max={100} value={layer.project?.levels ?? 3} onChange={(e) => set((p) => (p.levels = Math.max(1, Number(e.target.value) || 1)))} data-testid="project-levels" />
        </label>
        <label className="field">
          Hauteur d’étage (m)
          <input type="number" className="input" min={2} max={10} step={0.1} value={layer.project?.levelHeight ?? 3} onChange={(e) => set((p) => (p.levelHeight = Number(e.target.value) || 3))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[12px]">
        <button
          className="btn"
          disabled={!selPoly}
          title={selPoly ? 'Utiliser l’objet sélectionné comme parcelle' : 'Sélectionnez d’abord un polygone (parcelle) sur la carte'}
          onClick={() => selPoly && set((p) => ((p.parcel = selPoly.geometry as any), (p.parcelName = String(selPoly.properties?.nom || 'parcelle sélectionnée'))))}
          data-testid="project-parcel"
        >
          Parcelle = objet sélectionné
        </button>
        {layer.project?.parcel && <span className="text-zinc-500">({layer.project.parcelName})</span>}
      </div>
      {fig ? (
        <table className="data" data-testid="project-table">
          <tbody>
            <tr>
              <td>Emprise au sol</td>
              <td className="text-right font-medium">{fmtArea(fig.emprise)}</td>
            </tr>
            <tr>
              <td>Hauteur ({fig.levels} niveaux)</td>
              <td className="text-right font-medium">{fmtNum(fig.hauteur, 1)} m</td>
            </tr>
            <tr>
              <td>Surface de plancher</td>
              <td className="text-right font-medium">{fmtArea(fig.plancher)}</td>
            </tr>
            <tr>
              <td>Surface de la parcelle</td>
              <td className="text-right">{fig.parcel ? fmtArea(fig.parcel) : '—'}</td>
            </tr>
            <tr>
              <td>Emprise / parcelle (CES)</td>
              <td className="text-right font-medium">{fig.ces !== null ? `${fmtNum(fig.ces * 100, 1)} %` : '—'}</td>
            </tr>
            <tr>
              <td>Plancher / parcelle (COS)</td>
              <td className="text-right font-medium">{fig.cos !== null ? fmtNum(fig.cos, 2) : '—'}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="hint">Pas encore de polygone dans ce projet.</p>
      )}
      <p className="text-[10px] text-zinc-500">Un calque DXF nommé « PARCELLE » est pris comme parcelle et exclu de l’emprise bâtie.</p>
    </Section>
  );
}

function View3dSection() {
  const mode3d = useStore((s) => s.mode3d);
  const settings = useStore((s) => s.site!.settings);
  const setS = (fn: (s: any) => void) => useStore.getState().commit((d) => fn(d.site.settings));
  return (
    <Section title="Vue 3D" icon={Box} testid="view3d-section">
      <button className={`btn ${mode3d ? 'on' : ''}`} onClick={() => useStore.getState().setUi({ mode3d: !mode3d })} data-testid="toggle-3d">
        <Box size={13} /> {mode3d ? 'Revenir en 2D' : 'Passer en 3D'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Hauteur par défaut du bâti (m)
          <input type="number" className="input" min={1} max={100} step={0.5} value={settings.defaultHeight} onChange={(e) => setS((s) => (s.defaultHeight = Math.max(1, Number(e.target.value) || 6)))} data-testid="default-height" />
        </label>
        <label className="field">
          Hauteur d’un niveau (m)
          <input type="number" className="input" min={2} max={10} step={0.1} value={settings.levelHeight} onChange={(e) => setS((s) => (s.levelHeight = Number(e.target.value) || 3))} />
        </label>
      </div>
      <p className="hint">Bâti existant : hauteur ou niveaux quand ils sont connus, sinon la hauteur par défaut. Clic droit + glisser (ou Ctrl + glisser) pour incliner et tourner la vue.</p>
    </Section>
  );
}

function ShadowSection() {
  const sh = useShadow();
  const tool = useStore((s) => s.tool);
  void tool;
  const run = () => {
    try {
      computeShadows();
    } catch (e: any) {
      useStore.getState().toast(`Ombres : ${e.message}`, 'error');
    }
  };
  const t = sh.time.split(':').map(Number);
  const minutes = t[0] * 60 + (t[1] || 0);
  return (
    <Section title="Ombres portées" icon={Sun} testid="shadow-section">
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Date
          <input type="date" className="input" value={sh.date} onChange={(e) => (sh.set({ date: e.target.value }), setTimeout(run, 0))} data-testid="shadow-date" />
        </label>
        <label className="field">
          Heure (Sénégal, UTC)
          <input type="time" className="input" value={sh.time} onChange={(e) => (sh.set({ time: e.target.value }), setTimeout(run, 0))} data-testid="shadow-time" />
        </label>
      </div>
      <input
        type="range"
        min={360}
        max={1140}
        step={15}
        value={minutes}
        onChange={(e) => {
          const m = Number(e.target.value);
          sh.set({ time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
          setTimeout(run, 0);
        }}
        className="w-full"
        data-testid="shadow-slider"
      />
      <div className="flex flex-wrap gap-1">
        {[
          ['21 mars', '-03-21'],
          ['21 juin', '-06-21'],
          ['21 déc.', '-12-21'],
        ].map(([l, md]) => (
          <button key={l} className="btn px-2 py-1 text-[11px]" onClick={() => (sh.set({ date: `${sh.date.slice(0, 4)}${md}` }), setTimeout(run, 0))}>
            {l}
          </button>
        ))}
        <button className="btn-primary" onClick={run} data-testid="shadow-run">
          <Sun size={13} /> Calculer les ombres
        </button>
      </div>
      {sh.info && <p className="text-[11px] text-zinc-600 dark:text-zinc-400" data-testid="shadow-info">{sh.info}</p>}
      <p className="text-[10px] text-zinc-500">Ombres du projet et du bâti voisin visibles à l’écran, calculées à partir des hauteurs (position du soleil : SunCalc).</p>
    </Section>
  );
}
