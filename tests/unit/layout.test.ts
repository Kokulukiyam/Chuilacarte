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
    expect(svg).toContain('Sources :');
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
