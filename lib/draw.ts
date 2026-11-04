'use client';
import type { Map as MlMap } from 'maplibre-gl';
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawFreehandMode,
  TerraDrawFreehandLineStringMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawRenderMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { Feature } from 'geojson';

export type DrawMode = 'point' | 'linestring' | 'polygon' | 'rectangle' | 'circle' | 'freehand' | 'freehand-line' | 'select' | 'static';

const ACCENT = '#e11d48';

/** Enveloppe autour de Terra Draw : un dessin à la fois, résultat transmis par rappel. */
export class DrawController {
  td: TerraDraw | null = null;
  map: MlMap;
  onFinish: ((f: Feature, mode: DrawMode) => void) | null = null;
  onEditChange: ((features: Feature[]) => void) | null = null;
  onChangeLive: ((f: Feature | null) => void) | null = null;
  private mode: DrawMode = 'static';
  private editing = false;

  constructor(map: MlMap) {
    this.map = map;
    this.create();
  }

  private create() {
    const styles = {
      fillColor: ACCENT as any,
      fillOpacity: 0.12,
      outlineColor: ACCENT as any,
      outlineWidth: 2,
      lineStringColor: ACCENT as any,
      lineStringWidth: 2.5,
      pointColor: ACCENT as any,
      pointWidth: 5,
      closingPointColor: '#ffffff' as any,
      closingPointOutlineColor: ACCENT as any,
      closingPointWidth: 4,
      closingPointOutlineWidth: 2,
    };
    const flags = {
      feature: {
        draggable: true,
        rotateable: true,
        scaleable: true,
        coordinates: { midpoints: true, draggable: true, deletable: true },
      },
    };
    this.td = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map: this.map as any }),
      modes: [
        new TerraDrawSelectMode({
          flags: { point: flags, linestring: flags, polygon: flags, rectangle: flags, circle: flags, freehand: flags, 'freehand-line': flags } as any,
          styles: { selectedPolygonColor: '#2563eb' as any, selectedPolygonOutlineColor: '#2563eb' as any, selectedLineStringColor: '#2563eb' as any, selectedPointColor: '#2563eb' as any, selectionPointColor: '#ffffff' as any, selectionPointOutlineColor: '#2563eb' as any, midPointColor: '#2563eb' as any } as any,
        }),
        new TerraDrawPointMode({ styles: { pointColor: ACCENT as any, pointWidth: 6, pointOutlineColor: '#ffffff' as any, pointOutlineWidth: 2 } as any }),
        new TerraDrawLineStringMode({ styles: styles as any }),
        new TerraDrawPolygonMode({ styles: styles as any }),
        new TerraDrawRectangleMode({ styles: styles as any }),
        new TerraDrawCircleMode({ styles: styles as any }),
        new TerraDrawFreehandMode({ styles: styles as any }),
        new TerraDrawFreehandLineStringMode({ styles: styles as any }),
        new TerraDrawRenderMode({ modeName: 'static', styles: {} }),
      ],
    });
    this.td.start();
    this.td.on('finish', (id: any, ctx: any) => {
      if (!this.td) return;
      if (this.editing) {
        this.emitEdit();
        return;
      }
      if (ctx?.action && ctx.action !== 'draw') return;
      const f = this.td.getSnapshotFeature(id);
      if (!f) return;
      const mode = this.mode;
      const clean: Feature = { type: 'Feature', geometry: f.geometry as any, properties: { mode: (f.properties as any)?.mode } };
      // on efface le dessin temporaire : la couche cible prend le relais
      try {
        this.td.removeFeatures([id]);
      } catch {
        /* déjà supprimé */
      }
      this.onFinish?.(clean, mode);
    });
    this.td.on('change', (ids: any[], type: string) => {
      if (!this.td || this.editing) return;
      if (type === 'delete') return;
      const snap = this.td.getSnapshot().filter((f: any) => !f.properties?.selectionPoint && !f.properties?.midPoint);
      const f = snap[snap.length - 1];
      this.onChangeLive?.(f ? ({ type: 'Feature', geometry: f.geometry, properties: {} } as any) : null);
    });
  }

  /** À appeler après un changement de style de fond (les couches de Terra Draw sont perdues). */
  restart() {
    const snap = this.td?.getSnapshot() || [];
    try {
      this.td?.stop();
    } catch {
      /* rien */
    }
    this.td = null;
    this.create();
    if (snap.length) this.td!.addFeatures(snap as any);
    this.setMode(this.mode);
  }

  setMode(m: DrawMode) {
    this.mode = m;
    if (!this.td) return;
    try {
      this.td.setMode(m);
    } catch (e) {
      console.warn('draw mode', e);
    }
  }

  getMode() {
    return this.mode;
  }

  clear() {
    this.editing = false;
    this.td?.clear();
  }

  /** Charge des objets pour les modifier (sommets, déplacement, rotation). */
  startEdit(features: Feature[]) {
    if (!this.td) return;
    this.td.clear();
    this.editing = true;
    const mode = (f: Feature) => {
      const t = f.geometry.type;
      return t === 'Point' ? 'point' : t === 'LineString' ? 'linestring' : 'polygon';
    };
    const items = features
      .filter((f) => ['Point', 'LineString', 'Polygon'].includes(f.geometry?.type))
      .map((f) => ({ id: String(f.properties?._fid), type: 'Feature', geometry: f.geometry, properties: { mode: mode(f) } }));
    const res = this.td.addFeatures(items as any);
    const bad = res.filter((r: any) => !r.valid);
    if (bad.length) console.warn('objets non éditables', bad.length);
    this.setMode('select');
    if (items.length === 1) {
      try {
        this.td.selectFeature(items[0].id);
      } catch {
        /* rien */
      }
    }
    this.td.on('change', this.editListener);
  }

  private editTimer: any = null;
  private editListener = (_ids: any[], type: string) => {
    if (!this.editing) return;
    if (type === 'styling') return;
    clearTimeout(this.editTimer);
    this.editTimer = setTimeout(() => this.emitEdit(), 250);
  };

  private emitEdit() {
    if (!this.td) return;
    const snap = this.td.getSnapshot().filter((f: any) => !f.properties?.selectionPoint && !f.properties?.midPoint && !f.properties?.coordinatePoint);
    this.onEditChange?.(snap.map((f: any) => ({ type: 'Feature', geometry: f.geometry, properties: { _fid: String(f.id) } })) as any);
  }

  stopEdit() {
    if (this.editing) this.emitEdit();
    this.editing = false;
    this.td?.off('change', this.editListener);
    this.td?.clear();
    this.setMode('static');
  }

  isEditing() {
    return this.editing;
  }

  destroy() {
    try {
      this.td?.stop();
    } catch {
      /* rien */
    }
    this.td = null;
  }
}
