import { basemapById } from './basemaps';
import type { Layer, Site } from './types';

/** Liste dédoublonnée des attributions : fond de carte + couches visibles. */
export function attributionsFor(site: Pick<Site, 'basemap' | 'overlays'>, layers: Layer[], basemap?: string): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    if (!s) return;
    for (const part of s.split(' | ')) {
      const p = part.trim();
      if (p && !out.includes(p)) out.push(p);
    }
  };
  const bm = basemapById(basemap || site.basemap);
  add(bm.attribution);
  if (site.overlays?.hillshade || site.overlays?.contours) add(basemapById('relief').attribution);
  for (const l of layers) add(l.source.attribution);
  return out;
}
