'use client';
import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import type { Feature } from 'geojson';
import { useStore, type Tool } from './store';
import type { DrawMode } from './draw';

export function toolDrawMode(t: Tool): DrawMode {
  switch (t) {
    case 'draw-point':
    case 'draw-text':
    case 'draw-marker':
    case 'isochrone':
      return 'point';
    case 'draw-line':
    case 'draw-arrow':
    case 'draw-dimension':
    case 'measure-distance':
    case 'profile':
    case 'split':
      return 'linestring';
    case 'draw-polygon':
    case 'measure-area':
    case 'zone':
      return 'polygon';
    case 'draw-rectangle':
      return 'rectangle';
    case 'draw-circle':
      return 'circle';
    case 'draw-freehand':
      return 'freehand-line';
    case 'edit':
      return 'select';
    default:
      return 'static';
  }
}

type FinishHandler = (f: Feature, mode: DrawMode, tool: Tool) => void;
const finishHandlers: Partial<Record<Tool, FinishHandler>> = {};
const liveHandlers: Partial<Record<Tool, (f: Feature | null) => void>> = {};
const clickHandlers: Partial<Record<Tool, (map: MlMap, e: MapMouseEvent) => boolean>> = {};

export function registerTool(t: Tool, h: { finish?: FinishHandler; live?: (f: Feature | null) => void; click?: (map: MlMap, e: MapMouseEvent) => boolean }) {
  if (h.finish) finishHandlers[t] = h.finish;
  if (h.live) liveHandlers[t] = h.live;
  if (h.click) clickHandlers[t] = h.click;
}

export function handleDrawFinish(f: Feature, mode: DrawMode) {
  const tool = useStore.getState().tool;
  const h = finishHandlers[tool];
  if (h) h(f, mode, tool);
}

export function handleLiveChange(f: Feature | null) {
  const tool = useStore.getState().tool;
  liveHandlers[tool]?.(f);
}

export function handleMapClick(map: MlMap, e: MapMouseEvent, layerIds: string[]) {
  const st = useStore.getState();
  const h = clickHandlers[st.tool];
  if (h && h(map, e)) return;
  if (st.tool !== 'select' && st.tool !== 'identify') return;
  const ids = layerIds.filter((id) => map.getLayer(id));
  const hits = ids.length ? map.queryRenderedFeatures([[e.point.x - 3, e.point.y - 3], [e.point.x + 3, e.point.y + 3]], { layers: ids }) : [];
  if (!hits.length) {
    st.select(null);
    return;
  }
  const h0 = hits.find((h) => String(h.source) === `src-${st.selectedLayerId}`) || hits[0];
  const layerId = String(h0.source).replace(/^src-/, '');
  const fid = String(h0.properties?._fid ?? h0.id);
  const cur = st.selection;
  if ((e.originalEvent as MouseEvent)?.shiftKey && cur && cur.layerId === layerId) {
    const set = new Set(cur.fids?.length ? cur.fids : [cur.fid]);
    if (set.has(fid)) set.delete(fid);
    else set.add(fid);
    const arr = [...set];
    st.select(arr.length ? { layerId, fid: arr[arr.length - 1], fids: arr } : null);
    return;
  }
  st.select({ layerId, fid });
  if (st.rightTab !== 'couche') st.setUi({ rightTab: 'couche' });
}
