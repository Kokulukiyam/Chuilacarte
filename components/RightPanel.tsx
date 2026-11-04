'use client';
import { useStore } from '@/lib/store';
import SitePanel from './SitePanel';
import LayerPanel from './LayerPanel';
import { RIGHT_TABS } from './rightTabs';

export default function RightPanel() {
  const tab = useStore((s) => s.rightTab);
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  const extra = RIGHT_TABS.find((t) => t.id === tab);
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" data-testid="right-panel">
      <div className="flex gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        {[{ id: 'couche', label: 'Couche' }, ...RIGHT_TABS.map((t) => ({ id: t.id, label: t.label })), { id: 'site', label: 'Site' }].map((t) => (
          <button
            key={t.id}
            className={`tool-btn px-2.5 text-[12px] ${tab === t.id ? 'active' : ''}`}
            onClick={() => useStore.getState().setUi({ rightTab: t.id as any })}
            data-testid={`tab-right-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'couche' && <LayerPanel />}
        {tab === 'site' && <SitePanel />}
        {extra && <extra.Component />}
      </div>
    </aside>
  );
}
