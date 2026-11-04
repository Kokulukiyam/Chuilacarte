import 'server-only';
import { fetchWithTimeout } from '../http';
import { query, sqlStr } from '../duckdb';
import { fc, src, type CollectCtx, type Collector, type CollectedLayer } from './types';

let releaseCache: { rel: string; at: number } | null = null;

export async function overtureRelease(): Promise<string> {
  if (releaseCache && Date.now() - releaseCache.at < 6 * 3600e3) return releaseCache.rel;
  const r = await fetchWithTimeout('https://stac.overturemaps.org/catalog.json', { timeout: 15000 });
  if (!r.ok) throw new Error(`catalogue STAC Overture : HTTP ${r.status}`);
  const j = await r.json();
  let rel: string | undefined = j.latest;
  if (!rel) {
    const kids = (j.links || []).filter((l: any) => l.rel === 'child').map((l: any) => String(l.href).match(/(\d{4}-\d{2}-\d{2}\.\d+)/)?.[1]).filter(Boolean);
    rel = kids.sort().pop();
  }
  if (!rel) throw new Error('release Overture introuvable');
  releaseCache = { rel, at: Date.now() };
  return rel;
}

/** URLs https des fichiers GeoParquet d'un type dont l'emprise recoupe la bbox. */
async function filesFor(rel: string, theme: string, type: string, b: [number, number, number, number]): Promise<string[]> {
  const base = `https://stac.overturemaps.org/${rel}/${theme}/${type}`;
  const r = await fetchWithTimeout(`${base}/collection.json`, { timeout: 20000 });
  if (!r.ok) throw new Error(`collection ${theme}/${type} : HTTP ${r.status}`);
  const col = await r.json();
  const boxes: number[][] = (col.extent?.spatial?.bbox || []).slice(1);
  const items = (col.links || []).filter((l: any) => l.rel === 'item');
  const hits: string[] = [];
  for (let i = 0; i < items.length && i < boxes.length; i++) {
    const bb = boxes[i];
    if (bb[0] <= b[2] && bb[2] >= b[0] && bb[1] <= b[3] && bb[3] >= b[1]) hits.push(new URL(items[i].href, `${base}/`).toString());
  }
  const urls: string[] = [];
  for (const h of hits) {
    const ir = await fetchWithTimeout(h, { timeout: 20000 });
    if (!ir.ok) continue;
    const it = await ir.json();
    const href = it.assets?.aws?.href || Object.values(it.assets || {}).map((a: any) => a.href).find((x: string) => /^https:.*\.parquet$/.test(x));
    if (href) urls.push(String(href).replace(/^s3:\/\/overturemaps-us-west-2\//, 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'));
  }
  return urls;
}

function bboxWhere(b: number[]) {
  return `bbox.xmin < ${b[2]} AND bbox.xmax > ${b[0]} AND bbox.ymin < ${b[3]} AND bbox.ymax > ${b[1]}`;
}

function areaWkt(ctx: CollectCtx) {
  return sqlStr(JSON.stringify(ctx.area.geometry));
}

const ROAD_CLASS: Record<string, string> = {
  motorway: 'primaire', trunk: 'primaire', primary: 'primaire',
  secondary: 'secondaire', tertiary: 'tertiaire',
  residential: 'desserte', unclassified: 'desserte', living_street: 'desserte', service: 'desserte', unknown: 'desserte',
  pedestrian: 'piéton', footway: 'piéton', path: 'piéton', steps: 'piéton', cycleway: 'piéton', track: 'piéton', sidewalk: 'piéton', crosswalk: 'piéton', bridleway: 'piéton',
};

async function readRows(urls: string[], select: string, where: string, ctx: CollectCtx) {
  if (!urls.length) return [];
  const list = `[${urls.map(sqlStr).join(',')}]`;
  return query<any>(
    `SELECT ${select}, ST_AsGeoJSON(geometry) AS __g FROM read_parquet(${list}) WHERE ${where} AND ST_Intersects(geometry, ST_GeomFromGeoJSON(${areaWkt(ctx)}))`,
  );
}

function toFeatures(rows: any[], map: (r: any) => Record<string, any>) {
  return rows.map((r) => {
    const p = map(r);
    for (const k of Object.keys(p)) if (p[k] === null || p[k] === undefined || p[k] === '') delete p[k];
    return { type: 'Feature', geometry: JSON.parse(r.__g), properties: p };
  });
}

export const overtureCollector: Collector = {
  id: 'overture',
  label: 'Overture Maps',
  description: 'Bâtiments conflués (OSM + Google + Microsoft), lieux, réseau de transport',
  defaultOn: true,
  async run(ctx) {
    const rel = await overtureRelease();
    ctx.log(`Overture : release ${rel}`);
    const b = ctx.bbox;
    const where = bboxWhere(b);
    const [fb, fp, fs] = await Promise.all([
      filesFor(rel, 'buildings', 'building', b),
      filesFor(rel, 'places', 'place', b),
      filesFor(rel, 'transportation', 'segment', b),
    ]);
    ctx.log(`Overture : lecture des bâtiments (${fb.length} fichier(s))`);
    const rb = await readRows(fb, `id, sources[1].dataset AS src_ds, sources[1].confidence AS conf, height, num_floors, class, subtype, names.primary AS nom`, where, ctx);
    ctx.log(`Overture : lecture des lieux (${fp.length} fichier(s))`);
    const rp = await readRows(fp, `id, names.primary AS nom, basic_category AS cat, taxonomy.primary AS tax, confidence AS conf, sources[1].dataset AS src_ds, sources[1].license AS lic`, where, ctx);
    ctx.log(`Overture : lecture du réseau (${fs.length} fichier(s))`);
    const rs = await readRows(fs, `id, subtype, class, names.primary AS nom`, `${where} AND subtype = 'road'`, ctx);
    const attrOv = '© Overture Maps Foundation, © les contributeurs d’OpenStreetMap';
    const layers: CollectedLayer[] = [
      {
        id: 'ov-batiments',
        name: 'Bâtiments (Overture)',
        role: 'buildings',
        geom: 'polygon',
        fc: fc(
          toFeatures(rb, (r) => ({
            overture_id: r.id,
            source: r.src_ds,
            confiance: r.conf !== null && r.conf !== undefined ? Math.round(Number(r.conf) * 100) / 100 : undefined,
            hauteur: r.height ?? undefined,
            niveaux: r.num_floors ?? undefined,
            type: r.class || r.subtype,
            nom: r.nom,
          })),
        ),
        source: src(`Overture Maps ${rel} — bâtiments`, 'ODbL 1.0 (Google Open Buildings : CC BY 4.0)', `${attrOv}, Google Open Buildings (CC BY 4.0), Microsoft Global ML Building Footprints (ODbL)`, 'https://docs.overturemaps.org/attribution/'),
        stylePreset: 'bati-clair',
        visible: false,
      },
      {
        id: 'ov-lieux',
        name: 'Lieux (Overture)',
        role: 'pois',
        geom: 'point',
        fc: fc(toFeatures(rp, (r) => ({ overture_id: r.id, nom: r.nom, categorie: r.cat, taxonomie: r.tax, confiance: r.conf !== null ? Math.round(Number(r.conf) * 100) / 100 : undefined, source: r.src_ds, licence: r.lic }))),
        source: src(`Overture Maps ${rel} — lieux`, 'CDLA-Permissive-2.0 / Apache 2.0 selon l’objet', `${attrOv}, Meta, Microsoft (CDLA-Permissive-2.0), Foursquare (Apache 2.0)`, 'https://docs.overturemaps.org/attribution/'),
        stylePreset: 'poi',
        visible: false,
      },
      {
        id: 'ov-voirie',
        name: 'Réseau routier (Overture)',
        role: 'roads',
        geom: 'line',
        fc: fc(toFeatures(rs, (r) => ({ overture_id: r.id, classe: ROAD_CLASS[r.class] || 'desserte', type_overture: r.class, nom: r.nom }))),
        source: src(`Overture Maps ${rel} — transport`, 'ODbL 1.0', attrOv, 'https://docs.overturemaps.org/attribution/'),
        stylePreset: 'voirie',
        visible: false,
      },
    ];
    return { layers, notes: [`Overture ${rel}`] };
  },
};
