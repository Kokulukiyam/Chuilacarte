import fs from 'node:fs/promises';
import path from 'node:path';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, siteDir, writeAtomic } from '@/lib/server/storage';

export const runtime = 'nodejs';
type P = Ctx<{ slug: string }>;

export const GET = handle(async (_req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  try {
    const b = await fs.readFile(path.join(siteDir(slug), 'thumbnail.png'));
    return new Response(new Uint8Array(b), { headers: { 'content-type': 'image/png', 'cache-control': 'no-cache' } });
  } catch {
    throw new HttpError(404, 'Pas de vignette');
  }
});

export const PUT = handle(async (req: Request, ctx: P) => {
  const { slug } = await ctx.params;
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 5e6) throw new HttpError(413, 'Vignette trop lourde');
  if (buf.subarray(1, 4).toString() !== 'PNG') throw new HttpError(400, 'PNG attendu');
  await writeAtomic(path.join(siteDir(slug), 'thumbnail.png'), buf);
  return Response.json({ ok: true });
});
