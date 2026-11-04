'use client';
import { Ruler, LandPlot, Save, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useMeasure, measureToAnnotation } from '@/lib/annotate';
import { useOverlay } from '@/lib/overlays';
import { fmtArea, fmtLength } from '@/lib/proj';

export default function MeasurePanel() {
  const m = useMeasure((s) => s.last);
  const utm = useStore((s) => s.site!.utm);
  return (
    <div className="space-y-2" data-testid="measure-panel">
      <div className="section-title">Mesures</div>
      <p className="text-[11px] text-zinc-500">Calculées dans la projection métrique du site (UTM {utm.zone}{utm.south ? 'S' : 'N'}, EPSG:{utm.epsg}).</p>
      <div className="flex gap-1">
        <button className="btn" onClick={() => useStore.getState().setTool('measure-distance')} data-testid="measure-distance">
          <Ruler size={13} /> Distance
        </button>
        <button className="btn" onClick={() => useStore.getState().setTool('measure-area')} data-testid="measure-area">
          <LandPlot size={13} /> Surface / périmètre
        </button>
      </div>
      {m && (
        <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-800/60" data-testid="measure-result">
          {m.kind === 'distance' ? (
            <>
              <div className="text-lg font-semibold">{fmtLength(m.value)}</div>
              {m.segments && m.segments.length > 1 && (
                <ol className="mt-1 text-[11px] text-zinc-500">
                  {m.segments.map((s, i) => (
                    <li key={i}>
                      Segment {i + 1} : {fmtLength(s)}
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <>
              <div className="text-lg font-semibold">{fmtArea(m.value)}</div>
              <div className="text-[12px] text-zinc-600 dark:text-zinc-400">Périmètre : {fmtLength(m.perimeter || 0)}</div>
            </>
          )}
          <div className="mt-2 flex gap-1">
            <button className="btn" onClick={measureToAnnotation} title="Garder la mesure comme annotation (cotation ou polygone)" data-testid="measure-save">
              <Save size={13} /> Garder sur la carte
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                useMeasure.getState().set({ last: null });
                useOverlay.getState().set({ measure: { type: 'FeatureCollection', features: [] } });
              }}
            >
              <X size={13} /> Effacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
