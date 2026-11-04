'use client';
import { useAnalysis } from '@/lib/analysisTools';

export default function AnalysisError() {
  const err = useAnalysis((s) => s.error);
  if (!err) return null;
  return (
    <div className="flex items-start justify-between rounded-md bg-red-50 p-2 text-[12px] text-red-700 dark:bg-red-950 dark:text-red-300" data-testid="analysis-error">
      {err}
      <button className="ml-2" onClick={() => useAnalysis.getState().set({ error: null })}>
        ×
      </button>
    </div>
  );
}
