import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite, siteFile, writeAtomic } from '@/lib/server/storage';

export const runtime = 'nodejs';

/** Garde une copie d'un export dans data/sites/<slug>/exports/ */
export const PUT = handle(async (req: Request, ctx: Ctx<{ slug: string; name: string }>) => {
  const { slug, name } = await ctx.params;
  await readSite(slug);
  if (!/^[\w.\- ()À-ÿ]{1,120}\.(png|pdf|svg|gpkg|dxf|zip|csv|json|qgz|qgs)$/i.test(name)) throw new HttpError(400, 'Nom de fichier invalide');
  const buf = Buffer.from(await req.arrayBuffer());
  await writeAtomic(siteFile(slug, `exports/${name}`), buf);
  return Response.json({ ok: true, path: `data/sites/${slug}/exports/${name}` });
});
