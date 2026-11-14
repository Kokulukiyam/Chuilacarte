'use client';
import { Building2, ChartNoAxesCombined, Layers, MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import SitePanel from './SitePanel';
import LayerPanel from './LayerPanel';
import { RIGHT_TABS } from './rightTabs';

const ICONS: Record<string, any> = { couche: Layers, analyse: ChartNoAxesCombined, projet: Building2, site: MapPin };

export default function RightPanel() {
  const tab = useStore((s) => s.rightTab);
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  const extra = RIGHT_TABS.find((t) => t.id === tab);
  const tabs = [{ id: 'couche', label: 'Couche' }, ...RIGHT_TABS.map((t) => ({ id: t.id, label: t.label })), { id: 'site', label: 'Site' }];
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" data-testid="right-panel">
      <div className="flex h-9 shrink-0 border-b border-zinc-200 px-1.5 dark:border-zinc-800" role="tablist">
        {tabs.map((t) => {
          const I = ICONS[t.id];
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => useStore.getState().setUi({ rightTab: t.id as any })} data-testid={`tab-right-${t.id}`}>
              {I && <I size={13} />}
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'couche' && <LayerPanel />}
        {tab === 'site' && <SitePanel />}
        {extra && <extra.Component />}
      </div>
    </aside>
  );
}
