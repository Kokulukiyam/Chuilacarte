import fs from 'node:fs/promises';
import path from 'node:path';
import { handle, type Ctx } from '@/lib/server/route';
import { fetchWithTimeout } from '@/lib/server/http';
import { CACHE_DIR, HttpError, writeAtomic } from '@/lib/server/storage';
import { TILE_SOURCES } from '@/lib/tilesources';

export const runtime = 'nodejs';
const inflight = new Map<string, Promise<Buffer | null>>();
const TRANSPARENT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const GET = handle(async (_req: Request, ctx: Ctx<{ src: string; z: string; x: string; y: string }>) => {
  const { src, z, x, y: yRaw } = await ctx.params;
  const def = TILE_SOURCES[src];
  if (!def) throw new HttpError(404, 'Source de tuiles inconnue');
  if (def.keyEnv && !process.env[def.keyEnv]) throw new HttpError(403, `Source désactivée : renseignez ${def.keyEnv} dans .env.local`);
  if (def.flagEnv && process.env[def.flagEnv] !== 'true') throw new HttpError(403, `Source désactivée : ${def.flagEnv}=true requis dans .env.local`);
  const y = yRaw.replace(/\.(png|jpg|jpeg|webp)$/, '');
  const [Z, X, Y] = [z, x, y].map(Number);
  if (![Z, X, Y].every(Number.isInteger) || Z < 0 || Z > 22 || X < 0 || Y < 0 || X >= 2 ** Z || Y >= 2 ** Z) throw new HttpError(400, 'Tuile invalide');
  if (Z > def.maxzoom) return new Response(new Uint8Array(TRANSPARENT), { headers: { 'content-type': 'image/png' } });
  const file = path.join(CACHE_DIR, 'tiles', src, String(Z), String(X), `${Y}.${def.ext}`);
  const type = def.ext === 'png' ? 'image/png' : 'image/jpeg';
  if (!def.noCache) try {
    const b = await fs.readFile(file);
    return new Response(new Uint8Array(b), { headers: { 'content-type': type, 'cache-control': 'public, max-age=604800' } });
  } catch {
    /* pas en cache */
  }
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      const url = def.url
        .replace('{z}', String(Z))
        .replace('{x}', String(X))
        .replace('{y}', String(Y))
        .replace('{key}', encodeURIComponent(def.keyEnv ? process.env[def.keyEnv] || '' : ''));
      const r = await fetchWithTimeout(url, { timeout: 20000 });
      if (r.status === 404) return null;
      if (!r.ok) throw new HttpError(502, `Serveur de tuiles : ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (!def.noCache) await writeAtomic(file, b).catch(() => {});
      return b;
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  const b = await p;
  if (!b) return new Response(new Uint8Array(TRANSPARENT), { headers: { 'content-type': 'image/png' } });
  return new Response(new Uint8Array(b), { headers: { 'content-type': type, 'cache-control': def.noCache ? 'private, max-age=3600' : 'public, max-age=604800' } });
});
