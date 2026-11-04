'use client';
import { Box } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function View3dButton() {
  const mode3d = useStore((s) => s.mode3d);
  const layoutMode = useStore((s) => s.layoutMode);
  if (layoutMode) return null;
  return (
    <button className={`btn ${mode3d ? 'ring-2 ring-blue-500' : ''}`} onClick={() => useStore.getState().setUi({ mode3d: !mode3d })} title="Vue 3D (touche 3)" data-testid="toolbar-3d">
      <Box size={14} /> 3D
    </button>
  );
}
