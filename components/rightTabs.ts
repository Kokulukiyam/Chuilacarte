import type { ComponentType } from 'react';
import AnalysisPanel from './AnalysisPanel';

export const RIGHT_TABS: { id: string; label: string; Component: ComponentType }[] = [{ id: 'analyse', label: 'Analyse', Component: AnalysisPanel }];
