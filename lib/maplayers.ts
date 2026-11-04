'use client';
import type { ExpressionSpecification, LayerSpecification, Map as MlMap } from 'maplibre-gl';
import type { FilterRule, Layer, LayerStyle, Site, FC } from './types';
import { DASH, ROAD_CLASSES } from './styles';
import { FONT_BOLD, FONT_REGULAR, absUrl } from './basemaps';
import { annotationDecorations } from './annotations';

type Expr = ExpressionSpecification;

const POLY: Expr = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const LINE: Expr = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
const PT: Expr = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]];

export function filterExpr(rules: FilterRule[]): Expr | null {
  const parts: Expr[] = [];
  for (const r of rules || []) {
    if (!r.field) continue;
    const g: Expr = ['get', r.field];
    const n = Number(String(r.value).replace(',', '.'));
    switch (r.op) {
      case 'exists':
        parts.push(['all', ['has', r.field], ['!=', ['to-string', g], '']]);
        break;
      case '=':
        parts.push(['==', ['to-string', g], r.value]);
        break;
      case '!=':
        parts.push(['!=', ['to-string', g], r.value]);
        break;
      case 'contains':
        parts.push(['in', r.value.toLowerCase(), ['downcase', ['to-string', g]]]);
        break;
      default:
        if (!Number.isFinite(n)) {
          parts.push(['==', 1, 0]);
          break;
        }
        parts.push(['all', ['has', r.field], [r.op as '>', ['to-number', g, -1e300], n]] as Expr);
    }
  }
  if (!parts.length) return null;
  return ['all', ...parts] as Expr;
}

function withFilter(base: Expr, rules: FilterRule[]): Expr {
  const f = filterExpr(rules);
  return f ? (['all', base, f] as Expr) : base;
}

export function colorExpr(style: LayerStyle, base: string): Expr | string {
  if (style.mode === 'categorized' && style.categorized && style.categorized.field) {
    const pairs: any[] = [];
    const seen = new Set<string>();
    for (const c of style.categorized.classes) {
      const v = String(c.value);
      if (seen.has(v)) continue;
      seen.add(v);
      pairs.push(v, c.color);
    }
    if (!pairs.length) return style.categorized.other;
    return ['match', ['to-string', ['get', style.categorized.field]], ...pairs, style.categorized.other] as Expr;
  }
  if (style.mode === 'graduated' && style.graduated && style.graduated.field && style.graduated.classes.length) {
    const cls = style.graduated.classes;
    const step: any[] = ['step', ['to-number', ['get', style.graduated.field], 0], cls[0].color];
    for (let i = 1; i < cls.length; i++) {
      // les seuils doivent être strictement croissants
      if (cls[i].min <= (step.length > 3 ? step[step.length - 2] : -Infinity)) continue;
      step.push(cls[i].min, cls[i].color);
    }
    return ['case', ['has', style.graduated.field], step as Expr, base] as Expr;
  }
  return base;
}

function widthExpr(style: LayerStyle): Expr | number {
  if (style.preset === 'voirie' && style.mode === 'categorized' && style.categorized) {
    const k = style.strokeWidth / 1.2;
    const pairs: any[] = [];
    for (const r of ROAD_CLASSES) pairs.push(r.value, r.width * k);
    return ['match', ['to-string', ['get', style.categorized.field]], ...pairs, style.strokeWidth] as Expr;
  }
  return style.strokeWidth;
}

export function hatchImageId(kind: string, color: string) {
  return `hatch-${kind}-${color.replace('#', '')}`;
}

export function heightExpr(levelHeight: number, def: number): Expr {
  return [
    'case',
    ['all', ['has', 'hauteur'], ['>', ['to-number', ['get', 'hauteur'], 0], 0]],
    ['to-number', ['get', 'hauteur']],
    ['all', ['has', 'niveaux'], ['>', ['to-number', ['get', 'niveaux'], 0], 0]],
    ['*', ['to-number', ['get', 'niveaux']], levelHeight],
    def,
  ] as Expr;
}

export interface BuildOpts {
  slug: string;
  mode3d: boolean;
  site: Site;
}

/** Spécifications MapLibre (couches) d'une couche du site. */
export function layerSpecs(layer: Layer, o: BuildOpts): LayerSpecification[] {
  const src = `src-${layer.id}`;
  const vis = layer.visible ? 'visible' : 'none';
  const s = layer.style;
  const out: LayerSpecification[] = [];
  const op = layer.opacity;
  if (layer.kind === 'raster') {
    out.push({ id: `lyr-${layer.id}-raster`, type: 'raster', source: src, layout: { visibility: vis }, paint: { 'raster-opacity': op, 'raster-fade-duration': 0, ...(layer.raster?.legend ? { 'raster-resampling': 'nearest' as const } : {}) } });
    return out;
  }
  if (layer.role === 'annotations') return annotationSpecs(layer, vis, op);
  if (layer.style.mode === 'heatmap') return [heatmapSpec(layer, vis, op)];
  const fillColor = colorExpr(s, s.fill);
  const strokeColor = layer.geom === 'line' ? colorExpr(s, s.stroke) : s.stroke;
  const dash = DASH[s.dash];
  const extrude = o.mode3d && (layer.role === 'buildings' || layer.role === 'project');

  if (layer.geom !== 'line' && layer.geom !== 'point') {
    if (extrude) {
      const h: Expr | number =
        layer.role === 'project'
          ? (['case', ['has', 'hauteur'], ['to-number', ['get', 'hauteur'], 0], (layer.project?.levels ?? 3) * (layer.project?.levelHeight ?? 3)] as Expr)
          : heightExpr(o.site.settings.levelHeight, o.site.settings.defaultHeight);
      const notParcel: Expr = ['!', ['in', 'PARCEL', ['upcase', ['to-string', ['coalesce', ['get', 'calque'], '']]]]];
      out.push({
        id: `lyr-${layer.id}-outline`,
        type: 'line',
        source: src,
        filter: withFilter(POLY, layer.filter),
        layout: { visibility: vis },
        paint: { 'line-color': s.stroke, 'line-width': Math.max(0.5, s.strokeWidth), 'line-opacity': 0.8 * op },
      });
      out.push({
        id: `lyr-${layer.id}-ext`,
        type: 'fill-extrusion',
        source: src,
        filter: withFilter(layer.role === 'project' ? (['all', POLY, notParcel] as Expr) : POLY, layer.filter),
        layout: { visibility: vis },
        paint: {
          'fill-extrusion-color': fillColor as any,
          'fill-extrusion-height': h as any,
          'fill-extrusion-opacity': Math.min(1, op * 0.95),
          'fill-extrusion-vertical-gradient': true,
        },
      });
    } else {
      out.push({
        id: `lyr-${layer.id}-fill`,
        type: 'fill',
        source: src,
        filter: withFilter(POLY, layer.filter),
        layout: { visibility: vis },
        paint: { 'fill-color': fillColor as any, 'fill-opacity': s.fillOpacity * op, 'fill-antialias': true },
      });
      if (s.hatch !== 'none') {
        out.push({
          id: `lyr-${layer.id}-hatch`,
          type: 'fill',
          source: src,
          filter: withFilter(POLY, layer.filter),
          layout: { visibility: vis },
          paint: { 'fill-pattern': hatchImageId(s.hatch, s.hatchColor), 'fill-opacity': op },
        });
      }
      if (s.strokeWidth > 0) {
        out.push({
          id: `lyr-${layer.id}-outline`,
          type: 'line',
          source: src,
          filter: withFilter(POLY, layer.filter),
          layout: { visibility: vis, 'line-join': 'round' },
          paint: { 'line-color': strokeColor as any, 'line-width': s.strokeWidth, 'line-opacity': s.strokeOpacity * op, ...(dash ? { 'line-dasharray': dash } : {}) },
        });
      }
    }
  }
  if (layer.geom === 'line' || layer.geom === 'mixed') {
    out.push({
      id: `lyr-${layer.id}-line`,
      type: 'line',
      source: src,
      filter: withFilter(LINE, layer.filter),
      layout: { visibility: vis, 'line-join': 'round', 'line-cap': dash ? 'butt' : 'round' },
      paint: { 'line-color': colorExpr(s, s.stroke) as any, 'line-width': widthExpr(s) as any, 'line-opacity': s.strokeOpacity * op, ...(dash ? { 'line-dasharray': dash } : {}) },
    });
  }
  if (layer.geom === 'point' || layer.geom === 'mixed') {
    if (s.pointShape === 'circle') {
      out.push({
        id: `lyr-${layer.id}-point`,
        type: 'circle',
        source: src,
        filter: withFilter(PT, layer.filter),
        layout: { visibility: vis },
        paint: {
          'circle-radius': s.pointSize / 2,
          'circle-color': fillColor as any,
          'circle-opacity': s.fillOpacity * op,
          'circle-stroke-color': s.stroke,
          'circle-stroke-width': s.strokeWidth,
          'circle-stroke-opacity': s.strokeOpacity * op,
        },
      });
    } else {
      out.push({
        id: `lyr-${layer.id}-point`,
        type: 'symbol',
        source: src,
        filter: withFilter(PT, layer.filter),
        layout: { visibility: vis, 'icon-image': `shape-${s.pointShape}`, 'icon-size': s.pointSize / 24, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: {
          'icon-color': fillColor as any,
          'icon-opacity': s.fillOpacity * op,
          'icon-halo-color': s.stroke,
          'icon-halo-width': s.strokeWidth > 0 ? Math.max(0.5, s.strokeWidth) : 0,
        },
      });
    }
  }
  if (s.label && s.label.field) {
    const isLine = layer.geom === 'line';
    out.push({
      id: `lyr-${layer.id}-label`,
      type: 'symbol',
      source: src,
      filter: withFilter(['has', s.label.field] as Expr, layer.filter),
      layout: {
        visibility: vis,
        'text-field': ['to-string', ['get', s.label.field]],
        'text-font': s.label.weight === 'bold' ? FONT_BOLD : FONT_REGULAR,
        'text-size': s.label.size,
        'symbol-placement': isLine ? 'line' : 'point',
        'text-max-width': 10,
        ...(layer.geom === 'point' ? { 'text-offset': [0, 1.1], 'text-anchor': 'top' } : {}),
      },
      paint: { 'text-color': s.label.color, 'text-halo-color': s.label.halo, 'text-halo-width': 1.4, 'text-opacity': op },
    });
  }
  return out;
}

export const HEAT_RAMP: [number, string][] = [
  [0, 'rgba(255,255,178,0)'],
  [0.2, '#fed976'],
  [0.4, '#feb24c'],
  [0.6, '#fd8d3c'],
  [0.8, '#f03b20'],
  [1, '#bd0026'],
];

export function heatmapSpec(layer: Layer, vis: 'visible' | 'none', op: number, srcId = `src-${layer.id}`): LayerSpecification {
  const h = layer.style.heatmap || { radius: 30, intensity: 1 };
  return {
    id: `lyr-${layer.id}-heat`,
    type: 'heatmap',
    source: srcId,
    filter: withFilter(PT, layer.filter),
    layout: { visibility: vis },
    paint: {
      'heatmap-radius': h.radius,
      'heatmap-intensity': h.intensity,
      'heatmap-opacity': 0.85 * op,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...HEAT_RAMP.flat()] as any,
    },
  };
}

function annotationSpecs(layer: Layer, vis: 'visible' | 'none', op: number): LayerSpecification[] {
  const src = `src-${layer.id}`;
  const deco = `src-${layer.id}-deco`;
  const color: Expr = ['coalesce', ['get', '_color'], '#dc2626'];
  return [
    {
      id: `lyr-${layer.id}-afill`,
      type: 'fill',
      source: src,
      filter: POLY,
      layout: { visibility: vis },
      paint: { 'fill-color': ['coalesce', ['get', '_fill'], ['get', '_color'], '#dc2626'] as Expr, 'fill-opacity': ['*', ['coalesce', ['get', '_fillOpacity'], 0.15], op] as Expr },
    },
    {
      id: `lyr-${layer.id}-aoutline`,
      type: 'line',
      source: src,
      filter: POLY,
      layout: { visibility: vis, 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': ['coalesce', ['get', '_width'], 2] as Expr, 'line-opacity': op },
    },
    {
      id: `lyr-${layer.id}-aline`,
      type: 'line',
      source: src,
      filter: ['all', LINE, ['!=', ['get', '_kind'], 'dimension']] as Expr,
      layout: { visibility: vis, 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': ['coalesce', ['get', '_width'], 2] as Expr, 'line-opacity': op },
    },
    {
      id: `lyr-${layer.id}-adim`,
      type: 'line',
      source: src,
      filter: ['all', LINE, ['==', ['get', '_kind'], 'dimension']] as Expr,
      layout: { visibility: vis, 'line-cap': 'butt' },
      paint: { 'line-color': color, 'line-width': ['coalesce', ['get', '_width'], 1.2] as Expr, 'line-opacity': op },
    },
    {
      id: `lyr-${layer.id}-adeco-icon`,
      type: 'symbol',
      source: deco,
      filter: ['has', '_icon'] as Expr,
      layout: {
        visibility: vis,
        'icon-image': ['get', '_icon'] as Expr,
        'icon-rotate': ['get', '_rot'] as Expr,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['/', ['coalesce', ['get', '_isize'], 14], 24] as Expr,
      },
      paint: { 'icon-color': color, 'icon-opacity': op },
    },
    {
      id: `lyr-${layer.id}-apoint`,
      type: 'circle',
      source: src,
      filter: ['all', PT, ['match', ['get', '_kind'], ['text', 'marker'], false, true]] as Expr,
      layout: { visibility: vis },
      paint: { 'circle-radius': ['/', ['coalesce', ['get', '_size'], 8], 2] as Expr, 'circle-color': color, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2, 'circle-opacity': op },
    },
    {
      id: `lyr-${layer.id}-amarker`,
      type: 'circle',
      source: src,
      filter: ['all', PT, ['==', ['get', '_kind'], 'marker']] as Expr,
      layout: { visibility: vis },
      paint: { 'circle-radius': ['*', ['coalesce', ['get', '_size'], 14], 0.7] as Expr, 'circle-color': color, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': op },
    },
    {
      id: `lyr-${layer.id}-amarker-num`,
      type: 'symbol',
      source: src,
      filter: ['all', PT, ['==', ['get', '_kind'], 'marker']] as Expr,
      layout: {
        visibility: vis,
        'text-field': ['to-string', ['get', '_num']],
        'text-font': FONT_BOLD,
        'text-size': ['coalesce', ['get', '_size'], 14] as Expr,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#ffffff', 'text-opacity': op },
    },
    {
      id: `lyr-${layer.id}-atext`,
      type: 'symbol',
      source: src,
      filter: ['all', PT, ['==', ['get', '_kind'], 'text']] as Expr,
      layout: {
        visibility: vis,
        'text-field': ['coalesce', ['get', '_text'], 'Texte'] as Expr,
        'text-font': ['case', ['==', ['get', '_weight'], 'bold'], ['literal', FONT_BOLD], ['literal', FONT_REGULAR]] as Expr,
        'text-size': ['coalesce', ['get', '_size'], 16] as Expr,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-rotate': ['coalesce', ['get', '_rotation'], 0] as Expr,
        'text-rotation-alignment': 'map',
        'text-max-width': 30,
      },
      paint: { 'text-color': color, 'text-halo-color': ['coalesce', ['get', '_halo'], '#ffffff'] as Expr, 'text-halo-width': ['case', ['==', ['get', '_halo'], 'none'], 0, 1.5] as Expr, 'text-opacity': op },
    },
    {
      id: `lyr-${layer.id}-adeco-label`,
      type: 'symbol',
      source: deco,
      filter: ['all', PT, ['has', '_label']] as Expr,
      layout: {
        visibility: vis,
        'text-field': ['get', '_label'],
        'text-font': FONT_BOLD,
        'text-size': ['coalesce', ['get', '_size'], 12] as Expr,
        'text-rotate': ['get', '_rot'],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-offset': [0, -0.75],
      },
      paint: { 'text-color': color, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5, 'text-opacity': op },
    },
  ];
}

const applied = new WeakMap<MlMap, Map<string, { styleKey: string; data: any; specIds: string[] }>>();

function sourceSpec(layer: Layer, slug: string, fc: FC | undefined): any {
  if (layer.kind === 'raster' && layer.raster) {
    const r = layer.raster;
    if (r.type === 'image') {
      const url = absUrl(r.url.startsWith('files/') ? `/api/sites/${slug}/${r.url}` : r.url);
      const coords = r.corners
        ? r.corners
        : [
            [r.bounds![0], r.bounds![3]],
            [r.bounds![2], r.bounds![3]],
            [r.bounds![2], r.bounds![1]],
            [r.bounds![0], r.bounds![1]],
          ];
      return { type: 'image', url, coordinates: coords };
    }
    return { type: 'raster', tiles: [absUrl(r.url)], tileSize: r.tileSize || 256, maxzoom: r.maxzoom || 18, attribution: layer.source.attribution };
  }
  return { type: 'geojson', data: fc || { type: 'FeatureCollection', features: [] }, promoteId: '_fid', attribution: layer.source.attribution || undefined };
}

/** Synchronise la carte avec les couches du site (idempotent). */
export function syncLayers(map: MlMap, site: Site, data: Record<string, FC>, o: { mode3d: boolean; beforeId?: string }) {
  let st = applied.get(map);
  if (!st) {
    st = new Map();
    applied.set(map, st);
  }
  const wanted = new Set(site.layers.map((l) => l.id));
  // suppression
  for (const [id, rec] of st) {
    if (!wanted.has(id) || !map.getSource(`src-${id}`)) {
      for (const lid of rec.specIds) if (map.getLayer(lid)) map.removeLayer(lid);
      if (map.getSource(`src-${id}-deco`)) map.removeSource(`src-${id}-deco`);
      if (map.getSource(`src-${id}`)) map.removeSource(`src-${id}`);
      st.delete(id);
    }
  }
  const opts: BuildOpts = { slug: site.slug, mode3d: o.mode3d, site };
  // ajout / mise à jour, du bas vers le haut
  const ordered = [...site.layers].reverse();
  for (const layer of ordered) {
    const fc = data[layer.id];
    const rec = st.get(layer.id);
    const rasterKey = layer.kind === 'raster' ? JSON.stringify(layer.raster) : '';
    const styleKey = JSON.stringify([layer.style, layer.filter, layer.visible, layer.opacity, layer.geom, o.mode3d, rasterKey, layer.project, site.settings]);
    const srcId = `src-${layer.id}`;
    if (!map.getSource(srcId)) {
      map.addSource(srcId, sourceSpec(layer, site.slug, fc));
      if (layer.role === 'annotations') map.addSource(`${srcId}-deco`, { type: 'geojson', data: annotationDecorations(fc, site) });
    } else if (rec && rec.data !== fc && layer.kind === 'vector') {
      (map.getSource(srcId) as any).setData(fc || { type: 'FeatureCollection', features: [] });
      if (layer.role === 'annotations') (map.getSource(`${srcId}-deco`) as any)?.setData(annotationDecorations(fc, site));
    } else if (rec && layer.kind === 'raster' && rec.styleKey !== styleKey) {
      // changement de calage d'image ou d'URL : on recrée la source
      for (const lid of rec.specIds) if (map.getLayer(lid)) map.removeLayer(lid);
      map.removeSource(srcId);
      map.addSource(srcId, sourceSpec(layer, site.slug, fc));
      rec.specIds = [];
      rec.styleKey = '';
    }
    if (!rec || rec.styleKey !== styleKey || rec.specIds.some((id) => !map.getLayer(id))) {
      if (rec) for (const lid of rec.specIds) if (map.getLayer(lid)) map.removeLayer(lid);
      const specs = layerSpecs(layer, opts);
      for (const sp of specs) map.addLayer(sp, o.beforeId && map.getLayer(o.beforeId) ? o.beforeId : undefined);
      st.set(layer.id, { styleKey, data: fc, specIds: specs.map((x) => x.id) });
    } else {
      rec.data = fc;
    }
  }
  // ordre : on remonte chaque couche dans l'ordre bas → haut
  for (const layer of ordered) {
    const rec = st.get(layer.id);
    if (!rec) continue;
    for (const lid of rec.specIds) if (map.getLayer(lid)) map.moveLayer(lid, o.beforeId && map.getLayer(o.beforeId) ? o.beforeId : undefined);
  }
}

export function resetApplied(map: MlMap) {
  applied.delete(map);
}

export function interactiveLayerIds(map: MlMap, site: Site): string[] {
  const st = applied.get(map);
  if (!st) return [];
  const ids: string[] = [];
  for (const l of site.layers) {
    if (!l.visible || l.kind !== 'vector') continue;
    const rec = st.get(l.id);
    if (rec)
      ids.push(
        ...rec.specIds.filter(
          (x) => !x.includes('-deco') && !x.endsWith('-label') && !x.endsWith('-hatch') && !(x.endsWith('-fill') && l.style.fillOpacity < 0.05) && !(x.endsWith('-afill') && false),
        ),
      );
  }
  return ids;
}
