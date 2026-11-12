// Rendu SVG d'une mise en page (unités : millimètres). Base commune de l'aperçu et des exports SVG / PDF / PNG.
import type { Feature, Geometry, Position } from 'geojson';
import type { FC, Layer, Layout, LayoutElement, Site } from '../types';
import { DASH, featureColor, featureWidth } from '../styles';
import { matchAll } from '../filters';
import { shapePath } from '../shapes';
import { fmtLength, metricLength } from '../proj';
import { attributionsFor } from '../attribution';
import { makeProjector, PX_MM } from './geo';
import { bboxClip, centroid, booleanPointInPolygon, pointOnFeature } from '@turf/turf';
import { buildLegend, type LegendGroup, type Swatch } from './legend';

export const PT = 0.3528; // mm par point typographique

export interface BasemapTile {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderCtx {
  layout: Layout;
  site: Site;
  data: Record<string, FC>;
  basemap?: BasemapTile[];
  /** étiquettes du fond (noms de rues…), posées au-dessus des couches du site */
  basemapLabels?: BasemapTile[];
  /** contour du pays et des régions pour l'encart de situation */
  inset?: { country?: FC; regions?: FC; neighbours?: FC; name?: string };
  /** attributions supplémentaires */
  extraAttributions?: string[];
  /** fond de carte effectivement utilisé (peut différer : fonds réservés à l'écran) */
  basemapUsed?: string;
  /** couleur de fond du cadre quand le fond de carte est uni */
  background?: string;
  /** aperçu interactif : poignées et identifiants */
  editor?: boolean;
  selectedElement?: string | null;
}

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

export const FONT_STACKS: Record<string, string> = {
  Inter: "Inter, 'Helvetica Neue', Arial, sans-serif",
  'IBM Plex Sans': "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
  Jost: "Jost, Futura, 'Century Gothic', sans-serif",
  'Source Serif 4': "'Source Serif 4', Georgia, 'Times New Roman', serif",
};

/** Texte avec halo : une copie détourée dessous, le texte plein dessus (compatible PDF, Illustrator, resvg). */
function haloText(attrs: string, content: string, halo: string | null, haloW: number) {
  const fill = `<text ${attrs}>${content}</text>`;
  if (!halo || halo === 'none' || haloW <= 0) return fill;
  const a = attrs.replace(/fill="[^"]*"/, `fill="${halo}"`);
  return `<text ${a} stroke="${halo}" stroke-width="${n2(haloW)}" stroke-linejoin="round">${content}</text>${fill}`;
}

function fontAttr(font: string) {
  return `font-family="${esc(FONT_STACKS[font] || FONT_STACKS.Inter)}"`;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
let measureFont = 'Inter';
export function setMeasureFont(f: string) {
  measureFont = f;
}

/** Largeur d'un texte (mm) : mesurée avec la vraie police dans le navigateur, estimée sinon. */
export function textWidth(s: string, sizeMm: number, bold = false) {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    measureCtx.font = `${bold ? 700 : 400} 100px ${FONT_STACKS[measureFont] || FONT_STACKS.Inter}`;
    return (measureCtx.measureText(s).width / 100) * sizeMm * 1.02;
  }
  let w = 0;
  for (const ch of s) w += /[il.,;:'|!]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.82 : /[A-Z0-9]/.test(ch) ? 0.64 : ch === ' ' ? 0.28 : 0.53;
  return w * sizeMm * (bold ? 1.06 : 1);
}

export function wrapText(s: string, sizeMm: number, maxW: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of String(s || '').split('\n')) {
    let line = '';
    for (const word of para.split(/[ \t]+/)) {
      const t = line ? `${line} ${word}` : word;
      if (textWidth(t, sizeMm, bold) > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

// ------------------------------------------------------------------ géométries
function pathOf(g: Geometry, P: (lon: number, lat: number) => [number, number]): string {
  const ring = (r: Position[], close: boolean) => {
    let d = '';
    let last = '';
    for (let i = 0; i < r.length; i++) {
      const [x, y] = P(r[i][0], r[i][1]);
      const s = `${n2(x)} ${n2(y)}`;
      if (s === last) continue;
      d += (d ? 'L' : 'M') + s;
      last = s;
    }
    return d + (close ? 'Z' : '');
  };
  switch (g.type) {
    case 'LineString':
      return ring(g.coordinates, false);
    case 'MultiLineString':
      return g.coordinates.map((r) => ring(r, false)).join('');
    case 'Polygon':
      return g.coordinates.map((r) => ring(r, true)).join('');
    case 'MultiPolygon':
      return g.coordinates.map((p) => p.map((r) => ring(r, true)).join('')).join('');
    default:
      return '';
  }
}

function geomBBox(g: Geometry): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const v = (c: any) => {
    if (typeof c[0] === 'number') {
      if (c[0] < x0) x0 = c[0];
      if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1];
      if (c[1] > y1) y1 = c[1];
    } else c.forEach(v);
  };
  if (g.type === 'GeometryCollection') g.geometries.forEach((x) => v((x as any).coordinates));
  else v((g as any).coordinates);
  return [x0, y0, x1, y1];
}

function inside(b: number[], v: number[]) {
  return !(b[2] < v[0] || b[0] > v[2] || b[3] < v[1] || b[1] > v[3]);
}

function dashAttr(dash: string, widthMm: number) {
  const d = DASH[dash as keyof typeof DASH];
  if (!d) return '';
  return ` stroke-dasharray="${d.map((x) => n2(x * Math.max(widthMm, 0.15))).join(' ')}"`;
}

function hatchDef(id: string, kind: string, color: string) {
  const s = 1.6; // espacement mm
  const sw = 0.18;
  const line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}"/>`;
  let body = '';
  let rot = 0;
  switch (kind) {
    case 'diag':
      body = line(0, 0, 0, s);
      rot = 45;
      break;
    case 'diag-rev':
      body = line(0, 0, 0, s);
      rot = -45;
      break;
    case 'cross':
      body = line(0, 0, 0, s) + line(0, 0, s, 0);
      rot = 45;
      break;
    case 'horiz':
      body = line(0, 0, s, 0);
      break;
    case 'vert':
      body = line(0, 0, 0, s);
      break;
    case 'dots':
      body = `<circle cx="${s / 2}" cy="${s / 2}" r="0.22" fill="${color}"/>`;
      break;
  }
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${s}" height="${s}"${rot ? ` patternTransform="rotate(${rot})"` : ''}>${body}</pattern>`;
}

function shapeSvg(shape: string, cx: number, cy: number, size: number, fill: string, stroke: string, sw: number, opacity = 1) {
  const sa = sw > 0 ? ` stroke="${stroke}" stroke-width="${n2(sw)}"` : '';
  const op = opacity < 1 ? ` fill-opacity="${n2(opacity)}"` : '';
  if (shape === 'circle' || !shapePath(shape)) return `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(size / 2)}" fill="${fill}"${op}${sa}/>`;
  const pts = shapePath(shape)!.map(([x, y]) => `${n2(cx + (x - 0.5) * size)},${n2(cy + (y - 0.5) * size)}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}"${op}${sa} stroke-linejoin="round"/>`;
}

interface LabelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ------------------------------------------------------------------ couches
let NAMES_DONE = new Map<string, [number, number][]>(); // noms déjà écrits (anti-doublons)
let FRAME = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }; // cadre de carte (mm) : les étiquettes qui en débordent sont omises
let PXM = PX_MM; // mm papier par pixel de style, multiplié par le facteur de symboles de la mise en page

function renderVectorLayer(l: Layer, fc: FC, P: (lon: number, lat: number) => [number, number], view: number[], defs: string[], labels: string[], placed: LabelBox[], site: Site, font: string): string {
  const s = l.style;
  const out: string[] = [];
  const op = l.opacity;
  let hatchId = '';
  if (s.hatch !== 'none' && l.geom !== 'line' && l.geom !== 'point') {
    hatchId = `h-${l.id}`;
    defs.push(hatchDef(hatchId, s.hatch, s.hatchColor));
  }
  const pointFeats: Feature[] = [];
  const pointPos = new Map<Feature, [number, number]>();
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (!matchAll(f.properties || {}, l.filter)) continue;
    if (!inside(geomBBox(g), view)) continue;
    const props = f.properties || {};
    if (g.type === 'Point' || g.type === 'MultiPoint') {
      pointFeats.push(f as Feature);
      continue;
    }
    const d = pathOf(g, P);
    if (!d) continue;
    if (/Polygon/.test(g.type)) {
      const fill = featureColor(s, props, 'fill');
      const sw = s.strokeWidth * PXM;
      out.push(
        `<path d="${d}" fill="${s.fillOpacity > 0 ? fill : 'none'}"${s.fillOpacity > 0 && s.fillOpacity * op < 1 ? ` fill-opacity="${n2(s.fillOpacity * op)}"` : ''} fill-rule="evenodd"${sw > 0 ? ` stroke="${s.stroke}" stroke-width="${n2(sw)}" stroke-linejoin="round"${s.strokeOpacity * op < 1 ? ` stroke-opacity="${n2(s.strokeOpacity * op)}"` : ''}${dashAttr(s.dash, sw)}` : ''}/>`,
      );
      if (hatchId) out.push(`<path d="${d}" fill="url(#${hatchId})" fill-rule="evenodd"${op < 1 ? ` opacity="${n2(op)}"` : ''}/>`);
    } else {
      const col = featureColor(s, props, 'stroke');
      const sw = featureWidth(s, props) * PXM;
      out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${n2(sw)}" stroke-linejoin="round" stroke-linecap="${s.dash === 'solid' ? 'round' : 'butt'}"${s.strokeOpacity * op < 1 ? ` stroke-opacity="${n2(s.strokeOpacity * op)}"` : ''}${dashAttr(s.dash, sw)}/>`);
    }
  }
  // points trop proches : écartés radialement juste assez pour ne plus se recouvrir (déplacement cartographique, ≤ 1 symbole)
  const drawn: [number, number][] = [];
  const minD = s.pointSize * PXM * 1.05;
  for (const f of pointFeats) {
    const g = f.geometry as any;
    const cs: Position[] = g.type === 'Point' ? [g.coordinates] : g.coordinates;
    for (const c of cs) {
      let [x, y] = P(c[0], c[1]);
      for (let k = 0; k < 3; k++) {
        const near = drawn.find(([u, v]) => Math.hypot(x - u, y - v) < minD);
        if (!near) break;
        const dx = x - near[0];
        const dy = y - near[1];
        const d = Math.hypot(dx, dy);
        const a = d > 1e-6 ? Math.atan2(dy, dx) : (drawn.length * 2.39996) % (2 * Math.PI);
        x = near[0] + Math.cos(a) * minD;
        y = near[1] + Math.sin(a) * minD;
      }
      drawn.push([x, y]);
      pointPos.set(f, [x, y]);
      const hr = s.pointSize * PXM * 0.5;
      placed.push({ x0: x - hr, y0: y - hr, x1: x + hr, y1: y + hr });
      out.push(shapeSvg(s.pointShape, x, y, s.pointSize * PXM, featureColor(s, f.properties || {}, 'fill'), s.stroke, s.strokeWidth * PXM, s.fillOpacity * op));
    }
  }
  // étiquettes, avec évitement simple des chevauchements
  if (s.label?.field) {
    const lab = s.label;
    const size = Math.max(lab.size * PXM, 5.5 * PT); // jamais sous 5,5 pt, quel que soit le format
    const bold = lab.weight === 'bold';
    for (const f of fc.features) {
      const g = f.geometry;
      const txt = f.properties?.[lab.field];
      if (!g || txt === undefined || txt === null || txt === '' || !matchAll(f.properties || {}, l.filter)) continue;
      if (!inside(geomBBox(g), view)) continue;
      let x: number, y: number, rot = 0;
      let cands: { x: number; y: number; anchor: 'middle' | 'start' | 'end' }[] | null = null;
      if (g.type === 'Point') {
        const [px, py] = pointPos.get(f as Feature) ?? P(g.coordinates[0], g.coordinates[1]);
        const r = s.pointSize * PXM * 0.6;
        // dessous, dessus, à droite, à gauche : la première place libre
        cands = [
          { x: px, y: py + r + size, anchor: 'middle' },
          { x: px, y: py - r - size * 0.3, anchor: 'middle' },
          { x: px + r + size * 0.3, y: py + size * 0.35, anchor: 'start' },
          { x: px - r - size * 0.3, y: py + size * 0.35, anchor: 'end' },
        ];
        x = px;
        y = py;
      } else if (/LineString/.test(g.type)) {
        const line: Position[] = g.type === "LineString" ? g.coordinates : (g as any).coordinates.reduce((a: Position[], b: Position[]) => (b.length > a.length ? b : a), [] as Position[]);
        if (line.length < 2) continue;
        const len = metricLength(site.utm, { type: 'LineString', coordinates: line });
        let acc = 0;
        let i = 0;
        for (; i < line.length - 1; i++) {
          const d = metricLength(site.utm, { type: 'LineString', coordinates: [line[i], line[i + 1]] });
          if (acc + d >= len / 2) break;
          acc += d;
        }
        const a = P(line[i][0], line[i][1]);
        const b = P(line[Math.min(i + 1, line.length - 1)][0], line[Math.min(i + 1, line.length - 1)][1]);
        x = (a[0] + b[0]) / 2;
        y = (a[1] + b[1]) / 2;
        rot = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        if (rot > 90) rot -= 180;
        if (rot < -90) rot += 180;
      } else {
        // au centre de la surface, ou en un point intérieur si la forme est concave (aéroport…)
        let c: number[];
        try {
          c = centroid(f as any).geometry.coordinates;
          if (!booleanPointInPolygon(c, f as any)) c = pointOnFeature(f as any).geometry.coordinates;
        } catch {
          const bb = geomBBox(g);
          c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
        }
        [x, y] = P(c[0], c[1]);
      }
      const t = String(txt);
      // un même nom déjà écrit à moins de 40 mm (point et emprise du même stade, doublons OSM) n'est pas répété
      const prev = NAMES_DONE.get(t);
      if (prev && prev.some(([u, v]) => Math.hypot(u - x, v - y) < 40)) continue;
      const w = textWidth(t, size, bold);
      const hits = (b: LabelBox) => b.x0 < FRAME.x + 0.5 || b.x1 > FRAME.x + FRAME.w - 0.5 || b.y0 < FRAME.y + 0.5 || b.y1 > FRAME.y + FRAME.h - 0.5 || placed.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
      let anchor: 'middle' | 'start' | 'end' = 'middle';
      let box: LabelBox | null = null;
      if (cands) {
        for (const c of cands) {
          const x0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w;
          const b = { x0, y0: c.y - size, x1: x0 + w, y1: c.y + size * 0.3 };
          if (!hits(b)) {
            box = b;
            x = c.x;
            y = c.y;
            anchor = c.anchor;
            break;
          }
        }
        if (!box) continue;
      } else {
        box = rot ? { x0: x - w / 2, y0: y - w / 2, x1: x + w / 2, y1: y + w / 2 } : { x0: x - w / 2, y0: y - size, x1: x + w / 2, y1: y + size * 0.3 };
        if (hits(box)) continue;
      }
      placed.push(box);
      NAMES_DONE.set(t, [...(NAMES_DONE.get(t) || []), [x, y]]);
      const yy = rot ? y + size * 0.35 : y;
      labels.push(
        haloText(`x="${n2(x)}" y="${n2(yy)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="${bold ? 700 : 400}" fill="${lab.color}" text-anchor="${anchor}"${rot ? ` transform="rotate(${n2(rot)} ${n2(x)} ${n2(y)})"` : ''}`, esc(t), lab.halo, size * 0.22),
      );
    }
  }
  return `<g id="couche-${esc(l.id)}" data-name="${esc(l.name)}">${out.join('')}</g>`;
}

function arrowHead(a: [number, number], b: [number, number], size: number, color: string) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const p1 = [b[0] - size * Math.cos(ang - 0.42), b[1] - size * Math.sin(ang - 0.42)];
  const p2 = [b[0] - size * Math.cos(ang + 0.42), b[1] - size * Math.sin(ang + 0.42)];
  const p3 = [b[0] - size * 0.7 * Math.cos(ang), b[1] - size * 0.7 * Math.sin(ang)];
  return `<polygon points="${n2(b[0])},${n2(b[1])} ${n2(p1[0])},${n2(p1[1])} ${n2(p3[0])},${n2(p3[1])} ${n2(p2[0])},${n2(p2[1])}" fill="${color}"/>`;
}

function renderAnnotations(l: Layer, fc: FC, P: (lon: number, lat: number) => [number, number], site: Site, font: string): string {
  const out: string[] = [];
  const op = l.opacity < 1 ? ` opacity="${n2(l.opacity)}"` : '';
  for (const f of fc.features) {
    const p = f.properties || {};
    const g = f.geometry;
    if (!g) continue;
    const color = p._color || '#dc2626';
    const w = (p._width ?? 2) * PXM;
    const kind = p._kind;
    if (/Polygon/.test(g.type)) {
      out.push(`<path d="${pathOf(g, P)}" fill="${p._fill || color}" fill-opacity="${n2(p._fillOpacity ?? 0.12)}" stroke="${color}" stroke-width="${n2(w)}" stroke-linejoin="round"/>`);
    } else if (g.type === 'LineString') {
      const pts = g.coordinates.map((c) => P(c[0], c[1]));
      out.push(`<path d="${pathOf(g, P)}" fill="none" stroke="${color}" stroke-width="${n2(w)}" stroke-linecap="${kind === 'dimension' ? 'butt' : 'round'}" stroke-linejoin="round"/>`);
      if (kind === 'arrow' && pts.length >= 2) {
        const hs = 2.2 + w * 2.2;
        out.push(arrowHead(pts[pts.length - 2], pts[pts.length - 1], hs, color));
        if (p._double) out.push(arrowHead(pts[1], pts[0], hs, color));
      }
      if (kind === 'dimension' && pts.length >= 2) {
        const a = pts[0];
        const b = pts[pts.length - 1];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const tl = 1.6;
        for (const q of [a, b]) {
          out.push(`<line x1="${n2(q[0] - tl * Math.sin(ang))}" y1="${n2(q[1] + tl * Math.cos(ang))}" x2="${n2(q[0] + tl * Math.sin(ang))}" y2="${n2(q[1] - tl * Math.cos(ang))}" stroke="${color}" stroke-width="${n2(w)}"/>`);
        }
        let deg = (ang * 180) / Math.PI;
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const size = (p._size || 12) * PXM;
        const txt = p._text || fmtLength(metricLength(site.utm, g));
        out.push(haloText(`x="${n2(mx)}" y="${n2(my - 0.8)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="700" fill="${color}" text-anchor="middle" transform="rotate(${n2(deg)} ${n2(mx)} ${n2(my)})"`, esc(txt), '#ffffff', size * 0.2));
      }
    } else if (g.type === 'Point') {
      const [x, y] = P(g.coordinates[0], g.coordinates[1]);
      const size = (p._size || 16) * PXM;
      if (kind === 'text') {
        const lines = String(p._text || '').split('\n');
        const rot = p._rotation ? ` transform="rotate(${n2(p._rotation)} ${n2(x)} ${n2(y)})"` : '';
        out.push(
          haloText(
            `${fontAttr(font)} font-size="${n2(size)}" font-weight="${p._weight === 'bold' ? 700 : 400}" fill="${color}" text-anchor="middle"${rot}`,
            lines.map((t, i) => `<tspan x="${n2(x)}" y="${n2(y + (i - (lines.length - 1) / 2) * size * 1.2 + size * 0.35)}">${esc(t)}</tspan>`).join(''),
            p._halo === 'none' ? null : p._halo || '#ffffff',
            size * 0.18,
          ),
        );
      } else if (kind === 'marker') {
        const r = size * 0.7;
        out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" fill="${color}" stroke="#ffffff" stroke-width="${n2(r * 0.15)}"/>`);
        out.push(`<text x="${n2(x)}" y="${n2(y + size * 0.36)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(p._num)}</text>`);
      } else {
        out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(size / 2.4)}" fill="${color}" stroke="#ffffff" stroke-width="0.3"/>`);
      }
    }
  }
  return `<g id="couche-${esc(l.id)}" data-name="${esc(l.name)}"${op}>${out.join('')}</g>`;
}

// ------------------------------------------------------------------ éléments
function swatchSvg(sw: Swatch, x: number, y: number, w: number, h: number, defs: string[], idp: string): string {
  switch (sw.kind) {
    case 'fill': {
      let hatch = '';
      if (sw.hatch !== 'none') {
        defs.push(hatchDef(`${idp}-h`, sw.hatch, sw.hatchColor));
        hatch = `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="url(#${idp}-h)"/>`;
      }
      const sww = Math.min(h * 0.22, Math.max(0.1, sw.strokeWidth * PXM));
      return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${sw.fillOpacity > 0 ? sw.fill : 'none'}" fill-opacity="${n2(Math.max(sw.fillOpacity, sw.fillOpacity > 0 ? 0.25 : 0))}"${sw.strokeWidth > 0 ? ` stroke="${sw.stroke}" stroke-width="${n2(sww)}"${dashAttr(sw.dash, sww)}` : ''}/>${hatch}`;
    }
    case 'line': {
      const sww = Math.min(h * 0.7, Math.max(0.15, sw.strokeWidth * PXM));
      return `<line x1="${n2(x)}" y1="${n2(y + h / 2)}" x2="${n2(x + w)}" y2="${n2(y + h / 2)}" stroke="${sw.stroke}" stroke-width="${n2(sww)}" stroke-linecap="butt"${dashAttr(sw.dash, sww)}/>`;
    }
    case 'point':
      return shapeSvg(sw.shape, x + w / 2, y + h / 2, Math.min(h, Math.max(1.6, sw.size * PXM)), sw.fill, sw.stroke, Math.min(h * 0.15, sw.strokeWidth * PXM));
    case 'raster':
      return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${sw.color}"/>`;
    case 'marker': {
      const r = h * 0.55;
      return `<circle cx="${n2(x + w / 2)}" cy="${n2(y + h / 2)}" r="${n2(r)}" fill="${sw.color}"/><text x="${n2(x + w / 2)}" y="${n2(y + h / 2 + r * 0.45)}" font-size="${n2(r * 1.3)}" font-weight="700" fill="#fff" text-anchor="middle" font-family="Inter, Arial, sans-serif">${sw.num}</text>`;
    }
  }
}

export interface LegendLayoutResult {
  svg: string;
  overflow: boolean;
}

function renderLegend(el: LayoutElement, groups: LegendGroup[], font: string, defs: string[], editor = false): LegendLayoutResult {
  // la légende se réduit un peu, passe sur plus de colonnes, puis se réduit encore, sans descendre sous 6 pt
  const base = el.props.size || 8;
  const minPt = Math.min(base, 6);
  const cols0 = Math.max(1, el.props.columns || 1);
  const maxCols = Math.max(cols0, Math.min(cols0 + 2, Math.floor(el.w / 32)));
  const tries: [number, number][] = [];
  for (const f of [1, 0.92]) for (let c = cols0; c <= maxCols; c++) tries.push([base * f, c]);
  for (const f of [0.85, 0.78, 0.7]) for (let c = cols0; c <= maxCols; c++) tries.push([Math.max(minPt, base * f), c]);
  // dernier recours : mieux vaut une légende complète un peu plus petite qu'une légende tronquée
  for (const pt of [5.5, 5, 4.5]) if (pt < minPt) for (let c = cols0; c <= maxCols; c++) tries.push([pt, c]);
  for (const [sz, c] of tries) {
    const d: string[] = [];
    const r = legendAt(el, groups, font, d, sz, c, editor);
    if (!r.overflow) {
      defs.push(...d);
      return r;
    }
  }
  const d: string[] = [];
  const r = legendAt(el, groups, font, d, Math.min(minPt, 4.5), maxCols, editor);
  defs.push(...d);
  return r;
}

function legendAt(el: LayoutElement, groups: LegendGroup[], font: string, defs: string[], sizePt: number, columns: number, editor: boolean): LegendLayoutResult {
  const p = el.props;
  const size = sizePt * PT;
  const lh = size * 1.55;
  const sw = size * 1.9;
  const swh = size * 1.05;
  const cols = Math.max(1, columns);
  const pad = 2;
  const colW = (el.w - pad * 2 - (cols - 1) * 3) / cols;
  const nb = (t: string) => String(t).replace(/(\d) (m²|m|km|ha|%|min|hab\.?|niv\.?)(?=$|[\s),;/])/g, '$1\u00a0$2').replace(/ \/ /g, '\u00a0/ ');
  type Line = { type: 'group' | 'item'; text: string; swatch?: Swatch; gi: number; ii: number; first?: boolean; title?: string };
  const lines: Line[] = [];
  groups.forEach((g, gi) => {
    if (g.title) lines.push({ type: 'group', text: nb(g.title), gi, ii: -1, first: true });
    g.items.forEach((it, ii) => lines.push({ type: 'item', text: nb(it.label), swatch: it.swatch, gi, ii, first: !g.title && ii === 0, title: g.title }));
  });
  const out: string[] = [];
  if (p.frame !== false) out.push(`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="#ffffff" fill-opacity="${p.opaque === false ? 0 : 0.92}" stroke="${p.frame === false ? 'none' : '#d4d4d8'}" stroke-width="0.2"/>`);
  let y = el.y + pad + size * 1.2;
  const title = p.title ?? 'Légende';
  if (title) {
    out.push(`<text x="${n2(el.x + pad)}" y="${n2(y)}" ${fontAttr(font)} font-size="${n2(size * 1.25)}" font-weight="700" fill="#18181b">${esc(title)}</text>`);
    y += lh * 1.2;
  }
  const top = y;
  const bottom = el.y + el.h - pad + 0.01;
  const indent = size * 0.9; // entrées d'un groupe titré en retrait : une couche simple qui suit n'en fait pas partie
  const groupGap = size * 0.6; // sépare visuellement les groupes (une couche simple ne semble pas rattachée au groupe précédent)
  const heightOf = (ln: Line) => {
    const wrapped = wrapText(ln.text, size, colW - (ln.type === 'item' ? sw + 2 + (ln.title ? indent : 0) : 0), ln.type === 'group');
    return { wrapped, need: wrapped.length * size * 1.25 + (lh - size * 1.25) };
  };
  let col = 0;
  let overflow = false;
  const nextCol = () => {
    if (col < cols - 1) {
      col++;
      y = top;
      return true;
    }
    overflow = true;
    return false;
  };
  for (let i = 0; i < lines.length && !overflow; i++) {
    const ln = lines[i];
    const { wrapped, need } = heightOf(ln);
    if (ln.first && y > top + 0.01) y += groupGap;
    // un titre de groupe n'est jamais laissé seul en bas de colonne : il part avec sa première entrée
    let needed = need;
    if (ln.type === 'group' && lines[i + 1]?.type === 'item') needed += heightOf(lines[i + 1]).need;
    // un groupe titré qui tient entier dans une colonne neuve n'est pas coupé : il y part en bloc
    if (ln.type === 'group' && y > top + 0.01 && col < cols - 1) {
      let whole = need;
      for (let j = i + 1; j < lines.length && lines[j].type === 'item' && lines[j].gi === ln.gi; j++) whole += heightOf(lines[j]).need;
      if (y + whole > bottom && top + whole <= bottom) needed = Infinity;
    }
    if (y + needed > bottom) {
      if (!nextCol()) break;
      // entrée d'un groupe titré qui passe en haut de colonne : rappeler le titre
      if (ln.type === 'item' && ln.title && !ln.first) {
        const t = heightOf({ ...ln, type: 'group', text: `${ln.title} (suite)` });
        t.wrapped.forEach((tx, k) => out.push(`<text x="${n2(el.x + pad + col * (colW + 3))}" y="${n2(y + k * size * 1.25)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="700" fill="#27272a">${esc(tx)}</text>`));
        y += t.need;
        if (y + need > bottom && !nextCol()) break;
      }
    }
    const x = el.x + pad + col * (colW + 3);
    if (ln.type === 'group') {
      wrapped.forEach((t, k) => out.push(`<text x="${n2(x)}" y="${n2(y + k * size * 1.25)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="700" fill="#27272a">${esc(t)}</text>`));
    } else {
      const xi = x + (ln.title ? indent : 0);
      out.push(swatchSvg(ln.swatch!, xi, y - swh * 0.85, sw, swh, defs, `lg-${el.id}-${ln.gi}-${ln.ii}`));
      wrapped.forEach((t, k) => out.push(`<text x="${n2(xi + sw + 2)}" y="${n2(y + k * size * 1.25)}" ${fontAttr(font)} font-size="${n2(size)}" fill="#27272a">${esc(t)}</text>`));
    }
    y += need;
  }
  // avertissement visible seulement dans l'éditeur, jamais imprimé
  if (overflow && editor) out.push(`<text x="${n2(el.x + el.w - pad)}" y="${n2(el.y + el.h - 1)}" font-size="${n2(size * 0.9)}" fill="#dc2626" text-anchor="end" ${fontAttr(font)}>… légende incomplète : agrandissez le cadre</text>`);
  return { svg: `<g id="legende">${out.join('')}</g>`, overflow };
}

/** Longueur « ronde » de barre d'échelle (m) qui tient dans maxMm. */
export function niceScaleLength(scale: number, maxMm: number) {
  const maxM = (maxMm * scale) / 1000;
  const p = 10 ** Math.floor(Math.log10(maxM));
  for (const m of [5, 2, 1]) if (m * p <= maxM) return m * p;
  return p / 2;
}

function renderScaleBar(el: LayoutElement, layout: Layout, font: string) {
  const p = el.props;
  const size = (p.size || 7) * PT;
  const segs = p.segments || 4;
  const L = niceScaleLength(layout.scale, el.w - 6);
  const totalMm = (L * 1000) / layout.scale;
  const segMm = totalMm / segs;
  const h = p.barHeight || Math.max(1.2, size * 0.6);
  const x0 = el.x + 2;
  const y0 = el.y + size * 1.6;
  const out: string[] = [];
  for (let i = 0; i < segs; i++) out.push(`<rect x="${n2(x0 + i * segMm)}" y="${n2(y0)}" width="${n2(segMm)}" height="${n2(h)}" fill="${i % 2 ? '#ffffff' : '#18181b'}" stroke="#18181b" stroke-width="0.2"/>`);
  const unit = L >= 1000 ? 'km' : 'm';
  const fmtv = (m: number) => (unit === 'km' ? (m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : Math.round(m).toLocaleString('fr-FR'));
  for (const i of [0, segs / 2, segs]) {
    if (!Number.isInteger(i)) continue;
    const x = x0 + i * segMm;
    out.push(`<text x="${n2(x)}" y="${n2(y0 - 0.8)}" ${fontAttr(font)} font-size="${n2(size)}" fill="#18181b" text-anchor="middle">${fmtv((L * i) / segs)}${i === segs ? ` ${unit}` : ''}</text>`);
  }
  if (p.showRatio !== false) out.push(`<text x="${n2(x0)}" y="${n2(y0 + h + size * 1.3)}" ${fontAttr(font)} font-size="${n2(size)}" fill="#3f3f46">Échelle 1/${layout.scale.toLocaleString('fr-FR')} (format ${layout.format === 'custom' ? `${layout.width}×${layout.height} mm` : layout.format})</text>`);
  return `<g id="barre-echelle" data-longueur-m="${L}" data-longueur-mm="${n2(totalMm)}">${out.join('')}</g>`;
}

function renderNorth(el: LayoutElement, layout: Layout, font: string) {
  const cx = el.x + el.w / 2;
  const s = Math.min(el.w, el.h * 0.8);
  const top = el.y + el.h * 0.22;
  const bottom = top + s * 0.75;
  const rot = -(layout.bearing || 0);
  const tri = `<polygon points="${n2(cx)},${n2(top)} ${n2(cx + s * 0.22)},${n2(bottom)} ${n2(cx)},${n2(bottom - s * 0.18)}" fill="#18181b"/><polygon points="${n2(cx)},${n2(top)} ${n2(cx - s * 0.22)},${n2(bottom)} ${n2(cx)},${n2(bottom - s * 0.18)}" fill="#ffffff" stroke="#18181b" stroke-width="0.25"/>`;
  const ny = el.y + el.h * 0.18;
  return `<g id="fleche-nord" transform="rotate(${n2(rot)} ${n2(cx)} ${n2((top + bottom) / 2)})">${tri}<text x="${n2(cx)}" y="${n2(ny)}" ${fontAttr(font)} font-size="${n2(Math.max(2.5, s * 0.26))}" font-weight="700" text-anchor="middle" fill="#18181b">N</text></g>`;
}

/** Numéro de planche par défaut : « 2 / 3 » d'après l'ordre des mises en page du site. */
function planchePos(ctx: RenderCtx) {
  const ls = ctx.site.layouts || [];
  const i = ls.findIndex((x) => x.id === ctx.layout.id);
  return i >= 0 ? `${i + 1} / ${ls.length}` : '';
}

function renderCartouche(el: LayoutElement, ctx: RenderCtx, attributions: string[], font: string) {
  const p = el.props;
  const l = ctx.layout;
  const size = (p.size || 7) * PT;
  const pad = 2;
  const out: string[] = [`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="#ffffff" stroke="#18181b" stroke-width="0.35"/>`];
  const rows: [string, string][] = [
    ['Projet', p.projet || ctx.site.name],
    ['Maître d’ouvrage', p.moa || ''],
    ['Auteur', p.auteur || ''],
    ['Phase', p.phase || ''],
    ['Planche', p.planche || planchePos(ctx)],
    ['Date', p.date || new Date().toLocaleDateString('fr-FR')],
    ['Échelle', `1/${l.scale.toLocaleString('fr-FR')} — ${l.format === 'custom' ? `${l.width} × ${l.height} mm` : `${l.format} ${l.orientation === 'landscape' ? 'paysage' : 'portrait'}`}`],
    ['Projection', `WGS 84 / Pseudo-Mercator — mesures en UTM ${ctx.site.utm.zone}${ctx.site.utm.south ? 'S' : 'N'}`],
  ];
  if (p.mention) rows.push(['Mention', p.mention]);
  let y = el.y + pad + size;
  const labSize = Math.max(size * 0.85, 5 * PT);
  const labW = Math.min(el.w * 0.42, Math.max(...rows.filter(([, v]) => v).map(([k]) => textWidth(k.toUpperCase(), labSize))) + size * 0.9);
  for (const [k, v] of rows) {
    if (!v) continue;
    const wr = wrapText(v, size, el.w - labW - pad * 2);
    out.push(`<text x="${n2(el.x + pad)}" y="${n2(y)}" ${fontAttr(font)} font-size="${n2(labSize)}" fill="#71717a">${esc(k.toUpperCase())}</text>`);
    wr.forEach((t, i) => out.push(`<text x="${n2(el.x + pad + labW)}" y="${n2(y + i * size * 1.25)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="${k === 'Projet' ? 700 : 400}" fill="#18181b">${esc(t)}</text>`));
    y += wr.length * size * 1.25 + size * 0.55;
    if (y > el.y + el.h - pad) break;
  }
  if (p.showSources !== false && attributions.length && y < el.y + el.h - pad - size) {
    out.push(`<line x1="${n2(el.x)}" y1="${n2(y - size * 0.5)}" x2="${n2(el.x + el.w)}" y2="${n2(y - size * 0.5)}" stroke="#d4d4d8" stroke-width="0.2"/>`);
    y += size * 0.5;
    // les sources (attributions de licence) doivent être complètes : la taille se réduit jusqu'à 4 pt pour tenir
    const text = `Sources\u00a0: ${attributions.join('\u00a0; ')}`;
    const room = el.y + el.h - pad - y + size * 0.78;
    let ss = Math.max(size * 0.78, 5.5 * PT);
    let wr = wrapText(text, ss, el.w - pad * 2);
    while (wr.length * ss * 1.25 > room && ss > 4 * PT) {
      ss = Math.max(4 * PT, ss * 0.92);
      wr = wrapText(text, ss, el.w - pad * 2);
    }
    for (const t of wr) {
      out.push(`<text x="${n2(el.x + pad)}" y="${n2(y)}" ${fontAttr(font)} font-size="${n2(ss)}" fill="#52525b">${esc(t)}</text>`);
      y += ss * 1.25;
    }
  }
  return `<g id="cartouche">${out.join('')}</g>`;
}

function renderInset(el: LayoutElement, ctx: RenderCtx, font: string) {
  const out: string[] = [`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="#ffffff" stroke="#a1a1aa" stroke-width="0.25"/>`];
  const country = ctx.inset?.country;
  if (!country?.features.length) {
    out.push(`<text x="${n2(el.x + el.w / 2)}" y="${n2(el.y + el.h / 2)}" font-size="2.5" text-anchor="middle" fill="#a1a1aa" ${fontAttr(font)}>Encart de situation</text>`);
    return `<g id="encart">${out.join('')}</g>`;
  }
  const bb0 = country.features.map((f) => geomBBox(f.geometry)).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const k = Math.max(1, Math.min(2.6, Math.min(el.w, el.h) / 45));
  const titleH = 2.2 * k + 1.4 * k;
  const nb = ctx.inset?.neighbours?.features || [];
  // étendue : le pays et une marge où se lisent voisins et océan
  const m = nb.length ? 0.12 : 0;
  const bb = [bb0[0] - (bb0[2] - bb0[0]) * m, bb0[1] - (bb0[3] - bb0[1]) * m, bb0[2] + (bb0[2] - bb0[0]) * m, bb0[3] + (bb0[3] - bb0[1]) * m];
  const pad = nb.length ? 0.6 : Math.max(3, Math.min(el.w, el.h) * 0.08);
  const lat0 = (bb[1] + bb[3]) / 2;
  const c = Math.cos((lat0 * Math.PI) / 180);
  const availH = el.h - pad * 2 - titleH;
  const s = Math.min((el.w - pad * 2) / ((bb[2] - bb[0]) * c), availH / (bb[3] - bb[1]));
  const ox = el.x + (el.w - (bb[2] - bb[0]) * c * s) / 2;
  const oy = el.y + pad + (availH - (bb[3] - bb[1]) * s) / 2;
  const P = (lon: number, lat: number): [number, number] => [ox + (lon - bb[0]) * c * s, oy + (bb[3] - lat) * s];
  const U = (x: number, y: number): [number, number] => [bb[0] + (x - ox) / (c * s), bb[3] - (y - oy) / s];
  const mapH = el.h - titleH;
  // vue de l'encart en degrés : les voisins sont découpés géométriquement (pas de clipPath : resvg plante
  // sur un groupe masqué hors de la bande rendue lors de l'export PNG par bandes)
  const view = [...U(el.x, el.y + mapH), ...U(el.x + el.w, el.y)];
  const vb = [view[0], view[1], view[2], view[3]];
  const clipped = nb
    .map((f) => {
      try {
        const c = bboxClip(f as any, vb as any);
        return (c.geometry as any).coordinates.length ? { ...f, geometry: c.geometry as Geometry } : null;
      } catch {
        return null;
      }
    })
    .filter((f): f is NonNullable<typeof f> => !!f);
  if (nb.length) out.push(`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(mapH)}" fill="#dce9f1"/>`);
  for (const f of ctx.inset?.regions?.features || []) out.push(`<path d="${pathOf(f.geometry, P)}" fill="#ffffff" stroke="#d4d4d8" stroke-width="0.12"/>`);
  for (const f of country.features) out.push(`<path d="${pathOf(f.geometry, P)}" fill="${ctx.inset?.regions ? 'none' : '#ffffff'}" stroke="none"/>`);
  // voisins par-dessus (la Gambie, enclavée, reste grise), puis le contour du pays
  for (const f of clipped) {
    const d = pathOf(f.geometry, P);
    if (d) out.push(`<path d="${d}" fill="#ecebe7" stroke="#b8b6b0" stroke-width="0.15"/>`);
  }
  for (const f of country.features) out.push(`<path d="${pathOf(f.geometry, P)}" fill="none" stroke="#52525b" stroke-width="0.3"/>`);
  const fsN = 1.8 * k;
  const used: LabelBox[] = [];
  const [sx0, sy0] = P(ctx.site.center[0], ctx.site.center[1]);
  used.push({ x0: sx0 - 2 * k, y0: sy0 - 2 * k, x1: sx0 + 2 * k, y1: sy0 + 2 * k });
  const name = (t: string, lon: number, lat: number, size: number, color: string, weight = 400, within?: any) => {
    const [x, y] = P(lon, lat);
    const w = textWidth(t, size, weight === 700) * 1.1;
    const b = { x0: x - w / 2, y0: y - size, x1: x + w / 2, y1: y + size * 0.3 };
    // le nom d'un pays doit tenir dans ce pays (sinon, comme pour la Gambie, il est omis)
    if (within && ![[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1], [b.x0 + w / 4, (b.y0 + b.y1) / 2], [b.x1 - w / 4, (b.y0 + b.y1) / 2]].every(([u, v]) => booleanPointInPolygon(U(u, v), within))) return;
    if (b.x0 < el.x + 0.5 || b.x1 > el.x + el.w - 0.5 || b.y0 < el.y + 0.5 || b.y1 > el.y + mapH - 0.5) return;
    if (used.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1))) return;
    used.push(b);
    out.push(`<text x="${n2(x)}" y="${n2(y)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="${weight}" letter-spacing="${n2(size * 0.08)}" text-anchor="middle" fill="${color}">${esc(t.toUpperCase())}</text>`);
  };
  const cb = bb0;
  name(ctx.inset?.name || '', (cb[0] + cb[2]) / 2 + (cb[2] - cb[0]) * 0.12, (cb[1] + cb[3]) / 2, fsN * 1.15, '#3f3f46', 700);
  for (const f of clipped) {
    try {
      // point à l'intérieur de la partie visible du pays (le nom ne chevauche pas la frontière)
      let c = centroid(f as any).geometry.coordinates;
      if (!booleanPointInPolygon(c, f as any)) c = pointOnFeature(f as any).geometry.coordinates;
      name(String(f.properties?.nom || ''), c[0], c[1], fsN, '#78716c', 400, f);
    } catch {
      /* géométrie dégénérée : pas de nom */
    }
  }
  out.push(`<circle cx="${n2(sx0)}" cy="${n2(sy0)}" r="${n2(1.1 * k)}" fill="#dc2626" stroke="#ffffff" stroke-width="${n2(0.3 * k)}"/>`);
  out.push(`<line x1="${n2(el.x)}" y1="${n2(el.y + mapH)}" x2="${n2(el.x + el.w)}" y2="${n2(el.y + mapH)}" stroke="#a1a1aa" stroke-width="0.2"/>`);
  out.push(`<text x="${n2(el.x + el.w / 2)}" y="${n2(el.y + el.h - 1.2 * k)}" ${fontAttr(font)} font-size="${n2(2.2 * k)}" text-anchor="middle" fill="#52525b">${esc(el.props.title || 'Situation')}</text>`);
  out.push(`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="none" stroke="#a1a1aa" stroke-width="0.25"/>`);
  return `<g id="encart">${out.join('')}</g>`;
}

function renderText(el: LayoutElement, font: string, kind: 'title' | 'subtitle' | 'text') {
  const p = el.props;
  const size = (p.size || (kind === 'title' ? 20 : kind === 'subtitle' ? 12 : 9)) * PT;
  const bold = (p.weight || (kind === 'title' ? 'bold' : 'regular')) === 'bold';
  const align = p.align || 'left';
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const x = align === 'center' ? el.x + el.w / 2 : align === 'right' ? el.x + el.w : el.x;
  const lines = wrapText(p.text || '', size, el.w, bold);
  const out: string[] = [];
  if (p.background) out.push(`<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="${p.background}"/>`);
  lines.forEach((t, i) =>
    out.push(`<text x="${n2(x)}" y="${n2(el.y + size * 0.95 + i * size * 1.22)}" ${fontAttr(font)} font-size="${n2(size)}" font-weight="${bold ? 700 : p.weight === 'light' ? 300 : 400}" fill="${p.color || '#18181b'}" text-anchor="${anchor}"${p.uppercase ? ' letter-spacing="0.4"' : ''}>${esc(p.uppercase ? t.toUpperCase() : t)}</text>`),
  );
  return `<g id="${kind}-${el.id}">${out.join('')}</g>`;
}

function renderLogo(el: LayoutElement) {
  if (!el.props.href) return `<rect x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" fill="none" stroke="#d4d4d8" stroke-dasharray="1 1" stroke-width="0.2"/>`;
  return `<image href="${esc(el.props.href)}" x="${n2(el.x)}" y="${n2(el.y)}" width="${n2(el.w)}" height="${n2(el.h)}" preserveAspectRatio="xMidYMid meet"/>`;
}

// ------------------------------------------------------------------ rendu complet
/** Facteur de symboles par défaut : les grands formats sont regardés de plus loin. */
export function defaultSymbolScale(l: Pick<Layout, 'width' | 'height'>) {
  const r = Math.sqrt((l.width * l.height) / (420 * 297));
  return Math.round(Math.max(0.8, Math.min(2.2, r)) * 20) / 20;
}

export function renderLayoutSvg(ctx: RenderCtx): { svg: string; attributions: string[]; legendOverflow: boolean } {
  const { layout, site, data } = ctx;
  const font = layout.font || 'Inter';
  setMeasureFont(font);
  PXM = PX_MM * (layout.symbolScale ?? defaultSymbolScale(layout));
  const pr = makeProjector(layout);
  const f = pr.frame;
  FRAME = f;
  NAMES_DONE = new Map();
  const defs: string[] = [];
  const view = pr.bounds(5);
  const visible = site.layers.filter((l) => l.visible);
  const attributions = [...attributionsFor(site, visible, ctx.basemapUsed || layout.basemap), ...(ctx.extraAttributions || [])].filter((a, i, arr) => a && arr.indexOf(a) === i);

  defs.push(`<clipPath id="cadre"><rect x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.w)}" height="${n2(f.h)}"/></clipPath>`);
  const map: string[] = [];
  map.push(`<rect x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.w)}" height="${n2(f.h)}" fill="${ctx.background || '#ffffff'}"/>`);
  for (const t of ctx.basemap || []) map.push(`<image href="${t.href}" x="${n2(t.x)}" y="${n2(t.y)}" width="${n2(t.w)}" height="${n2(t.h)}" preserveAspectRatio="none"/>`);
  const labels: string[] = [];
  const anns: string[] = [];
  const placed: LabelBox[] = [];
  for (const l of [...visible].reverse()) {
    if (l.kind !== 'vector' || l.style.mode === 'heatmap') continue; // la chaleur est rendue avec le fond (raster)
    const fc = data[l.id];
    if (!fc) continue;
    if (l.role === 'annotations') anns.push(renderAnnotations(l, fc, pr.project, site, font));
    else map.push(renderVectorLayer(l, fc, pr.project, view, defs, labels, placed, site, font));
  }
  for (const t of ctx.basemapLabels || []) map.push(`<image class="etiquettes-fond" href="${t.href}" x="${n2(t.x)}" y="${n2(t.y)}" width="${n2(t.w)}" height="${n2(t.h)}" preserveAspectRatio="none"/>`);
  map.push(`<g id="etiquettes">${labels.join('')}</g>`);
  // annotations au-dessus de tout (y compris les noms du fond)
  map.push(...anns);

  // attribution dans le cadre (toujours présente)
  const as = 1.9;
  const attrLines = wrapText(attributions.length ? `Sources : ${attributions.join(' ; ')}` : '', as, Math.min(f.w * 0.75, 240));
  // les sources figurent déjà dans le cartouche : pas de doublon sur la carte
  const inCartouche = layout.elements.some((e) => e.type === 'cartouche' && e.props.showSources !== false);
  if (attributions.length && !inCartouche) {
    const aw = Math.max(...attrLines.map((t) => textWidth(t, as))) + 2.4;
    const ah = attrLines.length * as * 1.25 + 1.4;
    map.push(`<g id="attribution"><rect x="${n2(f.x + f.w - aw)}" y="${n2(f.y + f.h - ah)}" width="${n2(aw)}" height="${n2(ah)}" fill="#ffffff" fill-opacity="0.82"/>`);
    attrLines.forEach((t, i) => map.push(`<text x="${n2(f.x + f.w - 1.2)}" y="${n2(f.y + f.h - ah + 1.0 + as + i * as * 1.25)}" ${fontAttr(font)} font-size="${as}" fill="#3f3f46" text-anchor="end">${esc(t)}</text>`));
    map.push('</g>');
  }

  const els: string[] = [];
  let legendOverflow = false;
  for (const el of layout.elements) {
    switch (el.type) {
      case 'title':
      case 'subtitle':
      case 'text':
        els.push(renderText(el, font, el.type));
        break;
      case 'legend': {
        const r = renderLegend(el, buildLegend(site, data, { hidden: el.props.hidden, labels: el.props.labels, bbox: view }), font, defs, !!ctx.editor);
        legendOverflow ||= r.overflow;
        els.push(r.svg);
        break;
      }
      case 'scalebar':
        els.push(renderScaleBar(el, layout, font));
        break;
      case 'north':
        els.push(renderNorth(el, layout, font));
        break;
      case 'cartouche':
        els.push(renderCartouche(el, ctx, attributions, font));
        break;
      case 'inset':
        els.push(renderInset(el, ctx, font));
        break;
      case 'logo':
        els.push(renderLogo(el));
        break;
    }
  }
  let handles = '';
  if (ctx.editor) {
    const hs = Math.max(2, layout.width / 150);
    const h = (id: string, x: number, y: number, w: number, hh: number, sel: boolean) =>
      `<rect data-el="${id}" class="lay-el" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(hh)}" fill="transparent" stroke="${sel ? '#2563eb' : 'transparent'}" stroke-width="${n2(hs / 6)}" stroke-dasharray="${n2(hs / 2)} ${n2(hs / 3)}" style="cursor:move"/>` +
      (sel ? `<rect data-el="${id}" data-handle="se" x="${n2(x + w - hs)}" y="${n2(y + hh - hs)}" width="${n2(hs)}" height="${n2(hs)}" fill="#2563eb" style="cursor:nwse-resize"/>` : '');
    handles += `<rect data-el="__map" class="lay-map" x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.w)}" height="${n2(f.h)}" fill="transparent" stroke="${ctx.selectedElement === '__map' ? '#2563eb' : 'transparent'}" stroke-width="${n2(hs / 6)}" style="cursor:grab"/>`;
    if (ctx.selectedElement === '__map') handles += `<rect data-el="__map" data-handle="se" x="${n2(f.x + f.w - hs)}" y="${n2(f.y + f.h - hs)}" width="${n2(hs)}" height="${n2(hs)}" fill="#2563eb" style="cursor:nwse-resize"/>`;
    for (const el of layout.elements) handles += h(el.id, el.x, el.y, el.w, el.h, ctx.selectedElement === el.id);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}">
<title>${esc(site.name)} — ${esc(layout.name)}</title>
<defs>${defs.join('')}</defs>
<rect id="page" x="0" y="0" width="${layout.width}" height="${layout.height}" fill="#ffffff"/>
<g id="carte" clip-path="url(#cadre)">${map.join('\n')}</g>
<rect id="cadre-carte" x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.w)}" height="${n2(f.h)}" fill="none" stroke="#18181b" stroke-width="0.35"/>
<g id="habillage">${els.join('\n')}</g>
${handles}
</svg>`;
  return { svg, attributions, legendOverflow };
}
