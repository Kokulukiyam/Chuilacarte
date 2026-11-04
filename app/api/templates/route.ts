import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { handle } from '@/lib/server/route';
import { HttpError, TEMPLATES_DIR, ensureDirs, writeAtomic } from '@/lib/server/storage';

export const runtime = 'nodejs';

/** Modèles de mise en page réutilisables (data/templates/*.json). */
export const GET = handle(async () => {
  await ensureDirs();
  const files = (await fs.readdir(TEMPLATES_DIR)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(TEMPLATES_DIR, f), 'utf8')));
    } catch {
      /* fichier illisible ignoré */
    }
  }
  return Response.json(out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr')));
});

export const POST = handle(async (req: Request) => {
  await ensureDirs();
  const body = await req.json();
  if (!body?.name || !body?.layout) throw new HttpError(400, 'Nom et mise en page requis');
  const id = nanoid(8).replace(/[^A-Za-z0-9]/g, 'x');
  const { center, ...layout } = body.layout;
  void center;
  const tpl = { id, name: String(body.name).slice(0, 80), createdAt: new Date().toISOString(), layout };
  await writeAtomic(path.join(TEMPLATES_DIR, `${id}.json`), JSON.stringify(tpl, null, 1));
  return Response.json(tpl, { status: 201 });
});

export const DELETE = handle(async (req: Request) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new HttpError(400, 'Identifiant invalide');
  await fs.rm(path.join(TEMPLATES_DIR, `${id}.json`), { force: true });
  return Response.json({ ok: true });
});
