import fs from 'node:fs/promises';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, layerPath, readSite, writeLayer } from '@/lib/server/storage';

export const runtime = 'nodejs';
type P = Ctx<{ slug: string; id: string }>;

export const GET = handle(async (_req: Request, ctx: P) => {
  const { slug, id } = await ctx.params;
  try {
    const raw = await fs.readFile(layerPath(slug, id), 'utf8');
    return new Response(raw, { headers: { 'content-type': 'application/geo+json', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ type: 'FeatureCollection', features: [] });
  }
});

export const PUT = handle(async (req: Request, ctx: P) => {
  const { slug, id } = await ctx.params;
  await readSite(slug);
  const fc = await req.json();
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new HttpError(400, 'FeatureCollection attendue');
  await writeLayer(slug, id, fc);
  return Response.json({ ok: true, count: fc.features.length });
});

export const DELETE = handle(async (_req: Request, ctx: P) => {
  const { slug, id } = await ctx.params;
  await fs.rm(layerPath(slug, id), { force: true });
  return Response.json({ ok: true });
});
