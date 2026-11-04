// Lecture DXF → GeoJSON en coordonnées du dessin (non géoréférencées).
import DxfParser from 'dxf-parser';
import type { Feature, Position } from 'geojson';
import type { FC } from './types';

type Mat = [number, number, number, number, number, number]; // a b c d e f : x' = a x + c y + e ; y' = b x + d y + f
const ID: Mat = [1, 0, 0, 1, 0, 0];

function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function ap(m: Mat, p: { x: number; y: number }): Position {
  return [m[0] * p.x + m[2] * p.y + m[4], m[1] * p.x + m[3] * p.y + m[5]];
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48): { x: number; y: number }[] {
  let end = a1;
  while (end <= a0) end += Math.PI * 2;
  const n = Math.max(6, Math.ceil(((end - a0) / (Math.PI * 2)) * steps));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((end - a0) * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Points d'une polyligne avec renflements (bulge) */
function polyVertices(vs: any[], closed: boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const v = vs[i];
    out.push({ x: v.x, y: v.y });
    const b = v.bulge;
    const next = i + 1 < n ? vs[i + 1] : closed ? vs[0] : null;
    if (b && next) {
      const theta = 4 * Math.atan(b);
      const dx = next.x - v.x;
      const dy = next.y - v.y;
      const chord = Math.hypot(dx, dy);
      if (chord > 0) {
        const r = chord / (2 * Math.sin(theta / 2));
        const mx = (v.x + next.x) / 2;
        const my = (v.y + next.y) / 2;
        const h = r * Math.cos(theta / 2);
        const cx = mx - (h * dy) / chord;
        const cy = my + (h * dx) / chord;
        const a0 = Math.atan2(v.y - cy, v.x - cx);
        const segs = Math.max(4, Math.ceil(Math.abs(theta) / (Math.PI / 16)));
        for (let k = 1; k < segs; k++) {
          const a = a0 + (theta * k) / segs;
          out.push({ x: cx + Math.abs(r) * Math.cos(a), y: cy + Math.abs(r) * Math.sin(a) });
        }
      }
    }
  }
  return out;
}

export interface DxfReadResult {
  fc: FC;
  units: 'm' | 'cm' | 'mm' | 'unknown';
  bbox: [number, number, number, number] | null;
  layers: string[];
}

const INSUNITS: Record<number, DxfReadResult['units']> = { 4: 'mm', 5: 'cm', 6: 'm' };

export function readDxf(text: string): DxfReadResult {
  const parser = new DxfParser();
  const dxf: any = parser.parseSync(text);
  if (!dxf) throw new Error('Fichier DXF illisible');
  const features: Feature[] = [];
  const blocks = dxf.blocks || {};
  const layerSet = new Set<string>();

  const emit = (geometry: any, ent: any, extra: Record<string, any> = {}) => {
    const layer = ent.layer || '0';
    layerSet.add(layer);
    features.push({ type: 'Feature', geometry, properties: { calque: layer, type_dxf: ent.type, ...extra } });
  };

  const walk = (ents: any[], m: Mat, depth: number) => {
    for (const e of ents || []) {
      try {
        switch (e.type) {
          case 'LINE':
            emit({ type: 'LineString', coordinates: e.vertices.map((v: any) => ap(m, v)) }, e);
            break;
          case 'LWPOLYLINE':
          case 'POLYLINE': {
            const closed = !!e.shape || !!e.closed;
            const vs = polyVertices(e.vertices || [], closed).map((v) => ap(m, v));
            if (vs.length < 2) break;
            if (closed && vs.length >= 3) emit({ type: 'Polygon', coordinates: [[...vs, vs[0]]] }, e);
            else emit({ type: 'LineString', coordinates: vs }, e);
            break;
          }
          case 'CIRCLE': {
            const pts = arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2, 64).map((p) => ap(m, p));
            emit({ type: 'Polygon', coordinates: [pts] }, e, { rayon: e.radius });
            break;
          }
          case 'ARC': {
            const pts = arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle).map((p) => ap(m, p));
            emit({ type: 'LineString', coordinates: pts }, e);
            break;
          }
          case 'ELLIPSE': {
            const mx = e.majorAxisEndPoint.x;
            const my = e.majorAxisEndPoint.y;
            const a = Math.hypot(mx, my);
            const b = a * e.axisRatio;
            const rot = Math.atan2(my, mx);
            const s0 = e.startAngle ?? 0;
            let s1 = e.endAngle ?? Math.PI * 2;
            if (s1 <= s0) s1 += Math.PI * 2;
            const pts = [];
            for (let i = 0; i <= 64; i++) {
              const t = s0 + ((s1 - s0) * i) / 64;
              const x = a * Math.cos(t);
              const y = b * Math.sin(t);
              pts.push(ap(m, { x: e.center.x + x * Math.cos(rot) - y * Math.sin(rot), y: e.center.y + x * Math.sin(rot) + y * Math.cos(rot) }));
            }
            const full = Math.abs(s1 - s0 - Math.PI * 2) < 1e-6;
            emit(full ? { type: 'Polygon', coordinates: [pts] } : { type: 'LineString', coordinates: pts }, e);
            break;
          }
          case 'SPLINE': {
            const pts = (e.fitPoints?.length ? e.fitPoints : e.controlPoints || []).map((p: any) => ap(m, p));
            if (pts.length >= 2) emit({ type: 'LineString', coordinates: pts }, e);
            break;
          }
          case 'POINT':
            emit({ type: 'Point', coordinates: ap(m, e.position) }, e);
            break;
          case 'TEXT':
          case 'MTEXT': {
            const p = e.startPoint || e.position;
            if (p) emit({ type: 'Point', coordinates: ap(m, p) }, e, { texte: String(e.text || '').replace(/\\P/g, ' ').replace(/\{|\}|\\[A-Za-z][^;]*;/g, '') });
            break;
          }
          case 'SOLID':
          case '3DFACE': {
            const pts = (e.points || e.vertices || []).map((p: any) => ap(m, p));
            if (pts.length >= 3) emit({ type: 'Polygon', coordinates: [[...pts, pts[0]]] }, e);
            break;
          }
          case 'INSERT': {
            if (depth > 8) break;
            const blk = blocks[e.name];
            if (!blk) break;
            const sx = e.xScale ?? 1;
            const sy = e.yScale ?? 1;
            const r = ((e.rotation || 0) * Math.PI) / 180;
            const bp = blk.position || { x: 0, y: 0 };
            const t: Mat = [Math.cos(r) * sx, Math.sin(r) * sx, -Math.sin(r) * sy, Math.cos(r) * sy, e.position.x, e.position.y];
            const base: Mat = [1, 0, 0, 1, -bp.x, -bp.y];
            walk(blk.entities, mul(m, mul(t, base)), depth + 1);
            break;
          }
          default:
            break;
        }
      } catch {
        /* entité ignorée */
      }
    }
  };
  walk(dxf.entities, ID, 0);

  let bbox: DxfReadResult['bbox'] = null;
  for (const f of features) {
    const visit = (c: any) => {
      if (typeof c[0] === 'number') {
        if (!bbox) bbox = [c[0], c[1], c[0], c[1]];
        else {
          bbox[0] = Math.min(bbox[0], c[0]);
          bbox[1] = Math.min(bbox[1], c[1]);
          bbox[2] = Math.max(bbox[2], c[0]);
          bbox[3] = Math.max(bbox[3], c[1]);
        }
      } else c.forEach(visit);
    };
    visit((f.geometry as any).coordinates);
  }
  const units = INSUNITS[dxf.header?.$INSUNITS] || 'unknown';
  return { fc: { type: 'FeatureCollection', features: features as any }, units, bbox, layers: [...layerSet] };
}

/** Devine le système de coordonnées d'un DXF à partir de l'étendue. */
export function guessDxfCrs(bbox: [number, number, number, number] | null): 'wgs84' | 'utm' | 'local' {
  if (!bbox) return 'local';
  const [x0, y0, x1, y1] = bbox;
  if (x0 >= -180 && x1 <= 180 && y0 >= -90 && y1 <= 90 && x1 - x0 < 5 && y1 - y0 < 5 && (Math.abs(x0) > 1 || Math.abs(y0) > 1)) return 'wgs84';
  if (x0 > 100000 && x1 < 900000 && y0 > 0 && y1 < 10000000 && x1 - x0 < 200000) return 'utm';
  return 'local';
}
