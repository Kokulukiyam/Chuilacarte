import 'server-only';
import type { Geometry } from 'geojson';
import type { Layer, LayerStyle } from '../types';
import { featureWidth, ROAD_CLASSES } from '../styles';

const PX = 0.2646; // mm par pixel

export function esc(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** #rrggbb + opacité → "r,g,b,a" (format QGIS) */
export function qc(hex: string, alpha = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(Math.max(0, Math.min(1, alpha)) * 255)}`;
}

const prop = (k: string, v: any) => `<prop k="${esc(k)}" v="${esc(v)}"/>`;
const DASH_Q: Record<string, string> = { solid: 'solid', dash: 'dash', dot: 'dot' };
const MARKER: Record<string, string> = { circle: 'circle', square: 'square', triangle: 'triangle', diamond: 'diamond', star: 'star', cross: 'cross_fill' };

type Kind = 'fill' | 'line' | 'marker';

function ddColor(field: string, prop: string) {
  return `<Option type="Map" name="${prop}"><Option value="true" type="bool" name="active"/><Option value="${field}" type="QString" name="field"/><Option value="2" type="int" name="type"/></Option>`;
}

function symbolXml(name: string, kind: Kind, s: LayerStyle, color: string, opts: { width?: number; dd?: boolean } = {}) {
  const lw = (opts.width ?? s.strokeWidth) * PX;
  const dd = (props: string[]) =>
    opts.dd ? `<data_defined_properties><Option type="Map"><Option value="" type="QString" name="name"/><Option type="Map" name="properties">${props.map((p) => ddColor('couleur', p)).join('')}</Option><Option value="collection" type="QString" name="type"/></Option></data_defined_properties>` : '';
  if (kind === 'line') {
    return `<symbol type="line" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleLine" enabled="1" locked="0" pass="0">${prop('line_color', qc(color, s.strokeOpacity))}${prop('line_width', lw.toFixed(3))}${prop('line_width_unit', 'MM')}${prop('line_style', DASH_Q[s.dash] || 'solid')}${prop('joinstyle', 'round')}${prop('capstyle', s.dash === 'solid' ? 'round' : 'flat')}${dd(['outlineColor'])}</layer></symbol>`;
  }
  if (kind === 'marker') {
    return `<symbol type="marker" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleMarker" enabled="1" locked="0" pass="0">${prop('name', MARKER[s.pointShape] || 'circle')}${prop('color', qc(color, s.fillOpacity))}${prop('outline_color', qc(s.stroke, s.strokeOpacity))}${prop('outline_width', (s.strokeWidth * PX).toFixed(3))}${prop('outline_width_unit', 'MM')}${prop('size', (s.pointSize * PX).toFixed(3))}${prop('size_unit', 'MM')}${prop('outline_style', s.strokeWidth > 0 ? 'solid' : 'no')}${dd(['fillColor'])}</layer></symbol>`;
  }
  let layers = `<layer class="SimpleFill" enabled="1" locked="0" pass="0">${prop('color', qc(color, s.fillOpacity))}${prop('style', s.fillOpacity > 0 ? 'solid' : 'no')}${prop('outline_color', qc(s.stroke, s.strokeOpacity))}${prop('outline_width', lw.toFixed(3))}${prop('outline_width_unit', 'MM')}${prop('outline_style', s.strokeWidth > 0 ? DASH_Q[s.dash] || 'solid' : 'no')}${prop('joinstyle', 'round')}${dd(['outlineColor'])}</layer>`;
  if (s.hatch && s.hatch !== 'none') {
    const angles: Record<string, number[]> = { diag: [45], 'diag-rev': [135], cross: [45, 135], horiz: [0], vert: [90], dots: [] };
    if (s.hatch === 'dots') {
      layers += `<layer class="PointPatternFill" enabled="1" locked="0" pass="0">${prop('distance_x', '1.6')}${prop('distance_y', '1.6')}${prop('distance_x_unit', 'MM')}${prop('distance_y_unit', 'MM')}<symbol type="marker" name="@${name}@1" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleMarker" enabled="1" locked="0" pass="0">${prop('name', 'circle')}${prop('color', qc(s.hatchColor))}${prop('size', '0.44')}${prop('size_unit', 'MM')}${prop('outline_style', 'no')}</layer></symbol></layer>`;
    } else
      angles[s.hatch].forEach((a, i) => {
        layers += `<layer class="LinePatternFill" enabled="1" locked="0" pass="0">${prop('angle', a)}${prop('distance', '1.6')}${prop('distance_unit', 'MM')}${prop('line_width', '0.18')}${prop('line_width_unit', 'MM')}${prop('color', qc(s.hatchColor))}<symbol type="line" name="@${name}@${i + 1}" alpha="1" clip_to_extent="1" force_rhr="0"><layer class="SimpleLine" enabled="1" locked="0" pass="0">${prop('line_color', qc(s.hatchColor))}${prop('line_width', '0.18')}${prop('line_width_unit', 'MM')}</layer></symbol></layer>`;
      });
  }
  return `<symbol type="fill" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0">${layers}</symbol>`;
}

function kindOf(layer: Layer, feats: { geometry: Geometry }[]): Kind {
  if (layer.geom === 'line') return 'line';
  if (layer.geom === 'point') return 'marker';
  if (layer.geom === 'polygon') return 'fill';
  const t = feats.find((f) => f.geometry)?.geometry.type || 'Polygon';
  return /Point/.test(t) ? 'marker' : /Line/.test(t) ? 'line' : 'fill';
}

function rendererXml(layer: Layer, kind: Kind) {
  const s = layer.style;
  const main = kind === 'line' ? s.stroke : s.fill;
  if (s.mode === 'heatmap' && kind === 'marker') {
    const r = ((s.heatmap?.radius ?? 30) * PX).toFixed(2);
    return `<renderer-v2 type="heatmapRenderer" radius="${r}" radius_unit="0" radius_map_unit_scale="3x:0,0,0,0,0,0" max_value="0" quality="3" weight_expression="" enableorderby="0" forceraster="0"><colorramp type="gradient" name="[source]"><prop k="color1" v="255,255,178,0"/><prop k="color2" v="189,0,38,255"/><prop k="discrete" v="0"/><prop k="rampType" v="gradient"/><prop k="stops" v="0.2;254,217,118,255:0.4;254,178,76,255:0.6;253,141,60,255:0.8;240,59,32,255"/></colorramp></renderer-v2>`;
  }
  if (layer.role === 'annotations') return `<renderer-v2 type="singleSymbol" symbollevels="0" enableorderby="0" forceraster="0"><symbols>${symbolXml('0', kind, { ...s, fill: '#dc2626', stroke: '#dc2626', fillOpacity: kind === 'fill' ? 0.15 : 1, strokeWidth: 2 }, '#dc2626', { dd: true })}</symbols></renderer-v2>`;
  if (s.mode === 'categorized' && s.categorized?.field && s.categorized.classes.length) {
    const cats = s.categorized.classes;
    const syms = cats.map((c, i) => symbolXml(String(i), kind, kind === 'line' ? { ...s, stroke: c.color } : s, c.color, { width: kind === 'line' ? featureWidth(s, { [s.categorized!.field]: c.value }) : undefined }));
    syms.push(symbolXml(String(cats.length), kind, kind === 'line' ? { ...s, stroke: s.categorized.other } : s, s.categorized.other));
    const catXml = cats.map((c, i) => `<category render="true" symbol="${i}" value="${esc(c.value)}" label="${esc(c.label || c.value)}"/>`).join('') + `<category render="true" symbol="${cats.length}" value="" label="Autres"/>`;
    return `<renderer-v2 type="categorizedSymbol" attr="${esc(s.categorized.field)}" symbollevels="0" enableorderby="0" forceraster="0"><categories>${catXml}</categories><symbols>${syms.join('')}</symbols><source-symbol>${symbolXml('0', kind, s, main)}</source-symbol></renderer-v2>`;
  }
  if (s.mode === 'graduated' && s.graduated?.field && s.graduated.classes.length) {
    const cls = s.graduated.classes;
    const syms = cls.map((c, i) => symbolXml(String(i), kind, kind === 'line' ? { ...s, stroke: c.color } : s, c.color));
    const rng = cls.map((c, i) => `<range render="true" symbol="${i}" lower="${c.min}" upper="${c.max}" label="${esc(`${c.min.toLocaleString('fr-FR')} – ${c.max.toLocaleString('fr-FR')}`)}"/>`).join('');
    return `<renderer-v2 type="graduatedSymbol" attr="${esc(s.graduated.field)}" graduatedMethod="GraduatedColor" symbollevels="0" enableorderby="0" forceraster="0"><ranges>${rng}</ranges><symbols>${syms.join('')}</symbols><mode name="${s.graduated.method === 'equal' ? 'equal' : 'quantile'}"/></renderer-v2>`;
  }
  return `<renderer-v2 type="singleSymbol" symbollevels="0" enableorderby="0" forceraster="0"><symbols>${symbolXml('0', kind, s, main)}</symbols></renderer-v2>`;
}

function labelingXml(layer: Layer, kind: Kind) {
  const lab = layer.style.label;
  let field = lab?.field;
  let size = lab?.size || 10;
  let color = lab?.color || '#1f2937';
  let bold = lab?.weight === 'bold';
  let isExpr = false;
  if (layer.role === 'annotations') {
    field = 'coalesce("texte", to_string("numero"))';
    isExpr = true;
    size = 12;
    color = '#dc2626';
    bold = true;
  }
  if (!field) return '';
  const placement = kind === 'line' ? '2' : kind === 'marker' ? '0' : '0';
  return `<labeling type="simple"><settings calloutType="simple"> <text-style fieldName="${esc(field)}" isExpression="${isExpr ? 1 : 0}" fontFamily="Inter" namedStyle="${bold ? 'Bold' : 'Regular'}" fontWeight="${bold ? 75 : 50}" fontSize="${(size * 0.75).toFixed(1)}" fontSizeUnit="Point" textColor="${qc(color)}" textOpacity="1" multilineHeight="1"><text-buffer bufferDraw="1" bufferSize="0.8" bufferSizeUnits="MM" bufferColor="${qc(lab?.halo || '#ffffff')}" bufferOpacity="1" bufferJoinStyle="128"/></text-style><placement placement="${placement}" priority="5" dist="1" distUnits="MM" placementFlags="10" repeatDistance="0"/><rendering obstacle="1" scaleVisibility="0" minFeatureSize="0" upsidedownLabels="0"/></settings></labeling>`;
}

/** Style QGIS (QML) d'une couche, aussi proche que possible du style Chuilacarte. */
export function layerQml(layer: Layer, feats: { geometry: Geometry }[], forced?: Kind) {
  const kind = forced || kindOf(layer, feats);
  const lab = labelingXml(layer, kind);
  return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.34.0" styleCategories="Symbology|Labeling|Rendering" labelsEnabled="${lab ? 1 : 0}">
${rendererXml(layer, kind)}
${lab}
<blendMode>0</blendMode>
<featureBlendMode>0</featureBlendMode>
<layerOpacity>${layer.opacity}</layerOpacity>
</qgis>`;
}

export { ROAD_CLASSES };
