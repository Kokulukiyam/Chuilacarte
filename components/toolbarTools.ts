import type { Tool } from '@/lib/store';

export const TOOL_LABELS: Partial<Record<Tool, string>> = {
  select: 'Sélection',
  identify: 'Identifier',
  'draw-point': 'Point',
  'draw-line': 'Ligne',
  'draw-polygon': 'Polygone',
  'draw-rectangle': 'Rectangle',
  'draw-circle': 'Cercle',
  'draw-freehand': 'Croquis à main levée',
  'draw-arrow': 'Flèche',
  'draw-text': 'Texte',
  'draw-marker': 'Repère numéroté',
  'draw-dimension': 'Cotation',
  'measure-distance': 'Mesurer une distance',
  'measure-area': 'Mesurer une surface',
  edit: 'Modifier la géométrie',
};

export const TOOLBAR_GROUPS: { tool: Tool; icon: any; label: string; k?: string }[][] = [];
