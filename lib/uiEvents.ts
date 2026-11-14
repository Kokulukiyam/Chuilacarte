'use client';
/** Ouverture de dialogues depuis n'importe où (palette de commandes, raccourcis). */
export type UiTarget = 'collect' | 'shortcuts' | 'palette' | 'export' | 'basemap' | 'import';
const EVT = 'chuilacarte-ui';
export function openUi(target: UiTarget) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: target }));
}
export function onUi(target: UiTarget, fn: () => void) {
  const h = (e: Event) => (e as CustomEvent).detail === target && fn();
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
