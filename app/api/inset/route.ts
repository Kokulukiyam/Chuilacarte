import * as turf from '@turf/turf';
import { handle } from '@/lib/server/route';
import { geoBoundaries } from '@/lib/server/collect/admin';
import { countryIso3 } from '@/lib/server/collect/openbuildings';

export const runtime = 'nodejs';
const cache = new Map<string, any>();

/** Noms français et voisins terrestres des pays d'Afrique de l'Ouest (encart de situation). */
const NAMES: Record<string, string> = {
  SEN: 'Sénégal', GMB: 'Gambie', MRT: 'Mauritanie', MLI: 'Mali', GIN: 'Guinée', GNB: 'Guinée-Bissau', SLE: 'Sierra Leone', LBR: 'Liberia',
  CIV: 'Côte d’Ivoire', BFA: 'Burkina Faso', NER: 'Niger', GHA: 'Ghana', TGO: 'Togo', BEN: 'Bénin', NGA: 'Nigeria', DZA: 'Algérie', ESH: 'Sahara occidental',
};
const NEIGHBOURS: Record<string, string[]> = {
  SEN: ['GMB', 'MRT', 'MLI', 'GIN', 'GNB'],
  GMB: ['SEN'],
  MRT: ['SEN', 'MLI', 'DZA', 'ESH'],
  MLI: ['SEN', 'MRT', 'DZA', 'NER', 'BFA', 'CIV', 'GIN'],
  GIN: ['GNB', 'SEN', 'MLI', 'CIV', 'LBR', 'SLE'],
  GNB: ['SEN', 'GIN'],
  CIV: ['LBR', 'GIN', 'MLI', 'BFA', 'GHA'],
  BFA: ['MLI', 'NER', 'BEN', 'TGO', 'GHA', 'CIV'],
};

/** Contours simplifiés du pays et de ses régions pour l'encart de situation. */
export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const lon = Number(u.searchParams.get('lon'));
  const lat = Number(u.searchParams.get('lat'));
  const iso = u.searchParams.get('iso') || (Number.isFinite(lon) && Number.isFinite(lat) ? await countryIso3(lon, lat) : 'SEN');
  if (cache.has(iso)) return Response.json(cache.get(iso));
  const simplify = (g: any, tolerance = 0.004) => {
    try {
      return turf.simplify(g, { tolerance, highQuality: false });
    } catch {
      return g;
    }
  };
  const out: any = { iso, name: NAMES[iso] || iso };
  try {
    // contour du pays depuis la géométrie complète (la version « simplifiée » de geoBoundaries perd la presqu'île du Cap-Vert)
    out.country = simplify(await geoBoundaries(iso, 'ADM0', false), 0.002);
  } catch {
    /* hors ligne */
  }
  // pays voisins (gris) : l'océan se lit par différence
  const nb = await Promise.all(
    (NEIGHBOURS[iso] || []).map(async (n) => {
      try {
        const fc = simplify(await geoBoundaries(n, 'ADM0', true), 0.01);
        return (fc.features || []).map((f: any) => ({ ...f, properties: { iso: n, nom: NAMES[n] || n } }));
      } catch {
        return [];
      }
    }),
  );
  if (nb.flat().length) out.neighbours = { type: 'FeatureCollection', features: nb.flat() };
  try {
    out.regions = simplify(await geoBoundaries(iso, 'ADM1', true));
  } catch {
    /* hors ligne */
  }
  if (out.country) cache.set(iso, out);
  return Response.json(out);
});
