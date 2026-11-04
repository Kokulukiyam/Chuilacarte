import type { ComponentType } from 'react';
import type { Layer } from '@/lib/types';
import AnnotationProps from './AnnotationProps';
import StyleEditor, { FilterEditor } from './StyleEditor';
import LegendSection from './LegendSection';
import EditSection from './EditSection';

export const LAYER_SECTIONS: ComponentType<{ layer: Layer }>[] = [AnnotationProps, StyleEditor, FilterEditor, LegendSection, EditSection];
