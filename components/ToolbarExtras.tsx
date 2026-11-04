'use client';
import { useState } from 'react';
import { DownloadCloud } from 'lucide-react';
import { useStore } from '@/lib/store';
import CollectDialog from './CollectDialog';
import { EXTRA_BUTTONS } from './extraButtons';

export default function ToolbarExtras() {
  const [collect, setCollect] = useState(false);
  const layoutMode = useStore((s) => s.layoutMode);
  return (
    <>
      {!layoutMode && (
        <button className="btn" onClick={() => setCollect(true)} data-testid="collect-open" title="Récupérer les données ouvertes sur l’emprise du site">
          <DownloadCloud size={14} /> <span className="hidden 2xl:inline">Collecter les données</span><span className="2xl:hidden">Collecter</span>
        </button>
      )}
      {EXTRA_BUTTONS.map((B, i) => (
        <B key={i} />
      ))}
      {collect && <CollectDialog onClose={() => setCollect(false)} />}
    </>
  );
}
