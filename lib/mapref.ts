'use client';
import type { Map as MlMap } from 'maplibre-gl';
import type { DrawController } from './draw';

/** Références partagées vers la carte principale (une seule par page). */
export const mapRef: { map: MlMap | null; draw: DrawController | null } = { map: null, draw: null };
