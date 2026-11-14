'use client';
import { useEffect, useState } from 'react';
import { DownloadCloud } from 'lucide-react';
import { useStore } from '@/lib/store';
import CollectDialog from './CollectDialog';
import { EXTRA_BUTTONS } from './extraButtons';
import { onUi } from '@/lib/uiEvents';

export default function ToolbarExtras() {
  const [collect, setCollect] = useState(false);
  const layoutMode = useStore((s) => s.layoutMode);
  useEffect(() => onUi('collect', () => setCollect(true)), []);
  return (
    <>
      {!layoutMode && (
        <button className="btn" onClick={() => setCollect(true)} data-testid="collect-open" data-tip="Récupérer les données ouvertes sur l’emprise du site">
          <DownloadCloud size={14} /> <span className="hidden min-[1400px]:inline">Collecter</span>
        </button>
      )}
      {EXTRA_BUTTONS.map((B, i) => (
        <B key={i} />
      ))}
      {collect && <CollectDialog onClose={() => setCollect(false)} />}
    </>
  );
}
