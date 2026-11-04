import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { handle } from '@/lib/server/route';
import { HttpError } from '@/lib/server/storage';

export const runtime = 'nodejs';
export const maxDuration = 600;

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

/** Rastérise une mise en page SVG (mm) en PNG à la résolution demandée, avec la densité inscrite dans le fichier. */
export const POST = handle(async (req: Request) => {
  const u = new URL(req.url);
  const dpi = Math.max(72, Math.min(600, Number(u.searchParams.get('dpi')) || 300));
  const widthMm = Number(u.searchParams.get('widthMm'));
  const svg = await req.text();
  if (!svg.startsWith('<svg')) throw new HttpError(400, 'SVG attendu');
  if (!(widthMm > 0)) throw new HttpError(400, 'Largeur de page manquante');
  const px = Math.round((widthMm / 25.4) * dpi);
  if (px > 20000) throw new HttpError(413, `Image trop grande (${px} px de large) : baissez la résolution`);
  const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: px },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter', sansSerifFamily: 'Inter', serifFamily: 'Source Serif 4' },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 2,
    background: '#ffffff',
  });
  const png = r.render().asPng();
  const out = await sharp(png, { limitInputPixels: false }).withMetadata({ density: dpi }).png({ compressionLevel: 6 }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'content-type': 'image/png', 'content-disposition': 'attachment; filename="carte.png"' } });
});
