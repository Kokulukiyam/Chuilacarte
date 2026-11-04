import { handle, type Ctx } from '@/lib/server/route';
import { copyDir, readSite, siteDir, uniqueSlug, writeSite } from '@/lib/server/storage';

export const runtime = 'nodejs';

export const POST = handle(async (req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const body = await req.json().catch(() => ({}));
  const name = (body.name && String(body.name).trim()) || `${site.name} (copie)`;
  const ns = await uniqueSlug(name);
  await copyDir(siteDir(slug), siteDir(ns));
  const now = new Date().toISOString();
  const copy = { ...site, slug: ns, name, createdAt: now };
  await writeSite(copy);
  return Response.json(copy, { status: 201 });
});
