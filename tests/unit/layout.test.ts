import { describe, expect, it } from 'vitest';
import { makeProjector, fitScale, zoomForScale } from '@/lib/layout/geo';
import { niceScaleLength, renderLayoutSvg } from '@/lib/layout/svg';
import { createSiteObject, perimeterLayers } from '@/lib/site';
import { newLayout } from '@/lib/layout/defaults';
import { fromUtm, toUtm } from '@/lib/proj';

const emprise = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-17.4475, 14.6745], [-17.4445, 14.6745], [-17.4445, 14.677], [-17.4475, 14.677], [-17.4475, 14.6745]]] } }] } as any;

describe('mise en page', () => {
  const site = createSiteObject('Test', 'test', emprise, 300);
  const { layers, data } = perimeterLayers(site);
  site.layers = layers;
  it('respecte l’échelle annoncée (100 m terrain = 100 000 / échelle mm)', () => {
    for (const scale of [500, 1000, 2000, 5000, 10000, 25000]) {
      const l = newLayout(site, { scale });
      const pr = makeProjector(l);
      const o = toUtm(site.utm, site.center);
      // est-ouest et nord-sud : 100 m terrain (UTM, facteur d'échelle local ≈ 0,9997 à Dakar)
      for (const [dx, dy] of [[100, 0], [0, 100]]) {
        const a = fromUtm(site.utm, [o[0] - dx / 2, o[1] - dy / 2]);
        const b = fromUtm(site.utm, [o[0] + dx / 2, o[1] + dy / 2]);
        const pa = pr.project(a[0], a[1]);
        const pb = pr.project(b[0], b[1]);
        const mm = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        // 100 m en UTM = 100 / k m terrain, k = facteur d’échelle UTM local (≈ 1,00046 à 236 km du méridien central) ; tolérance 0,03 %
        const k = 0.9996 * (1 + (o[0] - 500000) ** 2 / (2 * 6378137 ** 2));
        const expected = 100000 / k / scale;
        expect(Math.abs(mm / expected - 1)).toBeLessThan(0.0003);
      }
    }
  });
  it('barre d’échelle ronde et exacte', () => {
    expect(niceScaleLength(1000, 60)).toBe(50);
    expect(niceScaleLength(5000, 60)).toBe(200);
    expect(niceScaleLength(25000, 60)).toBe(1000);
    const l = newLayout(site, { scale: 2000 });
    const { svg } = renderLayoutSvg({ layout: l, site, data });
    const m = svg.match(/data-longueur-m="(\d+)" data-longueur-mm="([\d.]+)"/)!;
    expect(Number(m[2])).toBeCloseTo((Number(m[1]) * 1000) / 2000, 2);
  });
  it('choisit une échelle qui fait tenir le site', () => {
    const l = newLayout(site);
    expect([2500, 5000]).toContain(fitScale(l, [-17.4505, 14.6718, -17.4415, 14.6797]));
  });
  it('produit un SVG avec flèche du nord, légende, cartouche et attributions', () => {
    const l = newLayout(site, { scale: 2000 });
    const { svg, attributions } = renderLayoutSvg({ layout: l, site, data });
    expect(svg).toContain('id="fleche-nord"');
    expect(svg).toContain('id="legende"');
    expect(svg).toContain('id="cartouche"');
    // sources dans le cartouche ; sans cartouche, elles sont écrites dans le cadre de carte
    expect(svg).toMatch(/Sources[\s\u00a0]:/);
    expect(attributions.length).toBeGreaterThan(0);
    const sans = renderLayoutSvg({ layout: { ...l, elements: l.elements.filter((e) => e.type !== 'cartouche') }, site, data }).svg;
    expect(sans).toContain('id="attribution"');
    expect(svg).not.toContain('paint-order');
  });
  it('zoom MapLibre cohérent avec l’échelle', () => {

    expect(zoomForScale(1000, 0)).toBeGreaterThan(18.1); // monde de 512 px au zoom 0 : log2(78 271,5 / 0,2646) ≈ 18,17
    expect(zoomForScale(1000, 0)).toBeLessThan(18.25);
  });
});

describe('mise en page : 2e contrôle cartographique', () => {
  const site = createSiteObject('Test', 'test', emprise, 300);
  it('le sous-titre suit l’échelle choisie, sauf s’il a été personnalisé', async () => {
    const { applyScale } = await import('@/lib/layout/defaults');
    const l = newLayout(site, { scale: 5000 });
    const sub = () => l.elements.find((e) => e.type === 'subtitle')!.props.text;
    expect(sub()).toBe('Plan de quartier');
    applyScale(l, 1000);
    expect(sub()).toBe('Plan masse');
    l.elements.find((e) => e.type === 'subtitle')!.props.text = 'Mon sous-titre';
    applyScale(l, 2500);
    expect(sub()).toBe('Mon sous-titre');
  });
  it('les valeurs hors classes ont une entrée « Autres » en légende', async () => {
    const { buildLegend } = await import('@/lib/layout/legend');
    const { makeLayer } = await import('@/lib/site');
    const l = makeLayer({ id: 'occ', name: 'Occupation du sol', role: 'landuse', geom: 'polygon' } as any);
    l.style = { ...l.style, mode: 'categorized', categorized: { field: 'classe', classes: [{ value: 'habitat', color: '#f00', label: 'Habitat' }], other: '#e7e5e4' } };
    const sq = (v: string) => ({ type: 'Feature', properties: { classe: v }, geometry: emprise.features[0].geometry });
    const s2 = { ...site, layers: [l] };
    const g = buildLegend(s2 as any, { occ: { type: 'FeatureCollection', features: [sq('habitat'), sq('stadium')] } as any });
    expect(g[0].items.map((i) => i.label)).toEqual(['Habitat', 'Autres']);
    const g2 = buildLegend(s2 as any, { occ: { type: 'FeatureCollection', features: [sq('habitat')] } as any });
    expect(g2[0].items.map((i) => i.label)).toEqual(['Habitat']);
  });
  it('la légende A4 ne descend pas sous 6 pt', () => {
    const l = newLayout(site, { format: 'A4', scale: 10000 });
    const leg = l.elements.find((e) => e.type === 'legend')!;
    expect(leg.props.size * 0.3528).toBeGreaterThanOrEqual(6 * 0.3528 - 1e-9);
  });
});

describe('légende : groupes et dernier recours', () => {
  const site = createSiteObject('Test', 'test', emprise, 300);
  it('ne tronque pas une longue légende en A4 et ne laisse pas un titre seul en bas de colonne', async () => {
    const { makeLayer } = await import('@/lib/site');
    const { perimeterLayers } = await import('@/lib/site');
    const { layers, data } = perimeterLayers(site);
    const cls = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, color: '#888', label: `Classe numéro ${i}` }));
    const many = [0, 1].map((k) => {
      const l = makeLayer({ id: `c${k}`, name: `Couche ${k}`, role: 'landuse', geom: 'polygon' } as any);
      l.style = { ...l.style, mode: 'categorized', categorized: { field: 'classe', classes: cls, other: '#eee' } };
      data[l.id] = { type: 'FeatureCollection', features: cls.map((c) => ({ type: 'Feature', properties: { classe: c.value }, geometry: emprise.features[0].geometry })) } as any;
      return l;
    });
    const s2 = { ...site, layers: [...layers, ...many] };
    const l = newLayout(s2 as any, { format: 'A4', scale: 10000 });
    const r = renderLayoutSvg({ layout: l, site: s2 as any, data } as any);
    expect(r.legendOverflow).toBe(false);
    for (const c of cls) expect(r.svg).toContain(c.label);
  });
});

describe('fond : taille des étiquettes selon le format', () => {
  it('multiplie nombres, paliers et interpolations sur le zoom', async () => {
    const { scaleTextSize } = await import('@/lib/layout/basemap');
    expect(scaleTextSize(10, 2)).toBe(20);
    expect(scaleTextSize(['interpolate', ['linear'], ['zoom'], 10, 8, 16, 14], 2)).toEqual(['interpolate', ['linear'], ['zoom'], 10, 16, 16, 28]);
    expect(scaleTextSize(['step', ['zoom'], 9, 14, 11], 2)).toEqual(['step', ['zoom'], 18, 14, 22]);
    expect(scaleTextSize({ stops: [[10, 8], [16, 12]] }, 1.5)).toEqual({ stops: [[10, 12], [16, 18]] });
    expect(scaleTextSize(['get', 'taille'], 2)).toEqual(['*', ['get', 'taille'], 2]);
  });
});

describe('légende : ce qui est dans le cadre', () => {
  it('compte un grand polygone rempli qui englobe le cadre, et seulement les catégories visibles', async () => {
    const { buildLegend } = await import('@/lib/layout/legend');
    const { makeLayer } = await import('@/lib/site');
    const site = createSiteObject('Test', 'test', emprise, 300);
    const l = makeLayer({ id: 'occ', name: 'Occupation du sol', role: 'landuse', geom: 'polygon' } as any);
    l.style = { ...l.style, fillOpacity: 0.7, mode: 'categorized', categorized: { field: 'type', classes: [{ value: 'residential', color: '#f00', label: 'Habitat' }, { value: 'cemetery', color: '#0f0', label: 'Cimetière' }], other: '#eee' } };
    const big = { type: 'Feature', properties: { type: 'residential' }, geometry: { type: 'Polygon', coordinates: [[[-18, 14], [-17, 14], [-17, 15], [-18, 15], [-18, 14]]] } };
    const far = { type: 'Feature', properties: { type: 'cemetery' }, geometry: { type: 'Polygon', coordinates: [[[-16, 13], [-15.9, 13], [-15.9, 13.1], [-16, 13]]] } };
    const g = buildLegend({ ...site, layers: [l] } as any, { occ: { type: 'FeatureCollection', features: [big, far] } as any }, { bbox: [-17.45, 14.67, -17.44, 14.68] });
    expect(g[0].items.map((i) => i.label)).toEqual(['Habitat']);
  });
});

describe('encart de situation', () => {
  it('n’utilise pas de clipPath (resvg plante sur un groupe masqué hors de la bande rendue en PNG)', () => {
    const site = createSiteObject('Test', 'test', emprise, 300);
    const sq = (x0: number, y0: number, x1: number, y1: number, p: any = {}) => ({ type: 'Feature', properties: p, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } });
    const inset = { name: 'Sénégal', country: { type: 'FeatureCollection', features: [sq(-17.5, 12.3, -11.4, 16.7)] }, neighbours: { type: 'FeatureCollection', features: [sq(-17, 16.7, -5, 27, { nom: 'Mauritanie' })] } };
    const l = newLayout(site, { scale: 2000 });
    const r = renderLayoutSvg({ layout: l, site, data: {}, inset } as any);
    const enc = r.svg.slice(r.svg.indexOf('<g id="encart">'));
    expect(enc).toContain('MAURITANIE');
    expect(enc.slice(0, enc.indexOf('</g>'))).not.toContain('clip-path');
  });
});
