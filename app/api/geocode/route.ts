import { handle } from '@/lib/server/route';
import { fetchWithTimeout, nominatimSlot } from '@/lib/server/http';
import { HttpError } from '@/lib/server/storage';

export const runtime = 'nodejs';
const cache = new Map<string, any>();

export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) throw new HttpError(400, 'Requête trop courte');
  const key = q.toLowerCase();
  if (cache.has(key)) return Response.json(cache.get(key));
  await nominatimSlot();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&polygon_threshold=0.00005&limit=8&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetchWithTimeout(url, { timeout: 15000 });
  if (!r.ok) throw new HttpError(502, `Nominatim a répondu ${r.status}`);
  const arr = (await r.json()) as any[];
  const out = arr.map((x) => ({
    name: x.display_name as string,
    type: `${x.category || x.class}/${x.type}`,
    center: [Number(x.lon), Number(x.lat)],
    bbox: [Number(x.boundingbox[2]), Number(x.boundingbox[0]), Number(x.boundingbox[3]), Number(x.boundingbox[1])],
    geojson: x.geojson,
  }));
  cache.set(key, out);
  return Response.json(out);
});
