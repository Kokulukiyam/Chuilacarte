'use client';
import { X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { ALL_TOOLS, TOOL_HINTS, TOOL_LABELS } from './toolbarTools';

/** Mode d'emploi de l'outil actif, en bas de la carte. */
export default function ToolHint() {
  const tool = useStore((s) => s.tool);
  const target = useStore((s) => (s.drawTarget ? s.site?.layers.find((l) => l.id === s.drawTarget)?.name : null));
  const hint = TOOL_HINTS[tool];
  if (tool === 'select' || !hint) return null;
  const def = ALL_TOOLS.find((t) => t.tool === tool);
  const I = def?.icon;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-16" data-testid="tool-hint">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white/95 py-1 pl-1.5 pr-1 text-[12px] shadow-pop backdrop-blur animate-rise dark:border-zinc-700 dark:bg-zinc-900/95">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-600 px-2 py-0.5 font-medium text-white dark:bg-accent-500">
          {I && <I size={12} />}
          {def?.label || TOOL_LABELS[tool] || tool}
        </span>
        <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
          {hint}
          {target && <span className="text-zinc-400"> · dans « {target} »</span>}
        </span>
        <button className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" onClick={() => useStore.getState().setTool('select')} aria-label="Quitter l’outil">
          <span className="kbd">Échap</span>
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
