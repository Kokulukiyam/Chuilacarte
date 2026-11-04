import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import type { Geometry, Position } from 'geojson';

/** WKT (OGC 1) d'une zone UTM WGS 84. */
export function utmWkt(epsg: number) {
  const south = epsg > 32700;
  const zone = epsg - (south ? 32700 : 32600);
  const cm = -183 + 6 * zone;
  return `PROJCS["WGS 84 / UTM zone ${zone}${south ? 'S' : 'N'}",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${cm}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${south ? 10000000 : 0}],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","${epsg}"]]`;
}

const WGS84_WKT =
  'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","4326"]]';

// ---------------------------------------------------------------- WKB
class W {
  parts: Buffer[] = [];
  u8(v: number) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v);
    this.parts.push(b);
  }
  u32(v: number) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v);
    this.parts.push(b);
  }
  f64(v: number) {
    const b = Buffer.alloc(8);
    b.writeDoubleLE(v);
    this.parts.push(b);
  }
  pt(p: Position) {
    this.f64(p[0]);
    this.f64(p[1]);
  }
}

function wkb(g: Geometry, w: W) {
  w.u8(1);
  switch (g.type) {
    case 'Point':
      w.u32(1);
      w.pt(g.coordinates);
      break;
    case 'LineString':
      w.u32(2);
      w.u32(g.coordinates.length);
      g.coordinates.forEach((p) => w.pt(p));
      break;
    case 'Polygon':
      w.u32(3);
      w.u32(g.coordinates.length);
      for (const r of g.coordinates) {
        w.u32(r.length);
        r.forEach((p) => w.pt(p));
      }
      break;
    case 'MultiPoint':
      w.u32(4);
      w.u32(g.coordinates.length);
      g.coordinates.forEach((p) => wkb({ type: 'Point', coordinates: p }, w));
      break;
    case 'MultiLineString':
      w.u32(5);
      w.u32(g.coordinates.length);
      g.coordinates.forEach((l) => wkb({ type: 'LineString', coordinates: l }, w));
      break;
    case 'MultiPolygon':
      w.u32(6);
      w.u32(g.coordinates.length);
      g.coordinates.forEach((p) => wkb({ type: 'Polygon', coordinates: p }, w));
      break;
    case 'GeometryCollection':
      w.u32(7);
      w.u32(g.geometries.length);
      g.geometries.forEach((x) => wkb(x, w));
      break;
  }
}

function envelope(g: Geometry): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const v = (c: any) => {
    if (typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]);
      x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]);
      y1 = Math.max(y1, c[1]);
    } else c.forEach(v);
  };
  if (g.type === 'GeometryCollection') g.geometries.forEach((x) => v((x as any).coordinates));
  else v((g as any).coordinates);
  return [x0, x1, y0, y1];
}

/** Géométrie au format GeoPackage (en-tête GP + enveloppe + WKB). */
export function gpkgGeom(g: Geometry, srsId: number): Buffer {
  const head = Buffer.alloc(8);
  head.write('GP', 0, 'ascii');
  head.writeUInt8(0, 2);
  head.writeUInt8(0b00000011, 3); // petit-boutiste, enveloppe [minx, maxx, miny, maxy]
  head.writeInt32LE(srsId, 4);
  const env = Buffer.alloc(32);
  const e = envelope(g);
  e.forEach((v, i) => env.writeDoubleLE(v, i * 8));
  const w = new W();
  wkb(g, w);
  return Buffer.concat([head, env, ...w.parts]);
}

// ---------------------------------------------------------------- écriture
export interface GpkgLayer {
  table: string;
  title: string;
  description?: string;
  features: { geometry: Geometry; properties: Record<string, any> }[];
  geomType: 'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTIPOINT' | 'MULTILINESTRING' | 'MULTIPOLYGON' | 'GEOMETRY';
  qml?: string;
  sld?: string;
}

export function safeTable(name: string, used: Set<string>) {
  let base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50) || 'couche';
  if (/^[0-9]/.test(base)) base = `c_${base}`;
  let t = base;
  let i = 2;
  while (used.has(t)) t = `${base}_${i++}`;
  used.add(t);
  return t;
}

function colType(values: any[]): 'INTEGER' | 'REAL' | 'TEXT' {
  let int = true;
  let num = true;
  let any = false;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    any = true;
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) int = false;
    } else {
      num = false;
      int = false;
      break;
    }
  }
  if (!any) return 'TEXT';
  return int ? 'INTEGER' : num ? 'REAL' : 'TEXT';
}

export function geomTypeOf(features: { geometry: Geometry }[]): GpkgLayer['geomType'] {
  const t = new Set(features.map((f) => f.geometry?.type).filter(Boolean));
  if (t.size === 0) return 'GEOMETRY';
  const only = (a: string[]) => [...t].every((x) => a.includes(x!));
  if (only(['Polygon', 'MultiPolygon'])) return t.has('MultiPolygon') ? 'MULTIPOLYGON' : 'POLYGON';
  if (only(['LineString', 'MultiLineString'])) return t.has('MultiLineString') ? 'MULTILINESTRING' : 'LINESTRING';
  if (only(['Point', 'MultiPoint'])) return t.has('MultiPoint') ? 'MULTIPOINT' : 'POINT';
  return 'GEOMETRY';
}

/** Écrit un GeoPackage multi-couches (une table par couche) avec styles QGIS par défaut (table layer_styles). */
export function writeGpkg(file: string, layers: GpkgLayer[], srs: { id: number; name: string; wkt: string }) {
  if (fs.existsSync(file)) fs.rmSync(file);
  const db = new Database(file);
  try {
    db.pragma('journal_mode = DELETE');
    db.pragma(`application_id = ${0x47504b47}`);
    db.pragma('user_version = 10300');
    db.exec(`
      CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
      CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER, CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));
      CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name), CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name), CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys (srs_id));
      CREATE TABLE layer_styles (id INTEGER PRIMARY KEY AUTOINCREMENT, f_table_catalog TEXT(256), f_table_schema TEXT(256), f_table_name TEXT(256), f_geometry_column TEXT(256), styleName TEXT(30), styleQML TEXT, styleSLD TEXT, useAsDefault BOOLEAN, description TEXT, owner TEXT(30), ui TEXT(30), update_time DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    `);
    const srsIns = db.prepare('INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,?)');
    srsIns.run('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system');
    srsIns.run('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system');
    srsIns.run('WGS 84 geodetic', 4326, 'EPSG', 4326, WGS84_WKT, 'longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid');
    if (srs.id !== 4326) srsIns.run(srs.name, srs.id, 'EPSG', srs.id, srs.wkt, srs.name);
    for (const l of layers) {
      const keys = new Set<string>();
      for (const f of l.features) for (const k of Object.keys(f.properties || {})) if (!k.startsWith('_') && k.toLowerCase() !== 'fid' && k.toLowerCase() !== 'geom') keys.add(k);
      const cols = [...keys].map((k) => ({ k, t: colType(l.features.map((f) => f.properties?.[k])) }));
      const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
      db.exec(`CREATE TABLE ${q(l.table)} (fid INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, geom ${l.geomType}${cols.map((c) => `, ${q(c.k)} ${c.t}`).join('')})`);
      const ins = db.prepare(`INSERT INTO ${q(l.table)} (geom${cols.map((c) => `, ${q(c.k)}`).join('')}) VALUES (?${cols.map(() => ', ?').join('')})`);
      let ext = [Infinity, Infinity, -Infinity, -Infinity];
      const tx = db.transaction(() => {
        for (const f of l.features) {
          if (!f.geometry) continue;
          const e = envelope(f.geometry);
          ext = [Math.min(ext[0], e[0]), Math.min(ext[1], e[2]), Math.max(ext[2], e[1]), Math.max(ext[3], e[3])];
          const vals = cols.map((c) => {
            const v = f.properties?.[c.k];
            if (v === undefined || v === null || v === '') return null;
            if (c.t === 'TEXT') return typeof v === 'object' ? JSON.stringify(v) : String(v);
            return Number(v);
          });
          ins.run(gpkgGeom(f.geometry, srs.id), ...vals);
        }
      });
      tx();
      if (!Number.isFinite(ext[0])) ext = [0, 0, 0, 0];
      db.prepare('INSERT INTO gpkg_contents (table_name, data_type, identifier, description, min_x, min_y, max_x, max_y, srs_id) VALUES (?,?,?,?,?,?,?,?,?)').run(l.table, 'features', l.title, l.description || '', ext[0], ext[1], ext[2], ext[3], srs.id);
      db.prepare('INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,?,?)').run(l.table, 'geom', l.geomType, srs.id, 0, 0);
      if (l.qml) db.prepare('INSERT INTO layer_styles (f_table_catalog, f_table_schema, f_table_name, f_geometry_column, styleName, styleQML, styleSLD, useAsDefault, description, owner, ui) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('', '', l.table, 'geom', 'Chuilacarte', l.qml, l.sld || '', 1, 'Style exporté par Chuilacarte', '', null);
    }
  } finally {
    db.close();
  }
}
