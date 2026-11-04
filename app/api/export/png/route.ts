import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { handle } from '@/lib/server/route';
import { HttpError } from '@/lib/server/storage';

export const runtime = 'nodejs';
export const maxDuration = 900;

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const STRIP_PX = 1600; // hauteur des bandes rastérisées : mémoire bornée quel que soit le format

// un seul export PNG à la fois (les grands formats sont lourds)
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

/**
 * Rastérise une mise en page SVG (mm) en PNG à la résolution demandée, par bandes horizontales
 * (chaque bande = même SVG avec une viewBox réduite), puis assemble ; densité inscrite dans le fichier.
 */
export const POST = handle(async (req: Request) => {
  const u = new URL(req.url);
  const dpi = Math.max(72, Math.min(600, Number(u.searchParams.get('dpi')) || 300));
  const widthMm = Number(u.searchParams.get('widthMm'));
  const heightMm = Number(u.searchParams.get('heightMm'));
  const svg = await req.text();
  if (!svg.startsWith('<svg')) throw new HttpError(400, 'SVG attendu');
  if (!(widthMm > 0) || !(heightMm > 0)) throw new HttpError(400, 'Dimensions de page manquantes');
  const W = Math.round((widthMm / 25.4) * dpi);
  const H = Math.round((heightMm / 25.4) * dpi);
  if (W > 20000 || H > 20000) throw new HttpError(413, `Image trop grande (${W} × ${H} px) : baissez la résolution`);
  const out = await exclusive(async () => {
    const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));
    const strips: { input: Buffer; top: number; left: number }[] = [];
    const mmPerPx = widthMm / W;
    for (let top = 0; top < H; top += STRIP_PX) {
      const h = Math.min(STRIP_PX, H - top);
      const y0 = top * mmPerPx;
      const hMm = h * mmPerPx;
      const part = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"\sviewBox="[^"]*"/, `<svg$1 width="${W}" height="${h}" viewBox="0 ${y0} ${widthMm} ${hMm}"`);
      const r = new Resvg(part, {
        fitTo: { mode: 'width', value: W },
        font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter', sansSerifFamily: 'Inter', serifFamily: 'Source Serif 4' },
        shapeRendering: 2,
        textRendering: 2,
        imageRendering: 0,
        background: '#ffffff',
      });
      const img = r.render();
      strips.push({ input: await sharp(img.asPng()).removeAlpha().png({ compressionLevel: 1 }).toBuffer(), top, left: 0 });
      (img as any).free?.();
      (r as any).free?.();
    }
    return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' }, limitInputPixels: false })
      .composite(strips)
      .removeAlpha()
      .toColourspace('srgb')
      .withMetadata({ density: dpi })
      .png({ compressionLevel: 6 })
      .toBuffer();
  });
  return new Response(new Uint8Array(out), { headers: { 'content-type': 'image/png', 'content-disposition': 'attachment; filename="carte.png"' } });
});
