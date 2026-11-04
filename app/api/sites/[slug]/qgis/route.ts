import { handle, type Ctx } from '@/lib/server/route';
import { readSite } from '@/lib/server/storage';
import { buildQgisBundle } from '@/lib/server/qgisProject';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Dossier QGIS (zip) : GeoPackage + projet .qgs + images calées. */
export const POST = handle(async (_req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const { zip, name } = await buildQgisBundle(site);
  return new Response(new Uint8Array(zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}"` } });
});
