import { describe, expect, it } from 'vitest';
import { matchAll } from '@/lib/filters';

describe('filtres attributaires', () => {
  it('compare nombres et textes', () => {
    const p = { niveaux: '4', famille: 'santé', nom: 'Hôpital Principal' };
    expect(matchAll(p, [{ field: 'niveaux', op: '>', value: '3' }])).toBe(true);
    expect(matchAll(p, [{ field: 'niveaux', op: '>', value: '4' }])).toBe(false);
    expect(matchAll(p, [{ field: 'famille', op: '=', value: 'santé' }, { field: 'nom', op: 'contains', value: 'hôpital' }])).toBe(true);
    expect(matchAll({}, [{ field: 'niveaux', op: '>', value: '1' }])).toBe(false);
    expect(matchAll({ a: 1 }, [{ field: 'a', op: 'exists', value: '' }])).toBe(true);
  });
});
