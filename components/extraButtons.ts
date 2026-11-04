import type { ComponentType } from 'react';
import ExportMenu, { LayoutButton } from './ExportMenu';
import QgisButton from './QgisButton';

export const EXTRA_BUTTONS: ComponentType[] = [LayoutButton, ExportMenu, QgisButton];
