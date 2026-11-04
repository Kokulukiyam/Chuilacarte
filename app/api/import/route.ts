import { handle } from '@/lib/server/route';
import { HttpError } from '@/lib/server/storage';
import { importFile } from '@/lib/server/importers';

export const runtime = 'nodejs';

/** Analyse un fichier et renvoie ses couches en GeoJSON WGS84 (sans rien enregistrer). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Fichier manquant');
  if (file.size > 200e6) throw new HttpError(413, 'Fichier trop lourd (200 Mo max)');
  const buf = Buffer.from(await file.arrayBuffer());
  const epsg = form.get('epsg') ? Number(form.get('epsg')) : undefined;
  const layers = await importFile(file.name, buf, { allowLocalDxf: form.get('allowLocalDxf') === '1', epsg });
  const nonEmpty = layers.filter((l) => l.fc.features.length);
  if (!nonEmpty.length) throw new HttpError(400, 'Aucun objet géographique trouvé dans ce fichier');
  return Response.json({ layers: nonEmpty });
});
