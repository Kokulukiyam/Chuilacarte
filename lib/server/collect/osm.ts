import 'server-only';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';
import type { Feature } from 'geojson';
import { fetchWithTimeout } from '../http';
import { fc, src, type CollectCtx, type Collector, type CollectedLayer } from './types';

const OSM_SOURCE = () => src('OpenStreetMap', 'ODbL 1.0', '© les contributeurs d’OpenStreetMap', 'https://www.openstreetmap.org/copyright');

function overpassQuery(b: [number, number, number, number]) {
  const bb = `${b[1]},${b[0]},${b[3]},${b[2]}`;
  return `[out:json][timeout:120][maxsize:536870912];
(
  way["building"](${bb});
  relation["building"](${bb});
  way["highway"](${bb});
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|disused|abandoned)$"](${bb});
  way["natural"~"^(water|wetland|wood|scrub|grassland|heath|sand|beach)$"](${bb});
  relation["natural"~"^(water|wetland|wood)$"](${bb});
  way["waterway"](${bb});
  way["landuse"](${bb});
  relation["landuse"](${bb});
  way["leisure"](${bb});
  relation["leisure"](${bb});
  nwr["amenity"](${bb});
  nwr["shop"](${bb});
  nwr["office"](${bb});
  nwr["healthcare"](${bb});
  nwr["tourism"](${bb});
  nwr["public_transport"~"^(station|platform)$"](${bb});
  nwr["railway"="station"](${bb});
  node["highway"="bus_stop"](${bb});
);
out body;
>;
out skel qt;`;
}

const DEFAULT_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const MIRRORS = () => (process.env.OVERPASS_URLS ? process.env.OVERPASS_URLS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_MIRRORS);

async function tryOverpass(b: [number, number, number, number], log: (m: string) => void): Promise<any | null> {
  const q = overpassQuery(b);
  const errors: string[] = [];
  for (const url of MIRRORS()) {
    const host = new URL(url).host;
    // test rapide : un miroir injoignable est écarté en quelques secondes (un statut HTTP d'erreur ne l'écarte pas)
    try {
      await fetchWithTimeout(url.replace(/interpreter$/, 'status'), { timeout: 20000 });
    } catch (e: any) {
      errors.push(`${host} : injoignable (${e.message})`);
      continue;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        log(`Overpass : requête sur ${host}${attempt > 1 ? ` (essai ${attempt})` : ''}`);
        const r = await fetchWithTimeout(url, {
          method: 'POST',
          timeout: 150000,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(q)}`,
        });
        if (r.status === 429 || r.status === 504 || r.status === 503) {
          errors.push(`${host} : HTTP ${r.status}`);
          await new Promise((res) => setTimeout(res, 3000 * attempt));
          continue;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j.remark && /error|timed out|runtime/i.test(j.remark)) throw new Error(j.remark);
        return { data: j, via: `Overpass (${host})` };
      } catch (e: any) {
        errors.push(`${host} : ${e.message}`);
        break;
      }
    }
  }
  log(`Overpass indisponible (${errors.join(' ; ')}) — repli sur l’API OSM`);
  return { errors };
}

/** Repli : API principale d'OSM (/api/0.6/map), par petites tuiles, séquentiellement. */
async function osmApi(b: [number, number, number, number], log: (m: string) => void) {
  const elements = new Map<string, any>();
  const tiles: [number, number, number, number][] = [];
  const step = 0.012;
  for (let x = b[0]; x < b[2]; x += step) for (let y = b[1]; y < b[3]; y += step) tiles.push([x, y, Math.min(b[2], x + step), Math.min(b[3], y + step)]);
  if (tiles.length > 60) throw new Error(`emprise trop grande pour l’API OSM (${tiles.length} tuiles) ; réessayez quand Overpass sera disponible`);
  const fetchTile = async (t: [number, number, number, number], depth: number): Promise<void> => {
    const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${t.map((v) => v.toFixed(6)).join(',')}`;
    const r = await fetchWithTimeout(url, { timeout: 90000 });
    if (r.status === 400 && depth < 3) {
      // trop de nœuds : on subdivise
      const mx = (t[0] + t[2]) / 2;
      const my = (t[1] + t[3]) / 2;
      for (const s of [
        [t[0], t[1], mx, my],
        [mx, t[1], t[2], my],
        [t[0], my, mx, t[3]],
        [mx, my, t[2], t[3]],
      ] as [number, number, number, number][])
        await fetchTile(s, depth + 1);
      return;
    }
    if (!r.ok) throw new Error(`API OSM : HTTP ${r.status}`);
    const j = await r.json();
    for (const e of j.elements || []) elements.set(`${e.type}/${e.id}`, e);
    await new Promise((res) => setTimeout(res, 300));
  };
  let i = 0;
  for (const t of tiles) {
    log(`API OSM : tuile ${++i}/${tiles.length}`);
    await fetchTile(t, 0);
  }
  return { elements: [...elements.values()] };
}

const ROAD: Record<string, string> = {
  motorway: 'primaire', motorway_link: 'primaire', trunk: 'primaire', trunk_link: 'primaire', primary: 'primaire', primary_link: 'primaire',
  secondary: 'secondaire', secondary_link: 'secondaire',
  tertiary: 'tertiaire', tertiary_link: 'tertiaire',
  residential: 'desserte', unclassified: 'desserte', living_street: 'desserte', service: 'desserte', road: 'desserte', busway: 'desserte',
  footway: 'piéton', path: 'piéton', pedestrian: 'piéton', steps: 'piéton', cycleway: 'piéton', track: 'piéton', bridleway: 'piéton', corridor: 'piéton',
};

export function amenityFamily(t: Record<string, any>): string | null {
  const a = t.amenity;
  if (['school', 'kindergarten', 'college', 'university', 'language_school', 'driving_school', 'training', 'music_school', 'prep_school'].includes(a)) return 'enseignement';
  if (['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'health_post', 'nursing_home', 'birthing_center'].includes(a) || t.healthcare) return 'santé';
  if (a === 'place_of_worship' || a === 'monastery') return 'culte';
  if (a === 'marketplace' || t.shop === 'mall' || t.shop === 'supermarket' || a === 'bank') return 'commerce';
  if (['townhall', 'courthouse', 'police', 'fire_station', 'post_office', 'embassy', 'public_building', 'prison', 'customs'].includes(a) || ['government', 'administrative'].includes(t.office)) return 'administration';
  if (['bus_station', 'ferry_terminal', 'taxi', 'car_rental', 'parking'].includes(a) || t.public_transport === 'station' || t.railway === 'station' || t.highway === 'bus_stop' || t.public_transport === 'platform') return 'transport';
  if (['community_centre', 'theatre', 'cinema', 'arts_centre', 'library', 'social_facility', 'youth_centre', 'events_venue', 'conference_centre'].includes(a) || ['stadium', 'sports_centre'].includes(t.leisure)) return 'sport-loisirs';
  return null;
}

function num(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

const GREEN_LANDUSE = new Set(['grass', 'forest', 'meadow', 'village_green', 'recreation_ground', 'orchard', 'allotments', 'flowerbed', 'plant_nursery']);
const GREEN_LEISURE = new Set(['park', 'garden', 'nature_reserve', 'golf_course']);
const GREEN_NATURAL = new Set(['wood', 'scrub', 'grassland', 'heath']);

export function classifyOsm(geo: { features: Feature[] }) {
  const L = {
    buildings: [] as Feature[],
    roads: [] as Feature[],
    rail: [] as Feature[],
    waterPoly: [] as Feature[],
    waterLine: [] as Feature[],
    green: [] as Feature[],
    landuse: [] as Feature[],
    amenities: [] as Feature[],
    pois: [] as Feature[],
  };
  for (const f of geo.features) {
    const t: Record<string, any> = (f.properties as any)?.tags || f.properties || {};
    const id = (f.properties as any)?.id || f.id;
    const g = f.geometry;
    if (!g) continue;
    const isPoly = /Polygon/.test(g.type);
    const isLine = /LineString/.test(g.type);
    const base = { osm_id: String(id), nom: t.name || t['name:fr'] || undefined };
    const clean = (p: Record<string, any>) => {
      const o: Record<string, any> = {};
      for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') o[k] = v;
      return o;
    };
    if (t.building && isPoly) {
      L.buildings.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.building, niveaux: num(t['building:levels']), hauteur: num(t.height), usage: t.amenity || t.shop || t.office, source: 'OSM' }) });
      // un bâtiment peut aussi être un équipement
    }
    if (t.highway && isLine && ROAD[t.highway]) {
      L.roads.push({ type: 'Feature', geometry: g, properties: clean({ ...base, classe: ROAD[t.highway], type_osm: t.highway, revetement: t.surface, voies: num(t.lanes), sens_unique: t.oneway === 'yes' ? 'oui' : undefined, ref: t.ref }) });
      continue;
    }
    if (t.railway && isLine && /rail|tram|subway|narrow_gauge|disused|abandoned/.test(t.railway)) {
      L.rail.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.railway, service: t.service }) });
      continue;
    }
    if (isPoly && (t.natural === 'water' || t.natural === 'wetland' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.water)) {
      L.waterPoly.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.water || t.natural || t.landuse || t.waterway }) });
      continue;
    }
    if (isLine && t.waterway) {
      L.waterLine.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.waterway }) });
      continue;
    }
    const fam = amenityFamily(t);
    if (fam) {
      const pt = g.type === 'Point' ? g : turf.pointOnFeature(f as any).geometry;
      L.amenities.push({ type: 'Feature', geometry: pt, properties: clean({ ...base, famille: fam, type: t.amenity || t.healthcare || t.office || t.leisure || t.public_transport || t.highway || t.shop, religion: t.religion, operateur: t.operator }) });
      if (!t.building && isPoly && (GREEN_LEISURE.has(t.leisure) || t.leisure === 'stadium' || t.leisure === 'sports_centre')) {
        L.landuse.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.leisure }) });
      }
      continue;
    }
    if (isPoly && (GREEN_LANDUSE.has(t.landuse) || GREEN_LEISURE.has(t.leisure) || GREEN_NATURAL.has(t.natural) || t.leisure === 'playground' || t.leisure === 'pitch')) {
      L.green.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.leisure || t.landuse || t.natural }) });
      continue;
    }
    if (isPoly && (t.landuse || t.leisure || t.natural === 'sand' || t.natural === 'beach' || t.amenity)) {
      L.landuse.push({ type: 'Feature', geometry: g, properties: clean({ ...base, type: t.landuse || t.leisure || t.natural || t.amenity }) });
      continue;
    }
    if (!t.building && (t.amenity || t.shop || t.tourism || t.office || t.craft)) {
      const pt = g.type === 'Point' ? g : turf.pointOnFeature(f as any).geometry;
      L.pois.push({ type: 'Feature', geometry: pt, properties: clean({ ...base, categorie: t.amenity ? 'service' : t.shop ? 'commerce' : t.tourism ? 'tourisme' : t.office ? 'bureau' : 'artisanat', type: t.amenity || t.shop || t.tourism || t.office || t.craft }) });
    }
  }
  return L;
}

function clipToArea(features: Feature[], area: Feature, bbox: number[]): Feature[] {
  // on garde les objets dont l'enveloppe recoupe l'emprise (les objets restent entiers)
  return features.filter((f) => {
    try {
      const b = turf.bbox(f as any);
      if (b[2] < bbox[0] || b[0] > bbox[2] || b[3] < bbox[1] || b[1] > bbox[3]) return false;
      if (f.geometry.type === 'Point') return turf.booleanPointInPolygon(f.geometry.coordinates, area as any);
      return turf.booleanIntersects(f as any, area as any);
    } catch {
      return true;
    }
  });
}

export const osmCollector: Collector = {
  id: 'osm',
  label: 'OpenStreetMap',
  description: 'Bâti, voirie hiérarchisée, voies ferrées, eau, occupation du sol, espaces verts, équipements, points d’intérêt',
  defaultOn: true,
  async run(ctx: CollectCtx) {
    const r = await tryOverpass(ctx.bbox, ctx.log);
    let raw: any;
    let via: string;
    if (r.data) {
      raw = r.data;
      via = r.via;
    } else {
      raw = await osmApi(ctx.bbox, ctx.log);
      via = 'API OSM 0.6 (repli)';
    }
    ctx.log(`OSM : conversion de ${raw.elements?.length ?? 0} éléments`);
    const geo = osmtogeojson(raw, { flatProperties: false } as any);
    const L = classifyOsm(geo);
    const s = () => ({ ...OSM_SOURCE(), name: `OpenStreetMap — ${via}` });
    const mk = (id: string, name: string, role: CollectedLayer['role'], geom: CollectedLayer['geom'], feats: Feature[], preset?: string, visible = true): CollectedLayer => ({
      id,
      name,
      role,
      geom,
      fc: fc(clipToArea(feats, ctx.area, ctx.bbox)),
      source: s(),
      stylePreset: preset,
      visible,
    });
    return {
      layers: [
        mk('osm-occupation', 'Occupation du sol (OSM)', 'landuse', 'polygon', L.landuse, 'occupation'),
        mk('osm-verts', 'Espaces verts (OSM)', 'green', 'polygon', L.green, 'vegetation'),
        mk('osm-eau', 'Plans d’eau (OSM)', 'water', 'polygon', L.waterPoly, 'eau'),
        mk('osm-cours-eau', 'Cours d’eau et canaux (OSM)', 'water', 'line', L.waterLine, 'cours-eau'),
        mk('osm-batiments', 'Bâtiments (OSM)', 'buildings', 'polygon', L.buildings, 'bati'),
        mk('osm-voirie', 'Voirie (OSM)', 'roads', 'line', L.roads, 'voirie'),
        mk('osm-rail', 'Voies ferrées (OSM)', 'railways', 'line', L.rail, 'rail'),
        mk('osm-equipements', 'Équipements (OSM)', 'amenities', 'point', L.amenities, 'equipements'),
        mk('osm-poi', 'Points d’intérêt (OSM)', 'pois', 'point', L.pois, 'poi', false),
      ],
      notes: [`Données OSM obtenues via ${via}`],
    };
  },
};
