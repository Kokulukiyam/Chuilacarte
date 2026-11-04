import fs from 'node:fs/promises';
import path from 'node:path';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite, siteFile, writeAtomic } from '@/lib/server/storage';

export const runtime = 'nodejs';
type P = Ctx<{ slug: string; path: string[] }>;

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.gif': 'image/gif' };

export const GET = handle(async (_req: Request, ctx: P) => {
  const { slug, path: parts } = await ctx.params;
  const p = siteFile(slug, path.join('files', ...parts));
  try {
    const b = await fs.readFile(p);
    return new Response(new Uint8Array(b), { headers: { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'max-age=3600' } });
  } catch {
    throw new HttpError(404, 'Fichier introuvable');
  }
});

export const PUT = handle(async (req: Request, ctx: P) => {
  const { slug, path: parts } = await ctx.params;
  await readSite(slug);
  const ext = path.extname(parts[parts.length - 1]).toLowerCase();
  if (!TYPES[ext]) throw new HttpError(400, 'Type de fichier non autorisé');
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 80e6) throw new HttpError(413, 'Fichier trop lourd (80 Mo max)');
  await writeAtomic(siteFile(slug, path.join('files', ...parts)), buf);
  return Response.json({ ok: true, url: `files/${parts.join('/')}` });
});
