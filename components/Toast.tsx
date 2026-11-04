'use client';
import { useStore } from '@/lib/store';

export default function Toast() {
  const m = useStore((s) => s.message);
  if (!m) return null;
  const cls =
    m.kind === 'error'
      ? 'bg-red-600 text-white'
      : m.kind === 'ok'
        ? 'bg-emerald-600 text-white'
        : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
  return (
    <div className={`fixed bottom-6 left-1/2 z-[60] max-w-xl -translate-x-1/2 rounded-md px-4 py-2 text-[13px] shadow-lg ${cls}`} role="status" data-testid="toast">
      {m.text}
    </div>
  );
}
