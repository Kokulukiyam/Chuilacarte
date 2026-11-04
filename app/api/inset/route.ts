import * as turf from '@turf/turf';
import { handle } from '@/lib/server/route';
import { geoBoundaries } from '@/lib/server/collect/admin';
import { countryIso3 } from '@/lib/server/collect/openbuildings';

export const runtime = 'nodejs';
const cache = new Map<string, any>();

/** Contours simplifiés du pays et de ses régions pour l'encart de situation. */
export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const lon = Number(u.searchParams.get('lon'));
  const lat = Number(u.searchParams.get('lat'));
  const iso = u.searchParams.get('iso') || (Number.isFinite(lon) && Number.isFinite(lat) ? await countryIso3(lon, lat) : 'SEN');
  if (cache.has(iso)) return Response.json(cache.get(iso));
  const simplify = (g: any) => {
    try {
      return turf.simplify(g, { tolerance: 0.004, highQuality: false });
    } catch {
      return g;
    }
  };
  const out: any = { iso };
  try {
    out.country = simplify(await geoBoundaries(iso, 'ADM0', true));
  } catch {
    /* hors ligne */
  }
  try {
    out.regions = simplify(await geoBoundaries(iso, 'ADM1', true));
  } catch {
    /* hors ligne */
  }
  if (out.country) cache.set(iso, out);
  return Response.json(out);
});
