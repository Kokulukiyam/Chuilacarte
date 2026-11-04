'use client';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { FC, Layout, Site } from '../types';
import { renderBasemap } from './basemap';
import { renderLayoutSvg } from './svg';

let insetCache: { key: string; data: any } | null = null;

export async function fetchInset(site: Site) {
  const key = `${site.center[0].toFixed(1)},${site.center[1].toFixed(1)}`;
  if (insetCache?.key === key) return insetCache.data;
  try {
    const r = await fetch(`/api/inset?lon=${site.center[0]}&lat=${site.center[1]}`);
    const j = await r.json();
    insetCache = { key, data: j };
    return j;
  } catch {
    return {};
  }
}

export interface BuiltSvg {
  svg: string;
  attributions: string[];
  note?: string;
  legendOverflow: boolean;
  basemapDpi: number;
}

export async function buildLayoutSvg(layout: Layout, site: Site, data: Record<string, FC>, o: { dpi: number; onProgress?: (msg: string) => void }): Promise<BuiltSvg> {
  o.onProgress?.('Rendu du fond de carte…');
  const bm = await renderBasemap(layout, site, { dpi: o.dpi, onProgress: (d, t) => o.onProgress?.(`Rendu du fond de carte… ${d}/${t}`) });
  const inset = layout.elements.some((e) => e.type === 'inset') ? await fetchInset(site) : undefined;
  const r = renderLayoutSvg({ layout, site, data, basemap: bm.tiles, background: bm.background, inset, basemapUsed: bm.used });
  return { svg: r.svg, attributions: r.attributions, note: bm.note, legendOverflow: r.legendOverflow, basemapDpi: Math.round(bm.dpi) };
}

export function fileBase(site: Site, layout: Layout) {
  const s = (x: string) =>
    x
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  return `${s(site.name)}-${s(layout.name)}-${layout.format === 'custom' ? `${layout.width}x${layout.height}` : layout.format}-1-${layout.scale}`;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
}

export async function keepCopy(site: Site, name: string, blob: Blob) {
  try {
    await fetch(`/api/sites/${site.slug}/exports/${encodeURIComponent(name)}`, { method: 'PUT', body: blob });
  } catch {
    /* la copie est facultative */
  }
}

const FONT_FILES: Record<string, Record<string, string>> = {
  Inter: { normal: 'Inter_400Regular', bold: 'Inter_700Bold', italic: 'Inter_400Regular_Italic' },
  'IBM Plex Sans': { normal: 'IBMPlexSans_400Regular', bold: 'IBMPlexSans_700Bold', italic: 'IBMPlexSans_400Regular_Italic' },
  Jost: { normal: 'Jost_400Regular', bold: 'Jost_700Bold', italic: 'Jost_400Regular_Italic' },
  'Source Serif 4': { normal: 'SourceSerif4_400Regular', bold: 'SourceSerif4_700Bold', italic: 'SourceSerif4_400Regular_Italic' },
};

const fontB64 = new Map<string, Promise<string>>();
function loadFont(file: string) {
  let p = fontB64.get(file);
  if (!p) {
    p = fetch(`/fonts/${file}.ttf`)
      .then((r) => r.arrayBuffer())
      .then((b) => {
        const bytes = new Uint8Array(b);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      });
    fontB64.set(file, p);
  }
  return p;
}

export async function svgToPdf(svg: string, layout: Layout): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [layout.width, layout.height], orientation: layout.width > layout.height ? 'landscape' : 'portrait', compress: true });
  for (const fam of new Set([layout.font || 'Inter', 'Inter'])) {
    const files = FONT_FILES[fam] || FONT_FILES.Inter;
    for (const [style, file] of Object.entries(files)) {
      const b64 = await loadFont(file);
      doc.addFileToVFS(`${file}.ttf`, b64);
      doc.addFont(`${file}.ttf`, fam, style);
    }
  }
  doc.setFont(layout.font || 'Inter', 'normal');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-100000px;top:0';
  holder.innerHTML = svg;
  document.body.appendChild(holder);
  try {
    const el = holder.querySelector('svg')!;
    await svg2pdf(el, doc, { x: 0, y: 0, width: layout.width, height: layout.height });
  } finally {
    holder.remove();
  }
  doc.setProperties({ title: layout.name, creator: 'Chuilacarte' });
  return doc.output('blob');
}

export async function svgToPng(svg: string, layout: Layout, dpi: number): Promise<Blob> {
  const r = await fetch(`/api/export/png?dpi=${dpi}&widthMm=${layout.width}`, { method: 'POST', body: svg, headers: { 'content-type': 'image/svg+xml' } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `PNG : HTTP ${r.status}`);
  return r.blob();
}

export async function exportLayout(kind: 'png' | 'pdf' | 'svg', layout: Layout, site: Site, data: Record<string, FC>, o: { dpi?: number; onProgress?: (m: string) => void; keep?: boolean } = {}) {
  const dpi = o.dpi || (kind === 'png' ? 300 : 200);
  const built = await buildLayoutSvg(layout, site, data, { dpi, onProgress: o.onProgress });
  const base = fileBase(site, layout);
  let blob: Blob;
  let name: string;
  if (kind === 'svg') {
    blob = new Blob([built.svg], { type: 'image/svg+xml' });
    name = `${base}.svg`;
  } else if (kind === 'pdf') {
    o.onProgress?.('Assemblage du PDF vectoriel…');
    blob = await svgToPdf(built.svg, layout);
    name = `${base}.pdf`;
  } else {
    o.onProgress?.(`Rastérisation à ${dpi} dpi…`);
    blob = await svgToPng(built.svg, layout, dpi);
    name = `${base}-${dpi}dpi.png`;
  }
  download(blob, name);
  if (o.keep !== false) await keepCopy(site, name, blob);
  return { name, size: blob.size, note: built.note, legendOverflow: built.legendOverflow, basemapDpi: built.basemapDpi };
}
