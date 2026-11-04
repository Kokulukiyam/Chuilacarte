'use client';
import type { Map as MlMap } from 'maplibre-gl';

import { shapePath } from './shapes';
export { shapePath };

/** Champ de distance signé (SDF) calculé par force brute — petit (48 px), donc rapide. */
function sdfImage(shape: string, size = 48) {
  const pad = 6;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  const inner = size - pad * 2;
  if (shape === 'circle') {
    g.beginPath();
    g.arc(size / 2, size / 2, inner / 2, 0, Math.PI * 2);
    g.fill();
  } else {
    const p = shapePath(shape)!;
    g.beginPath();
    p.forEach(([x, y], i) => (i ? g.lineTo(pad + x * inner, pad + y * inner) : g.moveTo(pad + x * inner, pad + y * inner)));
    g.closePath();
    g.fill();
  }
  const src = g.getImageData(0, 0, size, size).data;
  const inside = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) inside[i] = src[i * 4 + 3] > 127 ? 1 : 0;
  const edges: number[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = inside[i];
      if ((x > 0 && inside[i - 1] !== v) || (y > 0 && inside[i - size] !== v)) edges.push(x, y);
    }
  const out = new Uint8ClampedArray(size * size * 4);
  const radius = 6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let d = Infinity;
      for (let k = 0; k < edges.length; k += 2) {
        const dx = edges[k] - x;
        const dy = edges[k + 1] - y;
        const dd = dx * dx + dy * dy;
        if (dd < d) d = dd;
      }
      d = Math.sqrt(d);
      const i = y * size + x;
      const sd = inside[i] ? d : -d;
      // MapLibre : 0,75 (192) = contour
      const a = Math.max(0, Math.min(255, 192 + (sd / radius) * 63));
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
      out[i * 4 + 3] = a;
    }
  return { width: size, height: size, data: out };
}

export function hatchCanvas(kind: string, color: string, size = 16, lw = 1.2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = lw;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  switch (kind) {
    case 'diag':
      line(-2, size + 2, size + 2, -2);
      line(-2, 2, 2, -2);
      line(size - 2, size + 2, size + 2, size - 2);
      break;
    case 'diag-rev':
      line(-2, -2, size + 2, size + 2);
      line(size - 2, -2, size + 2, 2);
      line(-2, size - 2, 2, size + 2);
      break;
    case 'cross':
      line(-2, size + 2, size + 2, -2);
      line(-2, -2, size + 2, size + 2);
      break;
    case 'horiz':
      line(0, size / 2, size, size / 2);
      break;
    case 'vert':
      line(size / 2, 0, size / 2, size);
      break;
    case 'dots':
      g.beginPath();
      g.arc(size / 2, size / 2, 1.6, 0, Math.PI * 2);
      g.fill();
      break;
  }
  return c;
}

const sdfCache = new Map<string, ReturnType<typeof sdfImage>>();

export function installImageHandler(map: MlMap) {
  map.on('styleimagemissing', (e: any) => {
    const id: string = e.id;
    if (map.hasImage(id)) return;
    if (id.startsWith('shape-') || id === 'arrowhead' || id === 'tick') {
      const shape = id.startsWith('shape-') ? id.slice(6) : id;
      let img = sdfCache.get(shape);
      if (!img) {
        img = sdfImage(shape);
        sdfCache.set(shape, img);
      }
      map.addImage(id, img, { sdf: true, pixelRatio: 2 });
    } else if (id.startsWith('hatch-')) {
      const [, kind, hex] = id.match(/^hatch-([a-z-]+?)-([0-9a-fA-F]{3,8})$/) || [];
      if (!kind) return;
      const c = hatchCanvas(kind, `#${hex}`, 24, 1.6);
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      map.addImage(id, { width: c.width, height: c.height, data: new Uint8Array(d.data.buffer) }, { pixelRatio: 2 });
    }
  });
}
