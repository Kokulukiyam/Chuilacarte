// Écriture DXF ASCII (AC1009 / R12) : lisible par AutoCAD, QGIS, LibreCAD, ezdxf.
import type { Geometry, Position } from 'geojson';

export interface DxfEntity {
  layer: string;
  geometry: Geometry;
  /** couleur ACI (1-255) ; facultatif */
  color?: number;
  text?: string;
  textHeight?: number;
}

function safeLayer(n: string) {
  return (n || '0')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 31) || '0';
}

/** Couleur ACI la plus proche d'une couleur hexadécimale (palette de base). */
export function hexToAci(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 7;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const base: [number, number, number, number][] = [
    [1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255],
    [8, 128, 128, 128], [9, 192, 192, 192], [250, 51, 51, 51], [251, 80, 80, 80], [252, 105, 105, 105], [253, 130, 130, 130],
    [30, 255, 127, 0], [40, 255, 191, 0], [94, 0, 127, 0], [140, 0, 127, 255], [150, 0, 63, 255], [12, 189, 0, 0], [7, 255, 255, 255],
  ];
  let best = 7;
  let bd = Infinity;
  for (const [i, R, G, B] of base) {
    const d = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best === 7 ? 250 : best; // le blanc devient gris foncé (fond blanc d'AutoCAD papier)
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3);

export function writeDxf(entities: DxfEntity[], opts: { layerColors?: Record<string, number> } = {}): string {
  const out: string[] = [];
  const g = (code: number, v: string | number) => out.push(String(code), String(v));
  const layers = new Map<string, number>();
  for (const e of entities) {
    const l = safeLayer(e.layer);
    if (!layers.has(l)) layers.set(l, opts.layerColors?.[e.layer] ?? e.color ?? 7);
  }
  // étendue
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ext = (p: Position) => {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  };
  const visit = (geom: Geometry) => {
    if (geom.type === 'GeometryCollection') return geom.geometries.forEach(visit);
    const walk = (c: any) => (typeof c[0] === 'number' ? ext(c) : c.forEach(walk));
    walk((geom as any).coordinates);
  };
  entities.forEach((e) => e.geometry && visit(e.geometry));
  if (!Number.isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 1; }

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 6); // mètres
  g(9, '$EXTMIN'); g(10, f(x0)); g(20, f(y0)); g(30, '0.0');
  g(9, '$EXTMAX'); g(10, f(x1)); g(20, f(y1)); g(30, '0.0');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, '0.0');
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.size + 1);
  g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
  for (const [name, color] of layers) {
    if (name === '0') continue;
    g(0, 'LAYER'); g(2, name); g(70, 0); g(62, color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');

  const poly = (layer: string, pts: Position[], closed: boolean, color?: number) => {
    if (pts.length < 2) return;
    let p = pts;
    if (closed && p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
    g(0, 'POLYLINE'); g(8, layer); if (color) g(62, color); g(66, 1); g(10, '0.0'); g(20, '0.0'); g(30, '0.0'); g(70, closed ? 1 : 0);
    for (const v of p) { g(0, 'VERTEX'); g(8, layer); g(10, f(v[0])); g(20, f(v[1])); g(30, '0.0'); }
    g(0, 'SEQEND'); g(8, layer);
  };
  const emit = (e: DxfEntity, geom: Geometry) => {
    const layer = safeLayer(e.layer);
    switch (geom.type) {
      case 'Point':
        if (e.text) {
          g(0, 'TEXT'); g(8, layer); if (e.color) g(62, e.color); g(10, f(geom.coordinates[0])); g(20, f(geom.coordinates[1])); g(30, '0.0'); g(40, f(e.textHeight || 2)); g(1, e.text.replace(/\n/g, ' '));
        } else {
          g(0, 'POINT'); g(8, layer); if (e.color) g(62, e.color); g(10, f(geom.coordinates[0])); g(20, f(geom.coordinates[1])); g(30, '0.0');
        }
        break;
      case 'MultiPoint':
        geom.coordinates.forEach((c) => emit(e, { type: 'Point', coordinates: c }));
        break;
      case 'LineString':
        poly(layer, geom.coordinates, false, e.color);
        break;
      case 'MultiLineString':
        geom.coordinates.forEach((c) => poly(layer, c, false, e.color));
        break;
      case 'Polygon':
        geom.coordinates.forEach((r) => poly(layer, r, true, e.color));
        break;
      case 'MultiPolygon':
        geom.coordinates.forEach((p) => p.forEach((r) => poly(layer, r, true, e.color)));
        break;
      case 'GeometryCollection':
        geom.geometries.forEach((x) => emit(e, x));
        break;
    }
  };
  for (const e of entities) if (e.geometry) emit(e, e.geometry);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
