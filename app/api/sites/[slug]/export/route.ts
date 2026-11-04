import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { handle, type Ctx } from '@/lib/server/route';
import { HttpError, readSite, slugify } from '@/lib/server/storage';
import { buildDxf, buildGpkg, cleanProps, collectExportLayers } from '@/lib/server/exportLayers';
import { dxfToBuffer } from '@/lib/dxf-write';

export const runtime = 'nodejs';

/** Export des couches vectorielles : GeoJSON (WGS84, zip), GeoPackage (UTM du site) ou DXF (UTM, mètres). */
export const POST = handle(async (req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const site = await readSite(slug);
  const body = await req.json().catch(() => ({}));
  const format = String(body.format || 'gpkg');
  const layers = await collectExportLayers(site, body.layers);
  if (!layers.length) throw new HttpError(400, 'Aucune couche vectorielle visible à exporter');
  const base = slugify(site.name);
  if (format === 'geojson') {
    const zip = new JSZip();
    const used = new Set<string>();
    for (const { layer, features } of layers) {
      let n = slugify(layer.name);
      while (used.has(n)) n += '-2';
      used.add(n);
      zip.file(`${n}.geojson`, JSON.stringify({ type: 'FeatureCollection', name: layer.name, features: features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: cleanProps(layer, f.properties || {}) })) }));
    }
    zip.file('LISEZMOI.txt', `Couches du site « ${site.name} » exportées par Chuilacarte le ${new Date().toLocaleString('fr-FR')}.\nSystème de coordonnées : WGS 84 (EPSG:4326).\n\nSources :\n${[...new Set(layers.map((l) => `- ${l.layer.name} : ${l.layer.source.name} (${l.layer.source.license}) ${l.layer.source.attribution}`))].join('\n')}\n`);
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${base}-geojson.zip"` } });
  }
  if (format === 'gpkg') {
    const tmp = path.join(os.tmpdir(), `chuilacarte-${Date.now()}.gpkg`);
    try {
      buildGpkg(tmp, site, layers, body.crs === 'wgs84' ? 'wgs84' : 'utm');
      const buf = await fs.readFile(tmp);
      return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/geopackage+sqlite3', 'content-disposition': `attachment; filename="${base}.gpkg"` } });
    } finally {
      await fs.rm(tmp, { force: true });
    }
  }
  if (format === 'dxf') {
    const txt = dxfToBuffer(buildDxf(site, layers));
    return new Response(new Uint8Array(txt), { headers: { 'content-type': 'application/dxf', 'content-disposition': `attachment; filename="${base}-utm${site.utm.zone}.dxf"` } });
  }
  throw new HttpError(400, `Format inconnu : ${format}`);
});
