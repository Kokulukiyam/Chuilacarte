import 'server-only';
import sharp from 'sharp';
import * as turf from '@turf/turf';
import { cachedDownload, readWindow } from '../raster';
import { fetchWithTimeout } from '../http';
import { siteFile, writeAtomic } from '../storage';
import { countryIso3 } from './openbuildings';
import { fc, src, type Collector } from './types';

// ---------------------------------------------------------------- WorldPop
export const worldpopCollector: Collector = {
  id: 'worldpop',
  label: 'Population (WorldPop 100 m)',
  description: 'Population estimée par carreau d’environ 1 ha (R2025A, année en cours)',
  defaultOn: true,
  async run(ctx) {
    const iso = await countryIso3(ctx.site.center[0], ctx.site.center[1]);
    const year = Math.min(2030, Math.max(2015, new Date().getFullYear()));
    const lc = iso.toLowerCase();
    const url = `https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/${year}/${iso}/v1/100m/constrained/${lc}_pop_${year}_CN_100m_R2025A_v1.tif`;
    ctx.log(`WorldPop : fichier ${iso} ${year} (téléchargé une seule fois, ~20 Mo)`);
    const file = await cachedDownload(url, `worldpop_${lc}_${year}.tif`);
    const g = await readWindow(file, ctx.bbox);
    const feats: any[] = [];
    let total = 0;
    for (let y = 0; y < g.height; y++)
      for (let x = 0; x < g.width; x++) {
        const v = g.data[y * g.width + x];
        if (!Number.isFinite(v) || v <= 0 || (g.nodata !== null && v === g.nodata)) continue;
        const w = g.bbox[0] + x * g.resX;
        const n = g.bbox[3] - y * g.resY;
        const cell = turf.bboxPolygon([w, n - g.resY, w + g.resX, n]);
        const c = turf.centroid(cell).geometry.coordinates;
        if (!turf.booleanPointInPolygon(c, ctx.area as any)) continue;
        const areaHa = turf.area(cell) / 1e4;
        total += v;
        feats.push({ type: 'Feature', geometry: cell.geometry, properties: { population: Math.round(v * 10) / 10, densite_hab_ha: Math.round((v / areaHa) * 10) / 10 } });
      }
    return {
      layers: [
        {
          id: 'wp-population',
          name: `Population ${year} (WorldPop)`,
          role: 'population',
          geom: 'polygon',
          fc: fc(feats),
          source: src(`WorldPop R2025A v1 — ${year}`, 'CC BY 4.0', 'Population : WorldPop (www.worldpop.org), R2025A v1, DOI 10.5258/SOTON/WP00839 — CC BY 4.0', 'https://www.worldpop.org'),
          stylePreset: 'population',
          visible: false,
        },
      ],
      notes: [`Population estimée dans l’emprise + tampon : ${Math.round(total).toLocaleString('fr-FR')} habitants`],
    };
  },
};

// ---------------------------------------------------------------- ESA WorldCover
export const WORLDCOVER_CLASSES: Record<number, { label: string; color: [number, number, number] }> = {
  10: { label: 'Arbres', color: [0, 100, 0] },
  20: { label: 'Arbustes', color: [255, 187, 34] },
  30: { label: 'Prairies', color: [255, 255, 76] },
  40: { label: 'Cultures', color: [240, 150, 255] },
  50: { label: 'Bâti', color: [250, 0, 0] },
  60: { label: 'Sol nu / végétation éparse', color: [180, 180, 180] },
  70: { label: 'Neige et glace', color: [240, 240, 240] },
  80: { label: 'Eau permanente', color: [0, 100, 200] },
  90: { label: 'Zones humides herbacées', color: [0, 150, 160] },
  95: { label: 'Mangroves', color: [0, 207, 117] },
  100: { label: 'Mousses et lichens', color: [250, 230, 160] },
};

const hex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const worldcoverCollector: Collector = {
  id: 'worldcover',
  label: 'Occupation du sol (ESA WorldCover 10 m)',
  description: 'Classes d’occupation du sol 2021 (arbres, bâti, eau, mangroves…)',
  defaultOn: true,
  async run(ctx) {
    const [w, s] = ctx.bbox;
    const la = Math.floor(s / 3) * 3;
    const lo = Math.floor(w / 3) * 3;
    const tile = `${la >= 0 ? 'N' : 'S'}${String(Math.abs(la)).padStart(2, '0')}${lo >= 0 ? 'E' : 'W'}${String(Math.abs(lo)).padStart(3, '0')}`;
    const url = `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`;
    ctx.log(`WorldCover : tuile ${tile}`);
    const g = await readWindow(url, ctx.bbox, 2.5e7);
    const rgba = Buffer.alloc(g.width * g.height * 4);
    const counts: Record<number, number> = {};
    for (let i = 0; i < g.width * g.height; i++) {
      const v = g.data[i];
      const c = WORLDCOVER_CLASSES[v];
      if (!c) continue;
      counts[v] = (counts[v] || 0) + 1;
      rgba[i * 4] = c.color[0];
      rgba[i * 4 + 1] = c.color[1];
      rgba[i * 4 + 2] = c.color[2];
      rgba[i * 4 + 3] = 255;
    }
    const png = await sharp(rgba, { raw: { width: g.width, height: g.height, channels: 4 } }).png().toBuffer();
    const rel = 'files/worldcover-2021.png';
    await writeAtomic(siteFile(ctx.slug, rel), png);
    const tot = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const legend = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => ({ color: hex(WORLDCOVER_CLASSES[Number(k)].color), label: WORLDCOVER_CLASSES[Number(k)].label }));
    return {
      layers: [
        {
          id: 'wc-occupation',
          name: 'Occupation du sol 2021 (ESA WorldCover)',
          role: 'raster',
          geom: 'mixed',
          raster: { type: 'image', url: rel, bounds: g.bbox, legend },
          source: src(
            'ESA WorldCover 10 m v200 (2021)',
            'CC BY 4.0',
            'ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
            'https://esa-worldcover.org',
          ),
          visible: false,
        },
      ],
      notes: [
        `WorldCover : ${Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, n]) => `${WORLDCOVER_CLASSES[Number(k)].label} ${((n / tot) * 100).toFixed(0)} %`)
          .join(', ')}`,
      ],
    };
  },
};

// ---------------------------------------------------------------- JRC Global Surface Water
export const waterCollector: Collector = {
  id: 'gsw',
  label: 'Eau de surface (JRC Global Surface Water)',
  description: 'Occurrence de l’eau 1984-2021 et changements : zones inondables',
  defaultOn: true,
  async run(ctx) {
    // test de disponibilité d'une tuile de la zone
    const z = 12;
    const [lon, lat] = ctx.site.center;
    const x = Math.floor(((lon + 180) / 360) * 2 ** z);
    const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
    const r = await fetchWithTimeout(`https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/${z}/${x}/${y}.png`, { timeout: 15000 });
    if (!r.ok && r.status !== 404) throw new Error(`tuiles GSW : HTTP ${r.status}`);
    // part d'eau (occurrence > 50 %) à partir du GeoTIFF, lu partiellement
    let note = '';
    try {
      const lo = Math.floor(lon / 10) * 10;
      const la = Math.ceil(lat / 10) * 10;
      const name = `occurrence_${Math.abs(lo)}${lo < 0 ? 'W' : 'E'}_${Math.abs(la)}${la < 0 ? 'S' : 'N'}v1_4_2021.tif`;
      const g = await readWindow(`https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/${name}`, ctx.bbox, 2.5e7);
      let wet = 0;
      let seen = 0;
      for (const v of g.data) {
        if (v > 100) continue;
        seen++;
        if (v >= 50) wet++;
      }
      note = `Eau de surface (présente plus de la moitié du temps) : ${((wet / Math.max(1, seen)) * 100).toFixed(1)} % de l’emprise`;
    } catch (e: any) {
      note = `Statistiques GSW non calculées : ${e.message}`;
    }
    const s = () => src('JRC Global Surface Water v1.4 (1984-2021)', 'CC BY 4.0', 'Eau : EC JRC/Google, Global Surface Water (Pekel et al., 2016, Nature 540)', 'https://global-surface-water.appspot.com');
    return {
      layers: [
        {
          id: 'gsw-occurrence',
          name: 'Occurrence de l’eau 1984-2021 (JRC)',
          role: 'raster',
          geom: 'mixed',
          raster: { type: 'tiles', url: '/api/tiles/gsw-occurrence/{z}/{x}/{y}.png', maxzoom: 13, legend: [{ color: '#ffb0b0', label: 'Eau rare' }, { color: '#8080ff', label: 'Eau fréquente' }, { color: '#0000ff', label: 'Eau permanente' }] },
          source: s(),
          visible: false,
        },
        {
          id: 'gsw-change',
          name: 'Changement de l’eau (JRC)',
          role: 'raster',
          geom: 'mixed',
          raster: { type: 'tiles', url: '/api/tiles/gsw-change/{z}/{x}/{y}.png', maxzoom: 13, legend: [{ color: '#ff0000', label: 'Perte d’eau' }, { color: '#000000', label: 'Sans changement' }, { color: '#00ff00', label: 'Gain d’eau' }] },
          source: s(),
          visible: false,
        },
      ],
      notes: [note],
    };
  },
};

// ---------------------------------------------------------------- Sentinel-2
export interface S2Item {
  id: string;
  date: string;
  cloud: number;
  covers: boolean;
}

export async function searchSentinel(bbox: number[], months = 12, maxCloud = 20): Promise<S2Item[]> {
  const end = new Date();
  const start = new Date(end.getTime() - months * 30.5 * 86400e3);
  const r = await fetchWithTimeout('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
    method: 'POST',
    timeout: 30000,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox,
      datetime: `${start.toISOString().slice(0, 19)}Z/${end.toISOString().slice(0, 19)}Z`,
      query: { 'eo:cloud_cover': { lt: maxCloud } },
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      limit: 100,
    }),
  });
  if (!r.ok) throw new Error(`STAC Planetary Computer : HTTP ${r.status}`);
  const j = await r.json();
  const site = turf.bboxPolygon(bbox as any);
  return (j.features || []).map((f: any) => {
    let covers = false;
    try {
      covers = turf.booleanContains(f.geometry, site);
    } catch {
      covers = false;
    }
    return { id: f.id, date: String(f.properties.datetime).slice(0, 10), cloud: Math.round(Number(f.properties['eo:cloud_cover']) * 10) / 10, covers };
  });
}

export async function renderSentinel(slug: string, item: S2Item, bbox: [number, number, number, number]) {
  const wM = turf.distance([bbox[0], (bbox[1] + bbox[3]) / 2], [bbox[2], (bbox[1] + bbox[3]) / 2], { units: 'meters' });
  const hM = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });
  // 4 m par pixel (Sentinel-2 est à 10 m : léger suréchantillonnage, plus doux à l'écran)
  const k = Math.min(2048 / Math.max(wM, hM), 1 / 4);
  const W = Math.max(256, Math.round(wM * k));
  const H = Math.max(256, Math.round(hM * k));
  const url = `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${bbox.map((v) => v.toFixed(6)).join(',')}/${W}x${H}.png?collection=sentinel-2-l2a&item=${encodeURIComponent(item.id)}&assets=visual&asset_bidx=${encodeURIComponent('visual|1,2,3')}&nodata=0&resampling=bilinear`;
  const r = await fetchWithTimeout(url, { timeout: 90000 });
  if (!r.ok) throw new Error(`rendu Sentinel-2 : HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const rel = `files/sentinel2-${item.date}.png`;
  await writeAtomic(siteFile(slug, rel), buf);
  return rel;
}

export function sentinelLayer(item: S2Item, rel: string, bbox: [number, number, number, number], visible: boolean) {
  return {
    id: `s2-${item.date.replace(/-/g, '')}`,
    name: `Sentinel-2 du ${new Date(item.date).toLocaleDateString('fr-FR')} (${item.cloud} % nuages)`,
    role: 'raster' as const,
    geom: 'mixed' as const,
    raster: { type: 'image' as const, url: rel, bounds: bbox, date: item.date },
    source: src(
      `Sentinel-2 L2A — ${item.id}`,
      'Données Copernicus Sentinel (libres, attribution)',
      `Contient des données Copernicus Sentinel modifiées ${item.date.slice(0, 4)}, traitées via Microsoft Planetary Computer`,
      'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a',
    ),
    visible,
  };
}

export const sentinelCollector: Collector = {
  id: 'sentinel2',
  label: 'Imagerie Sentinel-2',
  description: 'Image récente et peu nuageuse du site (10 m), via le Planetary Computer',
  defaultOn: true,
  async run(ctx) {
    const items = await searchSentinel(ctx.bbox, 6, 10);
    let pick = items.find((i) => i.covers && i.cloud < 5) || items.find((i) => i.covers) || items[0];
    if (!pick) {
      const more = await searchSentinel(ctx.bbox, 18, 30);
      pick = more.find((i) => i.covers) || more[0];
    }
    if (!pick) throw new Error('aucune image Sentinel-2 peu nuageuse trouvée');
    ctx.log(`Sentinel-2 : rendu de l’image du ${pick.date}`);
    const rel = await renderSentinel(ctx.slug, pick, ctx.bbox);
    return { layers: [sentinelLayer(pick, rel, ctx.bbox, false)], notes: [`Sentinel-2 : image du ${pick.date} (${pick.cloud} % de nuages sur la tuile)`] };
  },
};

