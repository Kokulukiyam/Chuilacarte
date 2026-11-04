import type { ComponentType } from 'react';

import { SynthesisSection, BufferSection, IsochroneSection, ProfileSection, DensitySection } from './AnalysisTools';
import AnalysisError from './AnalysisError';

export const ANALYSIS_SECTIONS: ComponentType[] = [AnalysisError, SynthesisSection, ProfileSection, IsochroneSection, BufferSection, DensitySection];
