import * as turf from '@turf/turf';
import type { Feature, Position } from 'geojson';
import { fmtLength, metricLength } from './proj';
import type { FC, Site } from './types';

export type AnnKind = 'point' | 'line' | 'polygon' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'marker' | 'dimension' | 'freehand';

export const ANN_LABELS: Record<AnnKind, string> = {
  point: 'Point',
  line: 'Ligne',
  polygon: 'Polygone',
  rectangle: 'Rectangle',
  circle: 'Cercle',
  arrow: 'Flèche',
  text: 'Texte',
  marker: 'Repère numéroté',
  dimension: 'Cotation',
  freehand: 'Croquis à main levée',
};

export function bearingDeg(a: Position, b: Position) {
  return turf.bearing(turf.point(a), turf.point(b));
}

function readableRot(bearing: number) {
  let r = bearing - 90;
  while (r > 90) r -= 180;
  while (r <= -90) r += 180;
  return r;
}

/** Éléments dérivés d'une couche d'annotations : pointes de flèches, cotes (texte + traits de rappel). */
export function annotationDecorations(fc: FC | undefined, site: Site): FC {
  const out: Feature[] = [];
  if (!fc) return { type: 'FeatureCollection', features: [] };
  for (const f of fc.features) {
    const p = f.properties || {};
    const g = f.geometry;
    if (!g || g.type !== 'LineString' || g.coordinates.length < 2) continue;
    const cs = g.coordinates;
    const base = { _color: p._color, _width: p._width };
    if (p._kind === 'arrow') {
      const a = cs[cs.length - 2];
      const b = cs[cs.length - 1];
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { ...base, _icon: 'arrowhead', _rot: bearingDeg(a, b), _isize: 10 + 3 * (p._width || 2) } });
      if (p._double) {
        out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: cs[0] }, properties: { ...base, _icon: 'arrowhead', _rot: bearingDeg(cs[1], cs[0]), _isize: 10 + 3 * (p._width || 2) } });
      }
    } else if (p._kind === 'dimension') {
      const len = metricLength(site.utm, g);
      const a = cs[0];
      const b = cs[cs.length - 1];
      const br = bearingDeg(a, b);
      const mid = turf.along(turf.lineString(cs), len / 2 / 1000, { units: 'kilometers' }).geometry.coordinates;
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid }, properties: { ...base, _label: p._text || fmtLength(len), _rot: readableRot(br), _size: p._size || 12 } });
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: a }, properties: { ...base, _icon: 'tick', _rot: br, _isize: 16 } });
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { ...base, _icon: 'tick', _rot: br, _isize: 16 } });
    }
  }
  return { type: 'FeatureCollection', features: out as any };
}

/** Prochain numéro de repère disponible dans une couche d'annotations. */
export function nextMarkerNumber(fc: FC | undefined): number {
  let n = 0;
  for (const f of fc?.features || []) if (f.properties?._kind === 'marker') n = Math.max(n, Number(f.properties._num) || 0);
  return n + 1;
}

export function markerLegend(fc: FC | undefined): { num: number; text: string; color: string }[] {
  return (fc?.features || [])
    .filter((f) => f.properties?._kind === 'marker')
    .map((f) => ({ num: Number(f.properties!._num), text: String(f.properties!._legend || ''), color: f.properties!._color || '#dc2626' }))
    .sort((a, b) => a.num - b.num);
}
