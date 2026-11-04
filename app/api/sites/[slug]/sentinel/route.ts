import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite } from '@/lib/server/storage';
import { siteBBox } from '@/lib/site';
import { renderSentinel, searchSentinel, sentinelLayer } from '@/lib/server/collect/rasters';

export const runtime = 'nodejs';
type P = Ctx<{ slug: string }>;

/** Liste des images Sentinel-2 disponibles (24 derniers mois, < 30 % de nuages). */
export const GET = handle(async (req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const u = new URL(req.url);
  const months = Math.min(60, Number(u.searchParams.get('months')) || 24);
  const items = await searchSentinel(siteBBox(site), months, Number(u.searchParams.get('cloud')) || 30);
  // une image par date, en privilégiant celle qui couvre tout le site
  const byDate = new Map<string, (typeof items)[number]>();
  for (const it of items) {
    const prev = byDate.get(it.date);
    if (!prev || (it.covers && !prev.covers) || (it.covers === prev.covers && it.cloud < prev.cloud)) byDate.set(it.date, it);
  }
  return Response.json([...byDate.values()]);
});

/** Rend une date donnée et renvoie la définition de couche (le client l'ajoute au site). */
export const POST = handle(async (req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const body = await req.json();
  if (!body?.item?.id || !body?.item?.date) throw new HttpError(400, 'Image manquante');
  const bbox = siteBBox(site);
  const rel = await renderSentinel(slug, body.item, bbox);
  return Response.json({ ...sentinelLayer(body.item, rel, bbox, true), count: 1 });
});
