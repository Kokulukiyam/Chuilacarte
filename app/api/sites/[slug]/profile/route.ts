import * as turf from '@turf/turf';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite } from '@/lib/server/storage';
import { readDem, COP_ATTR } from '@/lib/server/collect/relief';
import { sample } from '@/lib/server/raster';
import { sampleLine } from '@/lib/analysis';
import { metricLength } from '@/lib/proj';

export const runtime = 'nodejs';

/** Profil topographique le long d'une ligne (MNS Copernicus GLO-30, interpolation bilinéaire). */
export const POST = handle(async (req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const { line } = await req.json();
  if (line?.type !== 'LineString' || line.coordinates?.length < 2) throw new HttpError(400, 'Ligne attendue');
  const len = metricLength(site.utm, line);
  if (len > 50000) throw new HttpError(400, 'Ligne trop longue (50 km max)');
  const bb = turf.bbox(turf.lineString(line.coordinates));
  const pad = 0.002;
  const g = await readDem([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]);
  const step = Math.max(2, Math.min(50, len / 300));
  const pts = sampleLine(site, line, step).map((p) => ({ ...p, z: sample(g, p.lon, p.lat) }));
  const zs = pts.map((p) => p.z).filter((z): z is number => z !== null);
  let up = 0;
  let down = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].z;
    const b = pts[i].z;
    if (a === null || b === null) continue;
    if (b > a) up += b - a;
    else down += a - b;
  }
  return Response.json({
    length: len,
    step,
    points: pts.map((p) => ({ d: Math.round(p.d * 10) / 10, z: p.z === null ? null : Math.round(p.z * 10) / 10, lon: p.lon, lat: p.lat })),
    min: Math.min(...zs),
    max: Math.max(...zs),
    up,
    down,
    source: COP_ATTR,
    note: 'Modèle numérique de surface à 30 m : inclut le bâti et la végétation ; précision verticale de l’ordre de quelques mètres.',
  });
});
