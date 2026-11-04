import { basemapById } from './basemaps';
import type { Layer, Site } from './types';

/** Liste dédoublonnée des attributions : fond de carte + couches visibles. */
export function attributionsFor(site: Pick<Site, 'basemap' | 'overlays'>, layers: Layer[], basemap?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/^(données|data|source)\s*:?\s*/i, '').replace(/[’']/g, "'").trim();
  const add = (s?: string) => {
    if (!s) return;
    for (const part of s.split(' | ')) {
      // découpe en fragments « © X » pour ne garder chaque mention qu'une fois
      const frags = part.split(/,\s*(?=©|données ©)/).map((x) => x.trim()).filter(Boolean);
      const kept = frags.filter((f) => !seen.has(norm(f)));
      kept.forEach((f) => seen.add(norm(f)));
      const p = kept.join(', ');
      if (p && !out.includes(p)) out.push(p);
    }
  };
  const bm = basemapById(basemap || site.basemap);
  add(bm.attribution);
  if (site.overlays?.hillshade || site.overlays?.contours) add(basemapById('relief').attribution);
  for (const l of layers) add(l.source.attribution);
  return out;
}
