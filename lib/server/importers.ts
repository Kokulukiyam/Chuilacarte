import 'server-only';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import Papa from 'papaparse';
import proj4 from 'proj4';
import { DOMParser } from '@xmldom/xmldom';
import { kml as kmlToGeojson } from '@tmcw/togeojson';
import { readDxf, guessDxfCrs } from '../dxf-read';
import { mapCoords } from '../proj';
import { detectGeom } from '../site';
import type { FC, GeomKind } from '../types';
import { query, sqlStr } from './duckdb';
import { HttpError } from './storage';

export interface ImportedLayer {
  name: string;
  fc: FC;
  geom: GeomKind;
  warning?: string;
}

function cleanFc(fc: FC): FC {
  const features = (fc.features || []).filter(
    (f) => f && f.geometry && ((f.geometry as any).coordinates !== undefined || f.geometry.type === 'GeometryCollection'),
  );
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { ...(f.properties || {}) } })),
  };
}

function reprojectFc(fc: FC, from: string): FC {
  const conv = proj4(from, 'EPSG:4326');
  return {
    ...fc,
    features: fc.features.map((f) => ({ ...f, geometry: f.geometry ? mapCoords(f.geometry, (p) => conv.forward([p[0], p[1]])) : f.geometry })),
  };
}

function epsgToProj4(code: number): string | null {
  if (code === 4326 || code === 4979 || code === 4269) return 'EPSG:4326';
  if (code === 3857 || code === 900913) return 'EPSG:3857';
  if (code >= 32601 && code <= 32660) return `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`;
  if (code >= 32701 && code <= 32760) return `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs`;
  return null;
}

function looksLonLat(fc: FC): boolean {
  let ok = true;
  let n = 0;
  const visit = (c: any) => {
    if (!ok || n > 2000) return;
    if (typeof c[0] === 'number') {
      n++;
      if (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) ok = false;
    } else c.forEach(visit);
  };
  for (const f of fc.features) if (f.geometry && 'coordinates' in f.geometry) visit((f.geometry as any).coordinates);
  return ok;
}

function fromGeoJSON(text: string, name: string): ImportedLayer[] {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'GeoJSON invalide (JSON illisible)');
  }
  let fc: FC;
  if (j.type === 'FeatureCollection') fc = j;
  else if (j.type === 'Feature') fc = { type: 'FeatureCollection', features: [j] };
  else if (j.type && j.coordinates) fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: j, properties: {} }] };
  else throw new HttpError(400, 'GeoJSON invalide : ni FeatureCollection, ni Feature, ni géométrie');
  const crsName: string | undefined = j.crs?.properties?.name;
  if (crsName) {
    const m = crsName.match(/EPSG:{1,2}(\d+)/i);
    if (m && !/CRS84/i.test(crsName)) {
      const def = epsgToProj4(Number(m[1]));
      if (!def) throw new HttpError(400, `Projection EPSG:${m[1]} non prise en charge pour le GeoJSON. Réexportez en EPSG:4326.`);
      if (def !== 'EPSG:4326') fc = reprojectFc(fc, def);
    }
  } else if (!looksLonLat(fc)) {
    throw new HttpError(400, 'Les coordonnées ne sont pas en degrés (WGS84) et aucune projection n’est indiquée.');
  }
  fc = cleanFc(fc);
  return [{ name, fc, geom: detectGeom(fc) }];
}

function fromKml(text: string, name: string): ImportedLayer[] {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const fc = cleanFc(kmlToGeojson(doc as any) as any);
  // séparer par type de géométrie si mixte
  return splitByGeom(fc, name);
}

function splitByGeom(fc: FC, name: string): ImportedLayer[] {
  const g = detectGeom(fc);
  if (g !== 'mixed') return [{ name, fc, geom: g }];
  const groups: Record<string, FC> = {};
  const lbl: Record<string, string> = { polygon: 'polygones', line: 'lignes', point: 'points' };
  for (const f of fc.features) {
    const t = f.geometry?.type || '';
    const k = t.includes('Polygon') ? 'polygon' : t.includes('Line') ? 'line' : t.includes('Point') ? 'point' : 'mixed';
    (groups[k] ||= { type: 'FeatureCollection', features: [] }).features.push(f);
  }
  return Object.entries(groups).map(([k, v]) => ({ name: `${name} (${lbl[k] || 'divers'})`, fc: v, geom: k as GeomKind }));
}

async function fromShpZip(buf: Buffer, name: string): Promise<ImportedLayer[]> {
  const shp: any = (await import('shpjs')).default;
  let res: any;
  try {
    res = await shp(buf);
  } catch (e: any) {
    throw new HttpError(400, `Shapefile illisible : ${e?.message || e}`);
  }
  const arr = Array.isArray(res) ? res : [res];
  const out: ImportedLayer[] = [];
  for (const fc0 of arr) {
    const fc = cleanFc(fc0);
    if (!looksLonLat(fc)) throw new HttpError(400, 'Shapefile sans fichier .prj exploitable : impossible de connaître la projection.');
    const n = fc0.fileName ? path.basename(String(fc0.fileName)) : name;
    out.push(...splitByGeom(fc, arr.length > 1 ? n : name));
  }
  return out;
}

async function fromGpkg(buf: Buffer, name: string): Promise<ImportedLayer[]> {
  const tmp = path.join(os.tmpdir(), `chuilacarte-${Date.now()}-${Math.random().toString(36).slice(2)}.gpkg`);
  await fs.writeFile(tmp, buf);
  try {
    const meta = await query<any>(`SELECT layers FROM ST_Read_Meta(${sqlStr(tmp)})`);
    const layers: any[] = meta[0]?.layers || [];
    if (!layers.length) throw new HttpError(400, 'GeoPackage sans couche vectorielle');
    const out: ImportedLayer[] = [];
    for (const l of layers) {
      const gf = l.geometry_fields?.[0];
      if (!gf) continue; // table attributaire seule
      const crs = gf.crs || {};
      let src: string | null = null;
      if (crs.auth_name === 'EPSG' && crs.auth_code) src = `EPSG:${crs.auth_code}`;
      else if (crs.proj4) src = crs.proj4;
      const gcol = gf.name || 'geom';
      const geomExpr = src && src !== 'EPSG:4326' ? `ST_Transform("${gcol}", ${sqlStr(src)}, 'EPSG:4326')` : `"${gcol}"`;
      const rows = await query<any>(
        `SELECT * EXCLUDE ("${gcol}"), ST_AsGeoJSON(${geomExpr}) AS __g FROM ST_Read(${sqlStr(tmp)}, layer := ${sqlStr(l.name)})`,
      );
      const fc: FC = {
        type: 'FeatureCollection',
        features: rows
          .filter((r) => r.__g)
          .map((r) => {
            const { __g, ...props } = r;
            return { type: 'Feature', geometry: JSON.parse(__g), properties: props };
          }),
      };
      out.push(...splitByGeom(fc, layers.length > 1 ? l.name : name));
    }
    return out;
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

function fromCsv(text: string, name: string): ImportedLayer[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false, delimitersToGuess: [',', ';', '\t', '|'] });
  const fields = parsed.meta.fields || [];
  const find = (cands: string[]) => fields.find((f) => cands.includes(f.trim().toLowerCase()));
  const lon = find(['lon', 'lng', 'long', 'longitude', 'x', 'coord_x', 'longitude_dd']);
  const lat = find(['lat', 'latitude', 'y', 'coord_y', 'latitude_dd']);
  const wkt = find(['wkt', 'geometry', 'geom', 'the_geom']);
  const num = (s: any) => Number(String(s ?? '').trim().replace(',', '.'));
  const features: any[] = [];
  if (lon && lat) {
    for (const r of parsed.data) {
      const x = num(r[lon]);
      const y = num(r[lat]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const props: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) if (k !== lon && k !== lat) props[k] = v;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: props });
    }
  } else if (wkt) {
    for (const r of parsed.data) {
      const g = parseWktPoint(r[wkt]);
      if (!g) continue;
      const props: Record<string, any> = { ...r };
      delete props[wkt];
      features.push({ type: 'Feature', geometry: g, properties: props });
    }
  } else {
    throw new HttpError(400, `CSV : colonnes de coordonnées introuvables. Nommez-les « longitude » et « latitude » (ou lon/lat, x/y). Colonnes trouvées : ${fields.join(', ')}`);
  }
  let fc: FC = { type: 'FeatureCollection', features };
  if (!features.length) throw new HttpError(400, 'CSV : aucune ligne avec des coordonnées valides');
  if (!looksLonLat(fc)) {
    // coordonnées métriques : on suppose UTM 28N (Dakar / ouest du Sénégal)
    fc = reprojectFc(fc, epsgToProj4(32628)!);
    return [{ name, fc, geom: 'point', warning: 'Coordonnées métriques interprétées en UTM 28N (EPSG:32628).' }];
  }
  return [{ name, fc, geom: 'point' }];
}

function parseWktPoint(s: string | undefined) {
  if (!s) return null;
  const m = s.match(/POINT\s*\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)/i);
  if (!m) return null;
  return { type: 'Point', coordinates: [Number(m[1]), Number(m[2])] };
}

function fromDxf(text: string, name: string, opts: { allowLocal?: boolean; epsg?: number }): ImportedLayer[] {
  const r = readDxf(text);
  if (!r.fc.features.length) throw new HttpError(400, 'DXF : aucune entité géométrique lisible');
  const crs = opts.epsg ? 'forced' : guessDxfCrs(r.bbox);
  let fc = r.fc;
  let warning: string | undefined;
  if (crs === 'forced') {
    const def = epsgToProj4(opts.epsg!);
    if (!def) throw new HttpError(400, `EPSG:${opts.epsg} non pris en charge`);
    if (def !== 'EPSG:4326') fc = reprojectFc(fc, def);
  } else if (crs === 'utm') {
    fc = reprojectFc(fc, epsgToProj4(32628)!);
    warning = 'DXF en coordonnées métriques : interprété en UTM 28N (EPSG:32628).';
  } else if (crs === 'local') {
    if (!opts.allowLocal)
      throw new HttpError(
        400,
        'Ce DXF est en coordonnées locales (non géoréférencé). Importez-le via « Implantation de projet » pour le caler sur la carte.',
      );
  }
  return splitByGeom(cleanFc(fc), name).map((l) => ({ ...l, warning }));
}

export async function importFile(fileName: string, buf: Buffer, opts: { allowLocalDxf?: boolean; epsg?: number } = {}): Promise<ImportedLayer[]> {
  const ext = path.extname(fileName).toLowerCase();
  const name = path.basename(fileName, ext);
  const text = () => buf.toString('utf8');
  switch (ext) {
    case '.geojson':
    case '.json':
      return fromGeoJSON(text(), name);
    case '.kml':
      return fromKml(text(), name);
    case '.kmz': {
      const zip = await JSZip.loadAsync(buf);
      const k = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.kml'));
      if (!k) throw new HttpError(400, 'KMZ sans fichier KML');
      return fromKml(await zip.files[k].async('string'), name);
    }
    case '.zip':
      return fromShpZip(buf, name);
    case '.gpkg':
      return fromGpkg(buf, name);
    case '.csv':
    case '.txt':
      return fromCsv(text(), name);
    case '.dxf':
      return fromDxf(text(), name, { allowLocal: opts.allowLocalDxf, epsg: opts.epsg });
    case '.shp':
      throw new HttpError(400, 'Pour un Shapefile, zippez ensemble les fichiers .shp, .shx, .dbf et .prj puis importez le .zip.');
    default:
      throw new HttpError(400, `Format non pris en charge : ${ext || 'inconnu'}. Formats acceptés : GeoJSON, KML/KMZ, GeoPackage, Shapefile zippé, CSV, DXF.`);
  }
}
