import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as turf from '@turf/turf';
import { fetchWithTimeout } from '../http';
import { CACHE_DIR, writeAtomic } from '../storage';
import { countryIso3 } from './openbuildings';
import { fc, src, type Collector } from './types';

const LEVELS: Record<string, string> = { ADM0: 'pays', ADM1: 'région', ADM2: 'département', ADM3: 'arrondissement' };

/** Télécharge (une fois) les limites geoBoundaries d'un pays et d'un niveau. */
export async function geoBoundaries(iso: string, level: string, simplified = false): Promise<any> {
  const file = path.join(CACHE_DIR, 'geoboundaries', `${iso}-${level}${simplified ? '-s' : ''}.geojson`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    /* pas en cache */
  }
  const meta = await fetchWithTimeout(`https://www.geoboundaries.org/api/current/gbOpen/${iso}/${level}/`, { timeout: 20000 });
  if (!meta.ok) throw new Error(`geoBoundaries ${iso}/${level} : HTTP ${meta.status}`);
  const m = await meta.json();
  let url: string = simplified ? m.simplifiedGeometryGeoJSON : m.gjDownloadURL;
  // les fichiers sont dans Git LFS : on vise directement media.githubusercontent.com
  const mm = url.match(/github\.com\/wmgeolab\/geoBoundaries\/raw\/([^/]+)\/(.*)$/);
  if (mm) url = `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/${mm[1]}/${mm[2]}`;
  const r = await fetchWithTimeout(url, { timeout: 60000, redirect: 'follow' });
  if (!r.ok) throw new Error(`geoBoundaries (fichier) : HTTP ${r.status}`);
  const txt = await r.text();
  if (!txt.trimStart().startsWith('{')) throw new Error('geoBoundaries : réponse inattendue (pointeur Git LFS ?)');
  await writeAtomic(file, txt);
  return JSON.parse(txt);
}

export const adminCollector: Collector = {
  id: 'admin',
  label: 'Limites administratives (geoBoundaries)',
  description: 'Régions, départements et arrondissements',
  defaultOn: true,
  async run(ctx) {
    const iso = await countryIso3(ctx.site.center[0], ctx.site.center[1]);
    const out: any[] = [];
    const bb = turf.bboxPolygon(ctx.bbox);
    for (const lvl of ['ADM1', 'ADM2', 'ADM3']) {
      ctx.log(`geoBoundaries : ${iso} ${lvl}`);
      let g: any;
      try {
        g = await geoBoundaries(iso, lvl);
      } catch (e: any) {
        if (lvl === 'ADM3') continue; // tous les pays n'ont pas ce niveau
        throw e;
      }
      for (const f of g.features) {
        try {
          if (!turf.booleanIntersects(f, bb) || !turf.booleanIntersects(f, ctx.area as any)) continue;
        } catch {
          continue;
        }
        out.push({ type: 'Feature', geometry: f.geometry, properties: { nom: f.properties.shapeName, niveau: LEVELS[lvl], code: f.properties.shapeISO || f.properties.shapeID } });
      }
    }
    return {
      layers: [
        {
          id: 'gb-admin',
          name: 'Limites administratives',
          role: 'admin',
          geom: 'polygon',
          fc: fc(out),
          source: src(
            'geoBoundaries (gbOpen)',
            'CC BY 3.0 IGO',
            'Limites administratives : geoBoundaries (Runfola et al. 2020), d’après Gouvernement du Sénégal / OCHA ROWCA — CC BY 3.0 IGO',
            'https://www.geoboundaries.org',
          ),
          stylePreset: 'limite',
          visible: false,
        },
      ],
      notes: [`${out.length} limites (${[...new Set(out.map((f) => f.properties.niveau))].join(', ')})`],
    };
  },
};
