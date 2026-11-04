import { handle } from '@/lib/server/route';
import { fetchWithTimeout, rateLimiter } from '@/lib/server/http';
import { HttpError } from '@/lib/server/storage';

export const runtime = 'nodejs';
const valhallaSlot = rateLimiter(1100);

const ORS_PROFILE: Record<string, string> = { walk: 'foot-walking', bike: 'cycling-regular', car: 'driving-car' };
const VALHALLA_COSTING: Record<string, string> = { walk: 'pedestrian', bike: 'bicycle', car: 'auto' };

/** Isochrones : OpenRouteService si une clé est fournie, sinon Valhalla (serveur public FOSSGIS). */
export const POST = handle(async (req: Request) => {
  const { lon, lat, mode = 'walk', minutes = [5, 10, 15] } = await req.json();
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new HttpError(400, 'Point manquant');
  if (!ORS_PROFILE[mode]) throw new HttpError(400, 'Mode inconnu');
  const mins: number[] = (Array.isArray(minutes) ? minutes : [minutes]).map(Number).filter((m) => m > 0 && m <= 60).slice(0, 5).sort((a, b) => a - b);
  if (!mins.length) throw new HttpError(400, 'Durées invalides (1 à 60 min)');
  const key = process.env.ORS_API_KEY;
  if (key) {
    const r = await fetchWithTimeout(`https://api.openrouteservice.org/v2/isochrones/${ORS_PROFILE[mode]}`, {
      method: 'POST',
      timeout: 30000,
      headers: { Authorization: key, 'content-type': 'application/json', accept: 'application/geo+json' },
      body: JSON.stringify({ locations: [[lon, lat]], range: mins.map((m) => m * 60), range_type: 'time' }),
    });
    if (!r.ok) throw new HttpError(502, `OpenRouteService : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return Response.json({
      provider: 'OpenRouteService',
      attribution: '© openrouteservice.org by HeiGIT | Données © les contributeurs d’OpenStreetMap',
      fc: { type: 'FeatureCollection', features: j.features.map((f: any) => ({ type: 'Feature', geometry: f.geometry, properties: { minutes: Math.round(f.properties.value / 60), mode } })) },
    });
  }
  const base = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de';
  await valhallaSlot();
  const q = { locations: [{ lat, lon }], costing: VALHALLA_COSTING[mode], contours: mins.map((m) => ({ time: m })), polygons: true, denoise: 0.5, generalize: 15 };
  let r: Response;
  try {
    r = await fetchWithTimeout(`${base}/isochrone?json=${encodeURIComponent(JSON.stringify(q))}`, { timeout: 30000 });
  } catch (e: any) {
    throw new HttpError(503, `Service d’isochrones indisponible (${e.message}). Renseignez ORS_API_KEY dans .env.local pour utiliser OpenRouteService.`);
  }
  if (!r.ok) throw new HttpError(502, `Valhalla : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return Response.json({
    provider: 'Valhalla (FOSSGIS)',
    attribution: 'Isochrones : Valhalla, serveur FOSSGIS e.V. — données © les contributeurs d’OpenStreetMap (ODbL)',
    fc: { type: 'FeatureCollection', features: (j.features || []).map((f: any) => ({ type: 'Feature', geometry: f.geometry, properties: { minutes: f.properties.contour, mode } })) },
  });
});
