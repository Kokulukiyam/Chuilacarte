import 'server-only';
import { query, sqlStr } from '../duckdb';
import { fetchWithTimeout, nominatimSlot } from '../http';
import { fc, src, type CollectCtx, type Collector } from './types';

const ISO3: Record<string, string> = {
  sn: 'SEN', gm: 'GMB', ml: 'MLI', mr: 'MRT', gn: 'GIN', gw: 'GNB', ci: 'CIV', bf: 'BFA', ne: 'NER', tg: 'TGO', bj: 'BEN', gh: 'GHA', ng: 'NGA', sl: 'SLE', lr: 'LBR', cv: 'CPV', ma: 'MAR', cm: 'CMR', td: 'TCD',
};

const countryCache = new Map<string, Promise<string>>();

export function countryIso3(lon: number, lat: number): Promise<string> {
  const key = `${lon.toFixed(2)},${lat.toFixed(2)}`;
  let p = countryCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        await nominatimSlot();
        const r = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=${lat}&lon=${lon}`, { timeout: 10000 });
        if (r.ok) {
          const j = await r.json();
          const cc = j.address?.country_code;
          if (cc && ISO3[cc]) return ISO3[cc];
        }
      } catch {
        /* repli */
      }
      return 'SEN';
    })();
    countryCache.set(key, p);
  }
  return p;
}

export const openBuildingsCollector: Collector = {
  id: 'openbuildings',
  label: 'Google Open Buildings',
  description: 'Empreintes de bâtiments détectées par satellite (v3), avec indice de confiance',
  defaultOn: true,
  async run(ctx: CollectCtx) {
    const b = ctx.bbox;
    const iso = await countryIso3(ctx.site.center[0], ctx.site.center[1]);
    const url = `https://data.source.coop/vida/google-microsoft-open-buildings/geoparquet/by_country/country_iso=${iso}/${iso}.parquet`;
    ctx.log(`Open Buildings : lecture partielle du fichier ${iso} (VIDA / Source Cooperative)`);
    const rows = await query<any>(
      `SELECT bf_source, confidence, area_in_meters, ST_AsGeoJSON(geometry) AS __g FROM read_parquet(${sqlStr(url)})
       WHERE bbox.xmin < ${b[2]} AND bbox.xmax > ${b[0]} AND bbox.ymin < ${b[3]} AND bbox.ymax > ${b[1]}
         AND bf_source = 'google'
         AND ST_Intersects(geometry, ST_GeomFromGeoJSON(${sqlStr(JSON.stringify(ctx.area.geometry))}))`,
    );
    const features = rows.map((r) => ({
      type: 'Feature',
      geometry: JSON.parse(r.__g),
      properties: {
        source: 'Google Open Buildings v3',
        confiance: r.confidence !== null ? Math.round(Number(r.confidence) * 1000) / 1000 : undefined,
        surface_m2: r.area_in_meters !== null ? Math.round(Number(r.area_in_meters) * 10) / 10 : undefined,
      },
    }));
    return {
      layers: [
        {
          id: 'gob-batiments',
          name: 'Bâtiments détectés (Google Open Buildings)',
          role: 'buildings',
          geom: 'polygon',
          fc: fc(features),
          source: src(
            'Google Open Buildings v3 (via VIDA / Source Cooperative)',
            'CC BY 4.0 ou ODbL 1.0',
            'Google Open Buildings v3 (CC BY 4.0) ; compilation VIDA via Source Cooperative',
            'https://sites.research.google/open-buildings/',
          ),
          stylePreset: 'bati',
          visible: true,
        },
      ],
      notes: [`${features.length} empreintes Google Open Buildings`],
    };
  },
};
