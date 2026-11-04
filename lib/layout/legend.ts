import type { FC, Layer, Site } from '../types';
import { featureWidth } from '../styles';
import { markerLegend } from '../annotations';

export type Swatch =
  | { kind: 'fill'; fill: string; fillOpacity: number; stroke: string; strokeWidth: number; dash: string; hatch: string; hatchColor: string }
  | { kind: 'line'; stroke: string; strokeWidth: number; dash: string }
  | { kind: 'point'; fill: string; stroke: string; strokeWidth: number; shape: string; size: number }
  | { kind: 'raster'; color: string }
  | { kind: 'marker'; color: string; num: number };

export interface LegendItem {
  label: string;
  swatch: Swatch;
}

export interface LegendGroup {
  layerId: string;
  title?: string; // titre pour les couches thématiques (catégorisé / gradué / raster)
  items: LegendItem[];
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('fr-FR') : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }));

/** Légende générée à partir des couches visibles (ordre de la pile, du haut vers le bas). */
function inView(fc: FC, b: number[]) {
  for (const f of fc.features) {
    if (!f.geometry) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const v = (c: any) => {
      if (typeof c[0] === 'number') {
        x0 = Math.min(x0, c[0]);
        x1 = Math.max(x1, c[0]);
        y0 = Math.min(y0, c[1]);
        y1 = Math.max(y1, c[1]);
      } else c.forEach(v);
    };
    v((f.geometry as any).coordinates ?? []);
    if (!(x1 < b[0] || x0 > b[2] || y1 < b[1] || y0 > b[3])) {
      // un polygone qui englobe tout le cadre (zone tampon) ne compte que si son contour y passe
      if (/Polygon/.test(f.geometry.type) && x0 < b[0] && x1 > b[2] && y0 < b[1] && y1 > b[3]) continue;
      return true;
    }
  }
  return false;
}

/** Légende générée à partir des couches visibles (ordre de la pile, du haut vers le bas) ; `bbox` : seulement ce qui est dans le cadre. */
export function buildLegend(site: Site, data: Record<string, FC>, opts: { hidden?: string[]; labels?: Record<string, string>; bbox?: number[] } = {}): LegendGroup[] {
  const groups: LegendGroup[] = [];
  const hidden = new Set(opts.hidden || []);
  for (const l of site.layers) {
    if (!l.visible || l.legend === false || hidden.has(l.id)) continue;
    const label = opts.labels?.[l.id] || l.legendLabel || l.name;
    if (l.kind === 'raster') {
      if (l.raster?.legend?.length) groups.push({ layerId: l.id, title: label, items: l.raster.legend.map((e) => ({ label: e.label, swatch: { kind: 'raster', color: e.color } })) });
      continue;
    }
    const fc = data[l.id];
    if (!fc || !fc.features.length) continue;
    if (opts.bbox && !inView(fc, opts.bbox)) continue;
    if (l.role === 'annotations') {
      const marks = markerLegend(fc);
      if (marks.length) groups.push({ layerId: l.id, title: label === 'Annotations' ? 'Repères' : label, items: marks.map((m) => ({ label: m.text || `Repère ${m.num}`, swatch: { kind: 'marker', color: m.color, num: m.num } })) });
      continue;
    }
    const s = l.style;
    const make = (fill: string, stroke: string, width = s.strokeWidth): Swatch =>
      l.geom === 'line'
        ? { kind: 'line', stroke, strokeWidth: width, dash: s.dash }
        : l.geom === 'point'
          ? { kind: 'point', fill, stroke: s.stroke, strokeWidth: s.strokeWidth, shape: s.pointShape, size: s.pointSize }
          : { kind: 'fill', fill, fillOpacity: s.fillOpacity, stroke: s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, hatch: s.hatch, hatchColor: s.hatchColor };
    if (s.mode === 'heatmap') {
      groups.push({ layerId: l.id, title: label, items: [{ label: 'Faible densité', swatch: { kind: 'raster', color: '#fed976' } }, { label: 'Densité moyenne', swatch: { kind: 'raster', color: '#fd8d3c' } }, { label: 'Forte densité', swatch: { kind: 'raster', color: '#bd0026' } }] });
      continue;
    }
    if (s.mode === 'categorized' && s.categorized?.classes.length) {
      // seulement les valeurs présentes dans la couche
      const present = new Set(fc.features.map((f) => String(f.properties?.[s.categorized!.field] ?? '')));
      const items = s.categorized.classes
        .filter((c) => present.has(String(c.value)))
        .map((c) => ({ label: c.label || c.value, swatch: make(c.color, l.geom === 'line' ? c.color : s.stroke, featureWidth(s, { [s.categorized!.field]: c.value })) }));
      // valeurs présentes hors des classes : dessinées dans la couleur « autre », donc une entrée « Autres »
      const known = new Set(s.categorized.classes.map((c) => String(c.value)));
      if ([...present].some((v) => !known.has(v))) items.push({ label: 'Autres', swatch: make(s.categorized.other, l.geom === 'line' ? s.categorized.other : s.stroke) });
      if (items.length) groups.push({ layerId: l.id, title: label, items });
      continue;
    }
    if (s.mode === 'graduated' && s.graduated?.classes.length) {
      groups.push({
        layerId: l.id,
        title: `${label}${s.graduated.field ? ` (${s.graduated.field})` : ''}`,
        items: s.graduated.classes.map((c) => ({ label: `${fmt(c.min)} – ${fmt(c.max)}`, swatch: make(c.color, l.geom === 'line' ? c.color : s.stroke) })),
      });
      continue;
    }
    groups.push({ layerId: l.id, items: [{ label, swatch: make(s.fill, s.stroke) }] });
  }
  return groups;
}

export function legendLayerIds(site: Site) {
  return site.layers.filter((l) => l.visible).map((l: Layer) => l.id);
}
