import { describe, expect, it } from 'vitest';
import { writeDxf } from '@/lib/dxf-write';
import { readDxf, guessDxfCrs } from '@/lib/dxf-read';

describe('DXF', () => {
  it('aller-retour écriture / lecture', () => {
    const txt = writeDxf([
      { layer: 'Bâti', geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]] } },
      { layer: 'Voirie', geometry: { type: 'LineString', coordinates: [[0, 0], [50, 20]] } },
      { layer: 'Texte', geometry: { type: 'Point', coordinates: [1, 1] }, text: 'Bonjour' },
    ]);
    const r = readDxf(txt);
    expect(r.units).toBe('m');
    expect(r.layers.sort()).toEqual(['Bati', 'Texte', 'Voirie']);
    const poly = r.fc.features.find((f) => f.geometry.type === 'Polygon')!;
    expect((poly.geometry as any).coordinates[0]).toHaveLength(5);
    const t = r.fc.features.find((f) => f.properties?.texte);
    expect(t?.properties?.texte).toBe('Bonjour');
    expect(r.bbox).toEqual([0, 0, 50, 20]);
  });
  it('devine le système de coordonnées', () => {
    expect(guessDxfCrs([-17.45, 14.67, -17.44, 14.68])).toBe('wgs84');
    expect(guessDxfCrs([235000, 1623000, 236000, 1624000])).toBe('utm');
    expect(guessDxfCrs([0, 0, 30, 20])).toBe('local');
  });
});
