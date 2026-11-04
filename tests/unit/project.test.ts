import { describe, expect, it } from 'vitest';
import { helmert, placeLocal, unplaceLocal, imageCorners } from '@/lib/placement';
import { sunAt, shadowOf } from '@/lib/shadows';
import { toUtm, fromUtm, utmForLonLat, metricDistance } from '@/lib/proj';

const u = utmForLonLat(-17.45, 14.68);

describe('calage', () => {
  it('similitude : aller-retour local ↔ carte', () => {
    const p = { anchor: [-17.45, 14.68] as [number, number], rotation: 30, scale: 1, units: 'm' as const };
    const ll = placeLocal(u, p, 12, -7);
    const back = unplaceLocal(u, p, ll[0], ll[1]);
    expect(back[0]).toBeCloseTo(12, 6);
    expect(back[1]).toBeCloseTo(-7, 6);
    // distance conservée (échelle 1)
    expect(metricDistance(u, placeLocal(u, p, 0, 0), placeLocal(u, p, 20, 0))).toBeCloseTo(20, 2);
  });
  it('Helmert retrouve rotation, échelle et translation', () => {
    const o = toUtm(u, [-17.45, 14.68]);
    const th = (25 * Math.PI) / 180;
    const s = 0.01; // plan en cm
    const locals: [number, number][] = [[0, 0], [2400, 0], [2400, 1600], [0, 1600]];
    const pairs = locals.map((l) => ({ local: l, utm: [o[0] + s * (l[0] * Math.cos(th) - l[1] * Math.sin(th)), o[1] + s * (l[0] * Math.sin(th) + l[1] * Math.cos(th))] as [number, number] }));
    const h = helmert(pairs.slice(0, 2));
    expect(h.rotation).toBeCloseTo(25, 6);
    expect(h.scale).toBeCloseTo(0.01, 9);
    expect(h.origin[0]).toBeCloseTo(o[0], 4);
    const h3 = helmert(pairs);
    expect(h3.rms).toBeLessThan(1e-6);
  });
  it('coins d’une image calée', () => {
    const p = { anchor: [-17.45, 14.68] as [number, number], rotation: 0, scale: 0.1, units: 'px' as const, imageSize: [1000, 500] as [number, number] };
    const c = imageCorners(u, p);
    expect(metricDistance(u, c[0], c[1])).toBeCloseTo(100, 1); // 1000 px × 0,1 m
    expect(metricDistance(u, c[1], c[2])).toBeCloseTo(50, 1);
  });
});

describe('ombres', () => {
  it('soleil à Dakar le 21 juin à 12 h 30 UTC : haut, ombre courte', () => {
    const s = sunAt(new Date(Date.UTC(2026, 5, 21, 12, 30)), -17.45, 14.68);
    expect(s.altitude).toBeGreaterThan(75);
    expect(s.shadowFactor).toBeLessThan(0.3);
  });
  it('soleil le 21 décembre à 9 h UTC : bas à l’est-sud-est, ombre vers l’ouest-nord-ouest', () => {
    const s = sunAt(new Date(Date.UTC(2026, 11, 21, 9, 0)), -17.45, 14.68);
    expect(s.altitude).toBeGreaterThan(5);
    expect(s.altitude).toBeLessThan(30);
    expect(s.azimuth).toBeGreaterThan(110);
    expect(s.azimuth).toBeLessThan(150);
  });
  it('longueur d’ombre = h / tan(altitude)', () => {
    const o = toUtm(u, [-17.45, 14.68]);
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]].map((p) => fromUtm(u, [o[0] + p[0], o[1] + p[1]]));
    const sun = { altitude: 45, azimuth: 180, shadowFactor: 1 };
    const sh = shadowOf(u, { type: 'Feature', geometry: { type: 'Polygon', coordinates: [sq] }, properties: {} }, 12, sun)!;
    expect(sh.properties!.longueur_ombre_m).toBeCloseTo(12, 5);
    // soleil plein sud → ombre vers le nord : l'ombre s'étend à y = 10 + 12
    const ys = (sh.geometry as any).coordinates[0].map((c: number[]) => toUtm(u, c)[1] - o[1]);
    expect(Math.max(...ys)).toBeCloseTo(22, 1);
  });
});
