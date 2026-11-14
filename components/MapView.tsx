'use client';
import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import * as turf from '@turf/turf';
import { useStore } from '@/lib/store';
import { buildBaseStyle, createMap, sentinelForSite } from '@/lib/mapbase';
import { installImageHandler } from '@/lib/mapimages';
import { interactiveLayerIds, resetApplied, syncLayers } from '@/lib/maplayers';
import { DrawController } from '@/lib/draw';
import { mapRef } from '@/lib/mapref';
import { bufferedEmprise } from '@/lib/site';
import { handleDrawFinish, handleMapClick, handleLiveChange, toolDrawMode } from '@/lib/tools';
import { syncOverlays, overlaySubscribe } from '@/lib/overlays';
import { startVertexEdit } from '@/lib/edit';
import { zoomToSite } from '@/lib/mapview';

let firstLabel: string | undefined;

/** Bouton de carte : recadrer sur le site (emprise + zone tampon). */
class FitSiteControl {
  private el?: HTMLDivElement;
  onAdd() {
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Recadrer sur le site');
    b.setAttribute('data-tip', 'Recadrer sur le site');
    b.setAttribute('data-key', '0');
    b.setAttribute('data-testid', 'fit-site');
    b.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:auto;display:block"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>';
    b.onclick = () => zoomToSite();
    el.appendChild(b);
    this.el = el;
    return el;
  }
  onRemove() {
    this.el?.remove();
  }
}

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const styleKey = useRef<string>('');

  useEffect(() => {
    const st = useStore.getState();
    const site = st.site!;
    // fond vide au départ ; le vrai fond est appliqué par applyBase (le dessin est créé après son chargement)
    const map = createMap(el.current!, {
      center: site.view?.center || site.center,
      zoom: site.view?.zoom ?? 15,
      bearing: site.view?.bearing ?? 0,
      pitch: site.view?.pitch ?? 0,
    });
    mapRef.map = map;
    (window as any).__map = map;
    (window as any).__store = useStore;
    (window as any).__draw = () => mapRef.draw;
    installImageHandler(map);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new FitSiteControl(), 'top-right');
    // attributions repliées au départ (bouton « i ») : elles ne masquent plus le bas de la carte
    // (MapLibre les déplie dès que le fond a des sources : on attend donc le premier rendu complet)
    const foldAttribution = () => {
      if (!(map.getStyle()?.metadata as any)?.chuilacarte) return;
      map.off('idle', foldAttribution);
      const at = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
      at?.classList.remove('maplibregl-compact-show');
      at?.removeAttribute('open');
    };
    map.on('idle', foldAttribution);
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left');

    if (!site.view) {
      const b = turf.bbox(bufferedEmprise(site)) as [number, number, number, number];
      map.fitBounds(b, { padding: 40, duration: 0 });
    }

    const draw = { current: null as DrawController | null };
    map.on('style.load', () => {
      // le style vide initial est aussitôt remplacé : on attend le vrai fond (marqué par applyBase)
      if (!(map.getStyle()?.metadata as any)?.chuilacarte) return;
      resetApplied(map);
      firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol' && !/^(lyr-|sel-|ov-|relief-)/.test(l.id))?.id;
      ensureSelectionLayers(map);
      const s = useStore.getState();
      if (s.site) {
        syncLayers(map, s.site, s.data, { mode3d: s.mode3d, beforeId: 'sel-fill', beforeLabels: firstLabel });
        syncOverlays(map);
      }
      if (!draw.current) {
        draw.current = new DrawController(map);
        mapRef.draw = draw.current;
        draw.current.onFinish = (f, mode) => handleDrawFinish(f, mode);
        draw.current.onChangeLive = (f) => handleLiveChange(f);
        draw.current.setMode(toolDrawMode(useStore.getState().tool));
      } else {
        draw.current.restart();
      }
    });

    map.on('click', (e) => handleMapClick(map, e, interactiveLayerIds(map, useStore.getState().site!)));
    map.on('mousemove', (e) => {
      const tool = useStore.getState().tool;
      if (tool !== 'select' && tool !== 'identify') return;
      const ids = interactiveLayerIds(map, useStore.getState().site!).filter((id) => map.getLayer(id));
      const f = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      map.getCanvas().style.cursor = f.length ? 'pointer' : '';
    });
    let viewTimer: any;
    map.on('moveend', () => {
      clearTimeout(viewTimer);
      viewTimer = setTimeout(() => {
        const c = map.getCenter();
        useStore.getState().patchSite((s) => {
          s.view = { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        });
      }, 600);
    });

    const unsub = useStore.subscribe((s, prev) => {
      if (!s.site) return;
      const key = baseKey(s.site);
      if (key !== styleKey.current) {
        styleKey.current = key;
        applyBase(map, s.site);
        return;
      }
      if (s.site.layers !== prev.site?.layers || s.data !== prev.data || s.mode3d !== prev.mode3d || s.site.settings !== prev.site?.settings) {
        if (map.getSource('sel')) {
          syncLayers(map, s.site, s.data, { mode3d: s.mode3d, beforeId: 'sel-fill', beforeLabels: firstLabel });
          syncOverlays(map);
        }
      }
      if (s.selection !== prev.selection || s.data !== prev.data) updateSelection(map);
      if (s.tool !== prev.tool) {
        if (prev.tool === 'edit' && draw.current?.isEditing()) draw.current.stopEdit();
        draw.current?.setMode(toolDrawMode(s.tool));
        if (s.tool === 'edit' && !draw.current?.isEditing()) {
          if (s.selection) startVertexEdit();
          else {
            useStore.getState().toast('Sélectionnez d’abord un objet à modifier', 'info');
            useStore.getState().setTool('select');
          }
        }
        map.getCanvas().style.cursor = s.tool === 'select' ? '' : 'crosshair';
      }
      if (s.mode3d !== prev.mode3d) {
        map.easeTo({ pitch: s.mode3d ? 55 : 0, duration: 600 });
      }
    });
    const unsubOv = overlaySubscribe(map);
    styleKey.current = baseKey(site);
    applyBase(map, site);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current!);
    return () => {
      unsub();
      unsubOv();
      ro.disconnect();
      draw.current?.destroy();
      mapRef.map = null;
      mapRef.draw = null;
      map.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" data-testid="map" />
    </div>
  );
}

function baseKey(site: any) {
  return JSON.stringify([site.basemap, site.overlays || {}, site.basemap === 'sentinel' ? sentinelForSite(site) : null]);
}

async function applyBase(map: MlMap, site: any) {
  const style = await buildBaseStyle({ basemap: site.basemap, hillshade: site.overlays?.hillshade, contours: site.overlays?.contours, sentinelUrl: sentinelForSite(site) });
  style.metadata = { ...(style.metadata as any), chuilacarte: true };
  mapRef.draw?.suspend();
  map.setStyle(style, { diff: false });
}

function ensureSelectionLayers(map: MlMap) {
  if (map.getSource('sel')) return;
  map.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#2563eb', 'line-width': 2.5 } });
  map.addLayer({ id: 'sel-point', type: 'circle', source: 'sel', filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]], paint: { 'circle-radius': 7, 'circle-color': 'rgba(37,99,235,0.2)', 'circle-stroke-color': '#2563eb', 'circle-stroke-width': 2.5 } });
  updateSelection(map);
}

function updateSelection(map: MlMap) {
  const s = useStore.getState();
  const src: any = map.getSource('sel');
  if (!src) return;
  const ids = s.selection ? new Set(s.selection.fids?.length ? s.selection.fids : [s.selection.fid]) : null;
  const feats = ids ? (s.data[s.selection!.layerId]?.features || []).filter((x) => ids.has(x.properties?._fid)) : [];
  src.setData({ type: 'FeatureCollection', features: feats });
}
