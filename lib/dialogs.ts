'use client';
import { create } from 'zustand';

/** Boîtes de dialogue de l'application (remplacent prompt/confirm/alert du navigateur). */
export interface DialogRequest {
  id: number;
  kind: 'confirm' | 'prompt' | 'alert';
  title: string;
  message?: string;
  /** champ de saisie (prompt) */
  label?: string;
  initial?: string;
  placeholder?: string;
  /** autoriser une réponse vide (prompt) */
  allowEmpty?: boolean;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

interface DialogState {
  queue: DialogRequest[];
  push(r: Omit<DialogRequest, 'id'>): void;
  close(id: number, v: string | boolean | null): void;
}

let seq = 0;
export const useDialogs = create<DialogState>((set, get) => ({
  queue: [],
  push(r) {
    set({ queue: [...get().queue, { ...r, id: ++seq }] });
  },
  close(id, v) {
    const r = get().queue.find((x) => x.id === id);
    set({ queue: get().queue.filter((x) => x.id !== id) });
    r?.resolve(v);
  },
}));

type Opts = Partial<Omit<DialogRequest, 'id' | 'kind' | 'resolve' | 'title'>>;

/** Demande une confirmation. Résout à true si l'utilisateur confirme. */
export function askConfirm(title: string, opts: Opts = {}): Promise<boolean> {
  return new Promise((resolve) => useDialogs.getState().push({ kind: 'confirm', title, ...opts, resolve: (v) => resolve(v === true) }));
}

/** Demande un texte. Résout à null si l'utilisateur annule. */
export function askText(title: string, opts: Opts = {}): Promise<string | null> {
  return new Promise((resolve) => useDialogs.getState().push({ kind: 'prompt', title, ...opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
}

/** Affiche un message à acquitter. */
export function showAlert(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => useDialogs.getState().push({ kind: 'alert', title, message, resolve: () => resolve() }));
}
