import fs from 'node:fs/promises';
import { handle } from '@/lib/server/route';
import { ensureDirs, HttpError, listSites, siteDir, uniqueSlug, writeLayer, writeSite } from '@/lib/server/storage';
import { createSiteObject, perimeterLayers } from '@/lib/site';
import type { FC } from '@/lib/types';

export const runtime = 'nodejs';

export const GET = handle(async () => Response.json(await listSites()));

export const POST = handle(async (req: Request) => {
  await ensureDirs();
  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Nom du site requis');
  const emprise = body.emprise as FC;
  if (!emprise?.features?.length) throw new HttpError(400, 'Emprise requise');
  const slug = await uniqueSlug(name);
  let site;
  try {
    site = createSiteObject(name, slug, emprise, Number(body.buffer) || 0);
  } catch (e: any) {
    throw new HttpError(400, e.message);
  }
  if (body.description) site.description = String(body.description);
  await fs.mkdir(siteDir(slug), { recursive: true });
  const { layers, data } = perimeterLayers(site);
  site.layers = layers;
  for (const [id, fc] of Object.entries(data)) await writeLayer(slug, id, fc);
  // couches supplémentaires importées avec l'emprise (fichier d'origine)
  if (Array.isArray(body.extraLayers)) {
    for (const x of body.extraLayers) {
      if (!x?.layer?.id || !x?.data) continue;
      site.layers.unshift(x.layer);
      await writeLayer(slug, x.layer.id, x.data);
    }
  }
  await writeSite(site);
  return Response.json(site, { status: 201 });
});
