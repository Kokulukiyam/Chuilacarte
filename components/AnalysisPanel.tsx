'use client';
import MeasurePanel from './MeasurePanel';
import { ANALYSIS_SECTIONS } from './analysisSections';

export default function AnalysisPanel() {
  return (
    <div className="space-y-5 p-3" data-testid="analysis-panel">
      <MeasurePanel />
      {ANALYSIS_SECTIONS.map((S, i) => (
        <S key={i} />
      ))}
    </div>
  );
}
