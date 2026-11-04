import { nanoid } from 'nanoid';
import type { Layout, LayoutElement, Site } from '../types';
import { siteBBox } from '../site';
import { FORMATS, fitScale } from './geo';

export function pageSize(format: string, orientation: 'portrait' | 'landscape', custom?: [number, number]): [number, number] {
  const [a, b] = format === 'custom' && custom ? custom : FORMATS[format] || FORMATS.A3;
  const short = Math.min(a, b);
  const long = Math.max(a, b);
  return orientation === 'landscape' ? [long, short] : [short, long];
}

const el = (type: LayoutElement['type'], x: number, y: number, w: number, h: number, props: Record<string, any> = {}): LayoutElement => ({ id: nanoid(6), type, x, y, w, h, props });

/** Disposition par défaut : planche avec colonne d'habillage à droite (paysage) ou bandeau en bas (portrait). */
export function defaultElements(site: Site, W: number, H: number, orientation: 'portrait' | 'landscape'): { elements: LayoutElement[]; mapFrame: Layout['mapFrame']; margins: number } {
  const sf = Math.sqrt((W * H) / (420 * 297));
  const m = Math.round(10 * Math.max(0.7, Math.min(2.2, sf)));
  const gap = Math.round(5 * Math.max(0.8, sf));
  const fs = (pt: number) => Math.round(pt * Math.max(0.85, Math.min(2.6, sf)) * 2) / 2;
  if (orientation === 'landscape') {
    const col = Math.round(Math.min(170, Math.max(62, W * 0.235)));
    const cx = W - m - col;
    const mapFrame = { x: m, y: m, w: W - 2 * m - col - gap, h: H - 2 * m };
    let y = m;
    const els: LayoutElement[] = [];
    const tH = fs(20) * 0.3528 * 2.6;
    els.push(el('title', cx, y, col, tH, { text: site.name, size: fs(20), weight: 'bold' }));
    y += tH;
    const sH = fs(11) * 0.3528 * 2.6;
    els.push(el('subtitle', cx, y, col, sH, { text: 'Plan de situation', size: fs(11), weight: 'regular', color: '#52525b' }));
    y += sH + gap;
    const nH = Math.round(16 * Math.max(0.8, sf));
    els.push(el('north', cx, y, nH * 0.7, nH, {}));
    els.push(el('scalebar', cx + nH * 0.8, y + nH * 0.2, col - nH * 0.8, nH * 0.8, { size: fs(7), segments: 4 }));
    y += nH + gap;
    const cartH = Math.round(H * 0.2);
    const insetH = Math.round(Math.min(col * 0.7, H * 0.2));
    const legendH = H - m - y - cartH - insetH - 2 * gap;
    els.push(el('legend', cx, y, col, legendH, { title: 'Légende', size: fs(7.5), columns: col > 110 ? 2 : 1 }));
    y += legendH + gap;
    els.push(el('inset', cx, y, col, insetH, { title: 'Situation' }));
    y += insetH + gap;
    els.push(el('cartouche', cx, y, col, H - m - y, { size: fs(6.5), auteur: '', projet: site.name }));
    return { elements: els, mapFrame, margins: m };
  }
  // portrait
  const tH = fs(20) * 0.3528 * 2.6;
  const els: LayoutElement[] = [];
  els.push(el('title', m, m, W * 0.6, tH, { text: site.name, size: fs(20), weight: 'bold' }));
  els.push(el('subtitle', m, m + tH, W * 0.6, fs(11) * 0.3528 * 2.6, { text: 'Plan de situation', size: fs(11), color: '#52525b' }));
  const top = m + tH + fs(11) * 0.3528 * 2.6 + gap;
  const band = Math.round(H * 0.24);
  const mapFrame = { x: m, y: top, w: W - 2 * m, h: H - top - m - band - gap };
  const by = H - m - band;
  const w1 = (W - 2 * m - 2 * gap) * 0.42;
  const w2 = (W - 2 * m - 2 * gap) * 0.24;
  const w3 = W - 2 * m - 2 * gap - w1 - w2;
  els.push(el('legend', m, by, w1, band, { title: 'Légende', size: fs(7.5), columns: 1 }));
  const nH = Math.round(14 * Math.max(0.8, sf));
  els.push(el('inset', m + w1 + gap, by, w2, band - nH - gap, { title: 'Situation' }));
  els.push(el('north', m + w1 + gap, H - m - nH, nH * 0.7, nH, {}));
  els.push(el('scalebar', m + w1 + gap + nH * 0.75, H - m - nH * 0.85, w2 - nH * 0.75, nH * 0.85, { size: fs(6.5), segments: 4 }));
  els.push(el('cartouche', m + w1 + w2 + 2 * gap, by, w3, band, { size: fs(6.5), projet: site.name }));
  els.push(el('north', W - m - nH * 0.7, m, nH * 0.7, nH, {}));
  els.splice(els.length - 1, 1); // une seule flèche du nord
  return { elements: els, mapFrame, margins: m };
}

export function newLayout(site: Site, opts: { format?: Layout['format']; orientation?: Layout['orientation']; scale?: number; name?: string } = {}): Layout {
  const format = opts.format || 'A3';
  const orientation = opts.orientation || 'landscape';
  const [W, H] = pageSize(format, orientation);
  const { elements, mapFrame, margins } = defaultElements(site, W, H, orientation);
  const l: Layout = {
    id: nanoid(8),
    name: opts.name || `Planche ${format}`,
    format,
    orientation,
    width: W,
    height: H,
    margins,
    scale: 1000,
    center: site.center,
    bearing: 0,
    basemap: 'papier-noms',
    font: 'Inter',
    elements,
    mapFrame,
  };
  l.scale = opts.scale || fitScale(l, siteBBox(site));
  const sub = l.elements.find((e) => e.type === 'subtitle');
  if (sub) sub.props.text = subtitleFor(l.scale);
  return l;
}

const AUTO_SUBTITLES = ['Plan masse', 'Plan de l’îlot et de ses abords', 'Plan de quartier', 'Plan de situation'];

/** Change l'échelle d'une mise en page (brouillon modifiable) ; le sous-titre suit s'il n'a pas été personnalisé. */
export function applyScale(l: Layout, scale: number) {
  l.scale = scale;
  for (const e of l.elements) if (e.type === 'subtitle' && AUTO_SUBTITLES.includes(e.props.text)) e.props.text = subtitleFor(scale);
}

export function subtitleFor(scale: number) {
  return scale <= 1000 ? 'Plan masse' : scale <= 2500 ? 'Plan de l’îlot et de ses abords' : scale <= 10000 ? 'Plan de quartier' : 'Plan de situation';
}

/** Réorganise une mise en page après changement de format / orientation, en gardant les textes et réglages. */
export function relayout(site: Site, l: Layout, format: Layout['format'], orientation: Layout['orientation'], custom?: [number, number]): Layout {
  const [W, H] = pageSize(format, orientation, custom);
  const { elements, mapFrame, margins } = defaultElements(site, W, H, orientation);
  // reporter les propriétés des éléments existants du même type
  for (const e of elements) {
    const old = l.elements.find((o) => o.type === e.type);
    if (old) e.props = { ...e.props, ...old.props, size: e.props.size };
  }
  for (const o of l.elements) if ((o.type === 'text' || o.type === 'logo') && !elements.some((e) => e.id === o.id)) elements.push({ ...o, x: Math.min(o.x, W - o.w), y: Math.min(o.y, H - o.h) });
  const name = /^Planche (A\d|\d+×\d+)( |$)/.test(l.name) ? l.name.replace(/^Planche (A\d|\d+×\d+)/, `Planche ${format === 'custom' ? `${W}×${H}` : format}`) : l.name;
  return { ...l, name, format, orientation, width: W, height: H, elements, mapFrame, margins, symbolScale: undefined };
}
