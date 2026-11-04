import { describe, expect, it } from 'vitest';
import { metricArea, metricDistance, metricLength, toUtm, fromUtm, utmForLonLat } from '@/lib/proj';

describe('projection UTM', () => {
  it('choisit la zone 28N pour Dakar et Fatick', () => {
    expect(utmForLonLat(-17.44, 14.69)).toEqual({ zone: 28, south: false, epsg: 32628 });
    expect(utmForLonLat(-16.41, 14.34).epsg).toBe(32628);
    expect(utmForLonLat(-11.9, 12.5).epsg).toBe(32629);
  });
  it('aller-retour WGS84 ↔ UTM', () => {
    const u = utmForLonLat(-17.44, 14.69);
    const p = toUtm(u, [-17.44, 14.69]);
    expect(p[0]).toBeGreaterThan(200000);
    expect(p[0]).toBeLessThan(400000);
    expect(p[1]).toBeGreaterThan(1600000);
    const back = fromUtm(u, p);
    expect(back[0]).toBeCloseTo(-17.44, 7);
    expect(back[1]).toBeCloseTo(14.69, 7);
  });
  it('mesure surfaces et distances', () => {
    const u = utmForLonLat(-17.44, 14.69);
    // carré de 100 m x 100 m construit en UTM
    const o = toUtm(u, [-17.44, 14.69]);
    const ring = [o, [o[0] + 100, o[1]], [o[0] + 100, o[1] + 100], [o[0], o[1] + 100], o].map((p) => fromUtm(u, p));
    expect(metricArea(u, { type: 'Polygon', coordinates: [ring] })).toBeCloseTo(10000, 1);
    expect(metricLength(u, { type: 'Polygon', coordinates: [ring] })).toBeCloseTo(400, 2);
    // 1/1000 de degré de latitude ≈ 110,6 m à 14,7° N (géodésique), facteur d'échelle UTM ≈ 1,0002 ici
    const d = metricDistance(u, [-17.44, 14.69], [-17.44, 14.691]);
    expect(d).toBeGreaterThan(110.4);
    expect(d).toBeLessThan(110.9);
  });
});
