'use client';
import { create } from 'zustand';

export interface AppConfig {
  arcgis: boolean;
  ors: boolean;
  noncommercial: boolean;
  contact: boolean;
}

export const useConfig = create<{ cfg: AppConfig; loaded: boolean; load(): Promise<void> }>((set, get) => ({
  cfg: { arcgis: false, ors: false, noncommercial: false, contact: false },
  loaded: false,
  async load() {
    if (get().loaded) return;
    try {
      const r = await fetch('/api/config');
      set({ cfg: await r.json(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
