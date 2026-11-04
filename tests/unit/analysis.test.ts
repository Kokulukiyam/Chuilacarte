import { describe, expect, it } from 'vitest';
import { synthesis, densityGrid } from '@/lib/analysis';
import { createSiteObject } from '@/lib/site';
import { fromUtm, toUtm } from '@/lib/proj';
import { makeLayer } from '@/lib/site';

// zone carrée de 200 m × 200 m construite en UTM, avec des bâtiments de surface connue
const base = createSiteObject('T', 't', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-17.45, 14.67], [-17.44, 14.67], [-17.44, 14.68], [-17.45, 14.68], [-17.45, 14.67]]] } }] } as any, 0);
const u = base.utm;
const o = toUtm(u, [-17.445, 14.675]);
const sq = (x: number, y: number, w: number, h: number) => ({ type: 'Polygon' as const, coordinates: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map((p) => fromUtm(u, [o[0] + p[0], o[1] + p[1]]))] });

describe('synthèse urbaine', () => {
  const site = { ...base, emprise: { type: 'Feature' as const, properties: {}, geometry: sq(0, 0, 200, 200) } };
  const bat = makeLayer({ name: 'Bâti', role: 'buildings', geom: 'polygon' });
  const rd = makeLayer({ name: 'Voirie', role: 'roads', geom: 'line' });
  const eq = makeLayer({ name: 'Équipements', role: 'amenities', geom: 'point' });
  const pop = makeLayer({ name: 'Pop', role: 'population', geom: 'polygon' });
  site.layers = [bat, rd, eq, pop];
  const line = (pts: number[][]) => ({ type: 'LineString' as const, coordinates: pts.map((p) => fromUtm(u, [o[0] + p[0], o[1] + p[1]])) });
  const data: any = {
    [bat.id]: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: sq(10, 10, 20, 10), properties: { niveaux: 3 } }, // 200 m², R+2
      { type: 'Feature', geometry: sq(50, 50, 10, 10), properties: {} }, // 100 m²
      { type: 'Feature', geometry: sq(190, 100, 20, 10), properties: { niveaux: 2 } }, // moitié dedans : 100 m²
      { type: 'Feature', geometry: sq(400, 400, 10, 10), properties: {} }, // dehors
    ] },
    [rd.id]: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: line([[-100, 100], [300, 100]]), properties: { classe: 'primaire' } }, // 200 m dedans
      { type: 'Feature', geometry: line([[100, 0], [100, 50]]), properties: { classe: 'desserte' } }, // 50 m
    ] },
    [eq.id]: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: fromUtm(u, [o[0] + 100, o[1] + 100]) }, properties: { famille: 'santé' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: fromUtm(u, [o[0] + 100, o[1] + 400]) }, properties: { famille: 'enseignement' } },
    ] },
    [pop.id]: { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: sq(0, 0, 100, 100), properties: { population: 100 } },
      { type: 'Feature', geometry: sq(150, 0, 100, 100), properties: { population: 100 } }, // moitié dedans → 50
    ] },
  };
  const s = synthesis(site as any, data, { id: 'z', name: 'Zone', feature: site.emprise as any }, { defaultLevels: 1 });
  it('surfaces', () => {
    expect(s.surface_m2).toBeCloseTo(40000, -1);
    expect(s.nb_batiments).toBe(3);
    expect(s.surface_batie_m2).toBeCloseTo(400, 0);
    expect(s.emprise_sol).toBeCloseTo(0.01, 3);
  });
  it('plancher', () => {
    expect(s.plancher_renseigne_m2).toBeCloseTo(200 * 3 + 100 * 2, 0);
    expect(s.plancher_estime_m2).toBeCloseTo(200 * 3 + 100 * 2 + 100, 0);
  });
  it('voirie', () => {
    expect(s.voirie_m.primaire).toBeGreaterThan(198);
    expect(s.voirie_m.primaire).toBeLessThan(202);
    expect(s.voirie_m.desserte).toBeCloseTo(50, 0);
  });
  it('équipements et distances', () => {
    expect(s.equipements['santé']).toBe(1);
    expect(s.equipements_total).toBe(1);
    expect(s.distance_equipement_m['enseignement']!).toBeGreaterThan(299);
    expect(s.distance_equipement_m['enseignement']!).toBeLessThan(301);
  });
  it('population', () => {
    expect(s.population!).toBeCloseTo(150, 0);
    expect(s.densite_hab_ha!).toBeCloseTo(37.5, 0);
  });
  it('grille de densité', () => {
    const g = densityGrid(site as any, data[eq.id].features, 50, site.emprise as any);
    expect(g.features.reduce((a: number, f: any) => a + f.properties.nombre, 0)).toBe(1);
  });
});
