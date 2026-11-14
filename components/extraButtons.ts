import type { ComponentType } from 'react';
import ExportMenu, { LayoutButton } from './ExportMenu';
import View3dButton from './View3dButton';

/** Boutons de droite de la barre d'outils, dans l'ordre. L'export QGIS est dans le menu « Exporter ». */
export const EXTRA_BUTTONS: ComponentType[] = [View3dButton, ExportMenu, LayoutButton];
