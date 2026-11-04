import type { GeomKind, LayerRole, LayerStyle } from './types';

export function baseStyle(over: Partial<LayerStyle> = {}): LayerStyle {
  return {
    fill: '#9ca3af',
    fillOpacity: 0.6,
    stroke: '#374151',
    strokeWidth: 1,
    strokeOpacity: 1,
    dash: 'solid',
    hatch: 'none',
    hatchColor: '#374151',
    pointSize: 6,
    pointShape: 'circle',
    label: null,
    mode: 'simple',
    ...over,
  };
}

/** Familles d'équipements : couleurs cohérentes, inspirées des conventions des plans d'urbanisme. */
export const AMENITY_FAMILIES: { value: string; label: string; color: string }[] = [
  { value: 'enseignement', label: 'Enseignement', color: '#c2410c' },
  { value: 'santé', label: 'Santé', color: '#b91c1c' },
  { value: 'culte', label: 'Culte', color: '#6d28d9' },
  { value: 'commerce', label: 'Commerce et marchés', color: '#ca8a04' },
  { value: 'administration', label: 'Administration', color: '#1d4ed8' },
  { value: 'transport', label: 'Transport', color: '#0f766e' },
  { value: 'sport-loisirs', label: 'Sport et loisirs', color: '#15803d' },
  { value: 'autre', label: 'Autres', color: '#6b7280' },
];

export const ROAD_CLASSES: { value: string; label: string; color: string; width: number }[] = [
  { value: 'primaire', label: 'Voie primaire', color: '#1f2937', width: 3.2 },
  { value: 'secondaire', label: 'Voie secondaire', color: '#374151', width: 2.4 },
  { value: 'tertiaire', label: 'Voie tertiaire', color: '#4b5563', width: 1.8 },
  { value: 'desserte', label: 'Voie de desserte', color: '#6b7280', width: 1.1 },
  { value: 'piéton', label: 'Chemin piéton', color: '#9ca3af', width: 0.7 },
  { value: 'autre', label: 'Autre voie', color: '#9ca3af', width: 0.6 },
];

export interface StylePreset {
  id: string;
  name: string;
  geom: GeomKind | 'any';
  style: LayerStyle;
}

export const PRESETS: StylePreset[] = [
  { id: 'bati', name: 'Bâti (gris foncé)', geom: 'polygon', style: baseStyle({ fill: '#3f3f46', fillOpacity: 0.9, stroke: '#27272a', strokeWidth: 0.4, preset: 'bati' }) },
  { id: 'bati-clair', name: 'Bâti (gris clair)', geom: 'polygon', style: baseStyle({ fill: '#a1a1aa', fillOpacity: 0.85, stroke: '#71717a', strokeWidth: 0.4, preset: 'bati-clair' }) },
  { id: 'bati-noir', name: 'Bâti (noir, plan masse)', geom: 'polygon', style: baseStyle({ fill: '#111111', fillOpacity: 1, stroke: '#111111', strokeWidth: 0.2, preset: 'bati-noir' }) },
  { id: 'bati-detecte', name: 'Bâti détecté (satellite)', geom: 'polygon', style: baseStyle({ fill: '#78716c', fillOpacity: 0.55, stroke: '#57534e', strokeWidth: 0.4, preset: 'bati-detecte' }) },
  {
    id: 'voirie',
    name: 'Voirie hiérarchisée',
    geom: 'line',
    style: baseStyle({
      stroke: '#4b5563',
      strokeWidth: 1.2,
      mode: 'categorized',
      categorized: { field: 'classe', classes: ROAD_CLASSES.map((c) => ({ value: c.value, color: c.color, label: c.label })), other: '#9ca3af' },
      preset: 'voirie',
    }),
  },
  { id: 'rail', name: 'Voie ferrée', geom: 'line', style: baseStyle({ stroke: '#18181b', strokeWidth: 1.6, dash: 'dash', preset: 'rail' }) },
  { id: 'eau', name: 'Eau', geom: 'polygon', style: baseStyle({ fill: '#9cc3dc', fillOpacity: 0.9, stroke: '#4a8db7', strokeWidth: 0.6, preset: 'eau' }) },
  { id: 'cours-eau', name: 'Cours d’eau', geom: 'line', style: baseStyle({ stroke: '#4a8db7', strokeWidth: 1.2, preset: 'cours-eau' }) },
  { id: 'vegetation', name: 'Végétation / espaces verts', geom: 'polygon', style: baseStyle({ fill: '#a7c796', fillOpacity: 0.75, stroke: '#6b9a55', strokeWidth: 0.5, preset: 'vegetation' }) },
  { id: 'occupation', name: 'Occupation du sol', geom: 'polygon', style: baseStyle({ fill: '#e7e5e4', fillOpacity: 0.6, stroke: '#a8a29e', strokeWidth: 0.4, preset: 'occupation' }) },
  {
    id: 'equipements',
    name: 'Équipements par famille',
    geom: 'point',
    style: baseStyle({
      pointSize: 7,
      stroke: '#ffffff',
      strokeWidth: 1,
      fill: '#6b7280',
      fillOpacity: 1,
      mode: 'categorized',
      categorized: { field: 'famille', classes: AMENITY_FAMILIES.map((c) => ({ value: c.value, color: c.color, label: c.label })), other: '#6b7280' },
      preset: 'equipements',
    }),
  },
  { id: 'poi', name: 'Points d’intérêt', geom: 'point', style: baseStyle({ pointSize: 5, fill: '#52525b', fillOpacity: 1, stroke: '#ffffff', strokeWidth: 0.8, preset: 'poi' }) },
  { id: 'limite', name: 'Limite administrative', geom: 'polygon', style: baseStyle({ fill: '#000000', fillOpacity: 0, stroke: '#7c2d12', strokeWidth: 1.4, dash: 'dash', preset: 'limite' }) },
  { id: 'emprise-projet', name: 'Projet (rouge)', geom: 'polygon', style: baseStyle({ fill: '#dc2626', fillOpacity: 0.55, stroke: '#991b1b', strokeWidth: 1.4, preset: 'emprise-projet' }) },
  { id: 'hachures', name: 'Zone hachurée', geom: 'polygon', style: baseStyle({ fill: '#ffffff', fillOpacity: 0, stroke: '#b45309', strokeWidth: 1, hatch: 'diag', hatchColor: '#b45309', preset: 'hachures' }) },
  { id: 'perimetre', name: 'Périmètre d’étude', geom: 'polygon', style: baseStyle({ fill: '#000000', fillOpacity: 0, stroke: '#dc2626', strokeWidth: 2, dash: 'dash', preset: 'perimetre' }) },
  { id: 'courbes', name: 'Courbes de niveau', geom: 'line', style: baseStyle({ stroke: '#a16207', strokeWidth: 0.6, strokeOpacity: 0.8, preset: 'courbes' }) },
  {
    id: 'population',
    name: 'Population (carroyage)',
    geom: 'polygon',
    style: baseStyle({
      stroke: '#ffffff',
      strokeWidth: 0,
      fillOpacity: 0.7,
      mode: 'graduated',
      graduated: { field: 'population', method: 'quantile', ramp: 'orange', classes: [] },
      preset: 'population',
    }),
  },
];

export const RAMPS: Record<string, string[]> = {
  orange: ['#fff5eb', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'],
  gris: ['#f4f4f5', '#d4d4d8', '#a1a1aa', '#52525b', '#18181b'],
  bleu: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  vert: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'],
  rouge: ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'],
  violet: ['#faf5ff', '#e9d5ff', '#c084fc', '#9333ea', '#581c87'],
};

export const CATEGORY_PALETTE = ['#4c78a8', '#f58518', '#54a24b', '#e45756', '#72b7b2', '#b279a2', '#eeca3b', '#9d755d', '#bab0ac', '#ff9da6', '#1f2937', '#a16207'];

export function presetById(id: string): StylePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function cloneStyle(s: LayerStyle): LayerStyle {
  return JSON.parse(JSON.stringify(s));
}

export function defaultStyleFor(role: LayerRole, geom: GeomKind): LayerStyle {
  const pick = (id: string) => cloneStyle(presetById(id)!.style);
  switch (role) {
    case 'buildings':
      return pick('bati');
    case 'roads':
      return pick('voirie');
    case 'railways':
      return pick('rail');
    case 'water':
      return geom === 'line' ? pick('cours-eau') : pick('eau');
    case 'green':
      return pick('vegetation');
    case 'landuse':
      return pick('occupation');
    case 'amenities':
      return pick('equipements');
    case 'pois':
      return pick('poi');
    case 'admin':
      return pick('limite');
    case 'project':
      return pick('emprise-projet');
    case 'contours':
      return pick('courbes');
    case 'population':
      return pick('population');
  }
  if (geom === 'point') return baseStyle({ fill: '#2563eb', fillOpacity: 1, stroke: '#ffffff', strokeWidth: 1, pointSize: 6 });
  if (geom === 'line') return baseStyle({ stroke: '#2563eb', strokeWidth: 1.5 });
  return baseStyle({ fill: '#60a5fa', fillOpacity: 0.4, stroke: '#1d4ed8', strokeWidth: 1 });
}

/** Calcule des classes graduées sur une liste de valeurs. */
export function computeGradClasses(values: number[], method: 'equal' | 'quantile', ramp: string, n = 5) {
  const vals = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const colors = RAMPS[ramp] || RAMPS.orange;
  if (!vals.length) return [];
  const min = vals[0];
  const max = vals[vals.length - 1];
  const uniq = [...new Set(vals)];
  let breaks: number[];
  if (uniq.length <= n) {
    // peu de valeurs distinctes : une classe par valeur
    breaks = [uniq[0], ...uniq];
  } else {
    breaks = [min];
    for (let i = 1; i < n; i++) {
      if (method === 'equal') breaks.push(min + ((max - min) * i) / n);
      else breaks.push(vals[Math.min(vals.length - 1, Math.floor((vals.length * i) / n))]);
    }
    breaks.push(max);
    breaks = breaks.filter((b, i) => i === 0 || b > breaks[i - 1]);
  }
  const k = breaks.length - 1;
  const out = [];
  for (let i = 0; i < k; i++) out.push({ min: breaks[i], max: breaks[i + 1], color: colors[Math.round((i * (colors.length - 1)) / Math.max(1, k - 1))] });
  return out;
}

export const DASH: Record<LayerStyle['dash'], number[] | null> = {
  solid: null,
  dash: [4, 2.5],
  dot: [1, 2],
};

/** Couleur d'un objet selon le style (simple, catégorisé, gradué). Utilisé par les exports SVG/DXF/QGIS. */
export function featureColor(style: LayerStyle, props: Record<string, any>, which: 'fill' | 'stroke'): string {
  const base = which === 'fill' ? style.fill : style.stroke;
  if (style.mode === 'categorized' && style.categorized) {
    const v = props?.[style.categorized.field];
    const c = style.categorized.classes.find((k) => String(k.value) === String(v));
    // pour les lignes, la couleur catégorisée s'applique au trait ; pour polygones/points, au remplissage
    return c ? c.color : style.categorized.other;
  }
  if (style.mode === 'graduated' && style.graduated && style.graduated.classes.length) {
    const v = Number(props?.[style.graduated.field]);
    if (!Number.isFinite(v)) return base;
    const cls = style.graduated.classes;
    for (let i = 0; i < cls.length; i++) if (v <= cls[i].max || i === cls.length - 1) return cls[i].color;
  }
  return base;
}

/** largeur de trait catégorisée pour la voirie */
export function featureWidth(style: LayerStyle, props: Record<string, any>): number {
  if (style.preset === 'voirie' && style.mode === 'categorized' && style.categorized) {
    const v = props?.[style.categorized.field];
    const rc = ROAD_CLASSES.find((r) => r.value === v);
    if (rc) return rc.width * (style.strokeWidth / 1.2);
  }
  return style.strokeWidth;
}

/** Les modes catégorisé/gradué colorent le trait pour les lignes, le remplissage sinon. */
export function thematicTarget(geom: GeomKind): 'fill' | 'stroke' {
  return geom === 'line' ? 'stroke' : 'fill';
}
