import { describe, expect, it } from 'vitest';
import { relativeDate } from '@/components/ui/hooks';
import { roundScale, screenScale } from '@/lib/mapview';
import { TOOL_HINTS, ALL_TOOLS, TOOL_LABELS } from '@/components/toolbarTools';
import { TOOL_KEYS } from '@/lib/shortcuts';
import { zoomForScale } from '@/lib/layout/geo';

describe('interface', () => {
  it('écrit les dates relatives en français', () => {
    const now = new Date(2026, 10, 14, 9, 0);
    expect(relativeDate(new Date(2026, 10, 14, 0, 30).toISOString(), now)).toBe('aujourd’hui');
    expect(relativeDate(new Date(2026, 10, 13, 23, 50).toISOString(), now)).toBe('hier');
    expect(relativeDate(new Date(2026, 10, 11, 12, 0).toISOString(), now)).toBe('il y a 3 jours');
    expect(relativeDate(new Date(2026, 9, 2, 12, 0).toISOString(), now)).toMatch(/^le 2 oct/);
    expect(relativeDate(new Date(2025, 9, 2, 12, 0).toISOString(), now)).toMatch(/2025$/);
    expect(relativeDate('pas une date', now)).toBe('');
  });
  it('échelle approchée de la carte à l’écran : cohérente avec le zoom des mises en page', () => {
    // zoomForScale(1000, lat) est le zoom auquel la carte est au 1/1 000 à 96 dpi
    for (const lat of [0, 14.7, 45]) expect(Math.abs(screenScale(zoomForScale(1000, lat), lat) / 1000 - 1)).toBeLessThan(0.01);
    expect(roundScale(4387)).toBe(4400);
    expect(roundScale(24910)).toBe(25000);
    expect(roundScale(873)).toBe(870);
    expect(roundScale(NaN)).toBe(0);
  });
  it('chaque outil de la barre a un libellé, un mode d’emploi et un raccourci unique', () => {
    const keys = new Set<string>();
    for (const t of ALL_TOOLS) {
      expect(TOOL_LABELS[t.tool], t.tool).toBeTruthy();
      expect(TOOL_HINTS[t.tool], t.tool).toBeTruthy();
      expect(t.k && TOOL_KEYS[t.k], t.tool).toBe(t.tool);
      expect(keys.has(t.k!)).toBe(false);
      keys.add(t.k!);
    }
  });
});
