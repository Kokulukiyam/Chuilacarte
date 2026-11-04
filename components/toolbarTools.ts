import type { Tool } from '@/lib/store';
import { MapPin, Spline, Hexagon, Square, Circle, PenTool, MoveUpRight, Type, Hash, Ruler, RulerDimensionLine, LandPlot } from 'lucide-react';

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
  'measure-area': 'Mesurer une surface et un périmètre',
  edit: 'Modifier la géométrie sélectionnée',
};

export const TOOLBAR_GROUPS: { tool: Tool; icon: any; label: string; k?: string }[][] = [
  [
    { tool: 'draw-point', icon: MapPin, label: 'Point', k: 'p' },
    { tool: 'draw-line', icon: Spline, label: 'Ligne', k: 'l' },
    { tool: 'draw-polygon', icon: Hexagon, label: 'Polygone', k: 'g' },
    { tool: 'draw-rectangle', icon: Square, label: 'Rectangle', k: 'r' },
    { tool: 'draw-circle', icon: Circle, label: 'Cercle', k: 'c' },
    { tool: 'draw-arrow', icon: MoveUpRight, label: 'Flèche', k: 'a' },
    { tool: 'draw-freehand', icon: PenTool, label: 'Croquis à main levée', k: 'f' },
    { tool: 'draw-text', icon: Type, label: 'Texte', k: 't' },
    { tool: 'draw-marker', icon: Hash, label: 'Repère numéroté', k: 'n' },
    { tool: 'draw-dimension', icon: RulerDimensionLine, label: 'Cotation', k: 'd' },
  ],
  [
    { tool: 'measure-distance', icon: Ruler, label: 'Mesurer une distance', k: 'm' },
    { tool: 'measure-area', icon: LandPlot, label: 'Mesurer une surface', k: 's' },
  ],
];
