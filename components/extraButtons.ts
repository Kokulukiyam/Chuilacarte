import type { ComponentType } from 'react';
import ExportMenu, { LayoutButton } from './ExportMenu';
import QgisButton from './QgisButton';
import View3dButton from './View3dButton';

export const EXTRA_BUTTONS: ComponentType[] = [View3dButton, LayoutButton, ExportMenu, QgisButton];
