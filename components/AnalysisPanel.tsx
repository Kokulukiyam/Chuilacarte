'use client';
import MeasurePanel from './MeasurePanel';
import { ANALYSIS_SECTIONS } from './analysisSections';

export default function AnalysisPanel() {
  return (
    <div className="space-y-4 p-3 [&>*+*]:border-t [&>*+*]:border-zinc-200/70 [&>*+*]:pt-4 dark:[&>*+*]:border-zinc-800" data-testid="analysis-panel">
      <MeasurePanel />
      {ANALYSIS_SECTIONS.map((S, i) => (
        <S key={i} />
      ))}
    </div>
  );
}
