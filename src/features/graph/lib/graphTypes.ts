/**
 * Graph View internal types (Phase 2-D-2-P2).
 */

import type { GraphScope } from './graphScope';

export type { GraphScope };

export type GraphThemeId =
  | 'schola-clinical-light'
  | 'schola-academic-dark'
  | 'paper-ink'
  | 'pathology-glass'
  | 'blueprint'
  | 'high-contrast';

export type PreviewMode = 'markdown' | 'graph';

export type GraphLayoutAlgorithm = 'force-directed' | 'hierarchical' | 'circular';

export type GraphViewMode = 'sidebar' | 'main';

export type NodeShape = 'circle' | 'rectangle' | 'rounded-rectangle' | 'capsule' | 'hexagon' | 'diamond';

export interface GraphStyleConfig {
  readonly nodeSize: number;
  readonly edgeWidth: number;
  readonly showLabels: boolean;
  readonly labelColor: string;
  readonly labelFontSize: number;
  readonly showRelationLabels: boolean;
  readonly relationLabelColor: string;
  readonly canvasBackground: string;
  readonly showGrid: boolean;
  readonly nodeShape: NodeShape;
  readonly nodeColor: string;
  readonly edgeColor: string;
}

export const DEFAULT_STYLE_CONFIG: GraphStyleConfig = {
  nodeSize: 3,
  edgeWidth: 2,
  showLabels: true,
  labelColor: '#1F2A37',
  labelFontSize: 11,
  showRelationLabels: false,
  relationLabelColor: '#66788A',
  canvasBackground: '#F3F8FC',
  showGrid: true,
  nodeShape: 'circle',
  nodeColor: '#2388C6',
  edgeColor: '#6FAFD6',
};

export const LAYOUT_LABELS: Record<GraphLayoutAlgorithm, string> = {
  'force-directed': '力导向',
  hierarchical: '层级',
  circular: '环形',
};

export interface GraphTheme {
  readonly id: GraphThemeId;
  readonly name: string;
  readonly background: string;
  readonly surface: string;
  readonly grid: string;
  readonly text: string;
  readonly mutedText: string;
  readonly accent: string;
  readonly node: {
    readonly file: string;
    readonly fileStroke: string;
    readonly current: string;
    readonly currentStroke: string;
    readonly currentHalo: string;
    readonly unresolved: string;
    readonly unresolvedStroke: string;
    readonly orphan: string;
    readonly orphanStroke: string;
    readonly hoverStroke: string;
    readonly label: string;
  };
  readonly edge: {
    readonly wikilink: string;
    readonly wikilinkActive: string;
    readonly unresolved: string;
    readonly unresolvedActive: string;
    readonly muted: string;
  };
  readonly effects: {
    readonly panelShadow: string;
    readonly nodeShadow: string;
    readonly currentShadow: string;
  };
}
