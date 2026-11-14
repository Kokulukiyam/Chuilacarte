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
  profile: 'Profil topographique',
  isochrone: 'Isochrone',
  zone: 'Zone d’analyse',
  split: 'Découper',
  calage: 'Calage du projet',
};

const LINE = 'Cliquez pour poser chaque point · double-clic pour terminer';
const POLY = 'Cliquez les sommets · double-clic ou clic sur le premier point pour fermer';
/** Mode d'emploi court de chaque outil, affiché sur la carte tant que l'outil est actif. */
export const TOOL_HINTS: Partial<Record<Tool, string>> = {
  identify: 'Cliquez un objet pour voir ses attributs',
  'draw-point': 'Cliquez pour placer un point',
  'draw-line': LINE,
  'draw-polygon': POLY,
  'draw-rectangle': 'Cliquez un coin, puis le coin opposé',
  'draw-circle': 'Cliquez le centre, puis un point du cercle',
  'draw-freehand': 'Maintenez le bouton de la souris et tracez',
  'draw-arrow': 'Cliquez le départ puis la pointe · double-clic pour terminer',
  'draw-text': 'Cliquez l’endroit où placer le texte',
  'draw-marker': 'Cliquez pour placer le repère',
  'draw-dimension': 'Cliquez les deux extrémités à coter · double-clic pour terminer',
  'measure-distance': LINE,
  'measure-area': POLY,
  profile: 'Tracez la ligne du profil · double-clic pour terminer',
  isochrone: 'Cliquez le point de départ',
  zone: POLY,
  split: 'Tracez la ligne de coupe à travers l’objet · double-clic pour terminer',
  edit: 'Glissez les sommets · clic sur un milieu de segment pour en ajouter un',
  calage: 'Cliquez un point du plan, puis sa position réelle sur la carte',
};

export interface ToolDef {
  tool: Tool;
  icon: any;
  label: string;
  k?: string;
}
export const TOOLBAR_GROUPS: ToolDef[][] = [
  [
    { tool: 'draw-point', icon: MapPin, label: 'Point', k: 'p' },
    { tool: 'draw-line', icon: Spline, label: 'Ligne', k: 'l' },
    { tool: 'draw-polygon', icon: Hexagon, label: 'Polygone', k: 'g' },
    { tool: 'draw-rectangle', icon: Square, label: 'Rectangle', k: 'r' },
    { tool: 'draw-circle', icon: Circle, label: 'Cercle', k: 'c' },
    { tool: 'draw-freehand', icon: PenTool, label: 'Croquis à main levée', k: 'f' },
  ],
  [
    { tool: 'draw-arrow', icon: MoveUpRight, label: 'Flèche', k: 'a' },
    { tool: 'draw-text', icon: Type, label: 'Texte', k: 't' },
    { tool: 'draw-marker', icon: Hash, label: 'Repère numéroté', k: 'n' },
    { tool: 'draw-dimension', icon: RulerDimensionLine, label: 'Cotation', k: 'd' },
  ],
  [
    { tool: 'measure-distance', icon: Ruler, label: 'Mesurer une distance', k: 'm' },
    { tool: 'measure-area', icon: LandPlot, label: 'Mesurer une surface', k: 's' },
  ],
];
export const ALL_TOOLS: ToolDef[] = TOOLBAR_GROUPS.flat();
