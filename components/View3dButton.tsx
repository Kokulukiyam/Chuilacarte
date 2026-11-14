'use client';
import { Box } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function View3dButton() {
  const mode3d = useStore((s) => s.mode3d);
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  return (
    <button
      className={`btn ${mode3d ? 'on' : ''}`}
      onClick={() => useStore.getState().setUi({ mode3d: !mode3d })}
      data-tip={mode3d ? 'Revenir à la vue en plan' : 'Vue 3D : bâtiments en volume'}
      data-key="3"
      aria-pressed={mode3d}
      data-testid="toolbar-3d"
    >
      <Box size={14} /> 3D
    </button>
  );
}
