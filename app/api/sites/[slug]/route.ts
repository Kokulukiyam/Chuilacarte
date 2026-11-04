import fs from 'node:fs/promises';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite, siteDir, writeLayer, writeSite } from '@/lib/server/storage';
import { bufferedEmprise } from '@/lib/site';
import type { Site } from '@/lib/types';

export const runtime = 'nodejs';
type P = Ctx<{ slug: string }>;

export const GET = handle(async (_req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  return Response.json(await readSite(slug));
});

/** Remplace site.json (sauvegarde automatique). */
export const PUT = handle(async (req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  const prev = await readSite(slug);
  const body = (await req.json()) as Site;
  if (!body || !Array.isArray(body.layers)) throw new HttpError(400, 'Site invalide');
  const site: Site = { ...body, slug: prev.slug, createdAt: prev.createdAt };
  // la zone tampon suit l'emprise et la distance
  if (site.buffer !== prev.buffer || JSON.stringify(site.emprise) !== JSON.stringify(prev.emprise)) {
    const buf = site.layers.find((l) => l.id === 'tampon');
    if (buf) {
      buf.name = `Zone tampon (${site.buffer} m)`;
      buf.legendLabel = `Zone tampon de ${site.buffer} m`;
      await writeLayer(slug, 'tampon', { type: 'FeatureCollection', features: [{ ...bufferedEmprise(site), properties: { distance_m: site.buffer } }] });
    }
  }
  await writeSite(site);
  return Response.json({ ok: true, updatedAt: site.updatedAt });
});

/** Renommer */
export const PATCH = handle(async (req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const body = await req.json();
  if (typeof body.name === 'string' && body.name.trim()) site.name = body.name.trim();
  await writeSite(site);
  return Response.json(site);
});

export const DELETE = handle(async (_req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  await readSite(slug);
  await fs.rm(siteDir(slug), { recursive: true, force: true });
  return Response.json({ ok: true });
});
