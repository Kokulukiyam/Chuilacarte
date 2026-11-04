import 'server-only';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import type { FC, Layer, Site, SiteSummary } from '../types';

export const DATA_DIR = process.env.CHUILACARTE_DATA_DIR || path.join(process.cwd(), 'data');
export const SITES_DIR = path.join(DATA_DIR, 'sites');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'site'
  );
}

export function assertSlug(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) throw new HttpError(400, 'Identifiant de site invalide');
  return slug;
}

export function assertId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new HttpError(400, 'Identifiant invalide');
  return id;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function siteDir(slug: string) {
  return path.join(SITES_DIR, assertSlug(slug));
}

/** Résout un chemin relatif à l'intérieur du dossier d'un site en interdisant toute sortie du dossier. */
export function siteFile(slug: string, rel: string) {
  const base = siteDir(slug);
  const p = path.resolve(base, rel);
  if (!p.startsWith(base + path.sep)) throw new HttpError(400, 'Chemin invalide');
  return p;
}

export async function ensureDirs() {
  await fs.mkdir(SITES_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
}

/** Écriture atomique : fichier temporaire puis renommage. */
export async function writeAtomic(file: string, data: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export async function siteExists(slug: string) {
  try {
    await fs.access(path.join(siteDir(slug), 'site.json'));
    return true;
  } catch {
    return false;
  }
}

export async function readSite(slug: string): Promise<Site> {
  try {
    const raw = await fs.readFile(path.join(siteDir(slug), 'site.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(404, 'Site introuvable');
  }
}

export async function writeSite(site: Site) {
  site.updatedAt = new Date().toISOString();
  await writeAtomic(path.join(siteDir(site.slug), 'site.json'), JSON.stringify(site, null, 1));
}

export async function uniqueSlug(base: string) {
  const b = slugify(base);
  let s = b;
  let i = 2;
  while (await siteExists(s)) s = `${b}-${i++}`;
  return s;
}

export function layerPath(slug: string, id: string) {
  return path.join(siteDir(slug), 'layers', `${assertId(id)}.geojson`);
}

export async function readLayer(slug: string, id: string): Promise<FC> {
  try {
    return JSON.parse(await fs.readFile(layerPath(slug, id), 'utf8'));
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function writeLayer(slug: string, id: string, fc: FC) {
  await writeAtomic(layerPath(slug, id), JSON.stringify(fc));
}

export async function deleteLayerFiles(slug: string, layer: Layer) {
  await fs.rm(layerPath(slug, layer.id), { force: true });
  await fs.rm(path.join(siteDir(slug), 'layers', `${layer.id}.local.json`), { force: true });
  if (layer.raster?.type === 'image' && layer.raster.url.startsWith('files/')) {
    await fs.rm(siteFile(slug, layer.raster.url), { force: true });
  }
}

export async function listSites(): Promise<SiteSummary[]> {
  await ensureDirs();
  const entries = await fs.readdir(SITES_DIR, { withFileTypes: true });
  const out: SiteSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const s: Site = JSON.parse(await fs.readFile(path.join(SITES_DIR, e.name, 'site.json'), 'utf8'));
      out.push({
        slug: s.slug,
        name: s.name,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        center: s.center,
        layerCount: s.layers.length,
        buffer: s.buffer,
        hasThumbnail: fss.existsSync(path.join(SITES_DIR, e.name, 'thumbnail.png')),
      });
    } catch {
      /* dossier incomplet : ignoré */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function copyDir(src: string, dst: string) {
  await fs.cp(src, dst, { recursive: true });
}

export function jsonError(e: any) {
  const status = e instanceof HttpError ? e.status : 500;
  const msg = e instanceof HttpError ? e.message : `Erreur interne : ${e?.message || e}`;
  if (status >= 500) console.error('[chuilacarte]', e);
  return Response.json({ error: msg }, { status });
}
