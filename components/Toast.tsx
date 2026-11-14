'use client';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function Toast() {
  const m = useStore((s) => s.message);
  if (!m) return null;
  const Icon = m.kind === 'error' ? AlertCircle : m.kind === 'ok' ? CheckCircle2 : Info;
  const tone = m.kind === 'error' ? 'text-red-400 dark:text-red-600' : m.kind === 'ok' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-400 dark:text-zinc-500';
  const close = () => useStore.setState({ message: null });
  return (
    <div
      className="fixed bottom-10 left-1/2 z-[60] flex max-w-xl -translate-x-1/2 items-start gap-2.5 rounded-lg bg-zinc-900 py-2.5 pl-3 pr-2 text-[13px] text-white shadow-modal animate-rise dark:bg-zinc-100 dark:text-zinc-900"
      role={m.kind === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      data-kind={m.kind}
    >
      <Icon size={16} className={`mt-px shrink-0 ${tone}`} />
      <span className="min-w-0 leading-snug">{m.text}</span>
      {m.action && (
        <button
          className="shrink-0 rounded px-1.5 font-semibold text-accent-300 hover:bg-white/10 dark:text-accent-700 dark:hover:bg-zinc-900/10"
          onClick={() => {
            m.action!.run();
            close();
          }}
          data-testid="toast-action"
        >
          {m.action.label}
        </button>
      )}
      <button className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white dark:hover:bg-zinc-900/10 dark:hover:text-zinc-900" onClick={close} aria-label="Fermer le message">
        <X size={14} />
      </button>
    </div>
  );
}
