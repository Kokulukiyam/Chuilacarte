import type { ComponentType } from 'react';
import AnalysisPanel from './AnalysisPanel';
import ProjectPanel from './ProjectPanel';

export const RIGHT_TABS: { id: string; label: string; Component: ComponentType }[] = [
  { id: 'analyse', label: 'Analyse', Component: AnalysisPanel },
  { id: 'projet', label: 'Projet', Component: ProjectPanel },
];
