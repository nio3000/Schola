import { useEffect, useMemo, useState, useCallback, type WheelEvent, type ReactElement } from 'react';
import type { GraphNode, GraphEdge } from '../../../lib/contracts/graph-query.types';
import type { GraphLayoutAlgorithm, GraphStyleConfig, GraphTheme, NodeShape } from '../lib/graphTypes';
import { DEFAULT_STYLE_CONFIG } from '../lib/graphTypes';
import { computeLayout } from '../lib/graphLayout';

interface GraphCanvasProps {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly selectedFile: string | null;
  readonly theme: GraphTheme;
  readonly onOpenFile: (path: string) => void;
  readonly layoutAlgorithm?: GraphLayoutAlgorithm;
  readonly styleConfig?: GraphStyleConfig;
  readonly resetLayoutSignal?: number;
  readonly fitToScreenSignal?: number;
  readonly recenterSignal?: number;
  readonly searchQuery?: string;
  readonly selectedNodeId?: string | null;
  readonly neighborNodeIds?: Set<string>;
  readonly onNodeClick?: (node: GraphNode) => void;
}

const NODE_RADIUS_BASE = 12;
const NODE_RADIUS_MAX = 24;
const STROKE_WIDTH = 2;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.08;
const FONT_SIZE = 12;
const GRID_PATTERN_ID = 'graph-grid';

function clampScale(value: number): number {
  return Math.max(1, Math.min(7, value));
}

function shapePoints(shape: NodeShape, x: number, y: number, radius: number): string {
  if (shape === 'diamond') {
    return `${x},${y - radius * 1.2} ${x + radius * 1.25},${y} ${x},${y + radius * 1.2} ${x - radius * 1.25},${y}`;
  }

  const angles = [-90, -30, 30, 90, 150, 210];
  return angles
    .map((angle) => {
      const radians = (angle * Math.PI) / 180;
      return `${x + Math.cos(radians) * radius * 1.2},${y + Math.sin(radians) * radius}`;
    })
    .join(' ');
}

interface NodeShapeProps {
  readonly shape: NodeShape;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly node: GraphNode;
  readonly isCurrent: boolean;
  readonly onClick: () => void;
  readonly title: string;
}

function NodeShapeElement({
  shape,
  x,
  y,
  radius,
  fill,
  stroke,
  strokeWidth,
  node,
  isCurrent,
  onClick,
  title,
}: NodeShapeProps): ReactElement {
  const commonProps = {
    className: 'graph-node-shape',
    'data-testid': 'graph-node',
    'data-graph-node-id': node.id,
    'data-graph-node-kind': node.kind,
    'data-current-file-node': isCurrent ? 'true' : 'false',
    fill,
    stroke,
    strokeWidth,
    style: { cursor: node.kind === 'file' ? 'pointer' : 'default' },
    onClick,
  };

  if (shape === 'circle') {
    return (
      <circle {...commonProps} cx={x} cy={y} r={radius}>
        <title>{title}</title>
      </circle>
    );
  }

  if (shape === 'hexagon' || shape === 'diamond') {
    return (
      <polygon {...commonProps} points={shapePoints(shape, x, y, radius)}>
        <title>{title}</title>
      </polygon>
    );
  }

  const width = shape === 'capsule' ? radius * 2.8 : radius * 2.35;
  const height = shape === 'capsule' ? radius * 1.45 : radius * 1.85;
  const rx = shape === 'rectangle' ? 2 : shape === 'capsule' ? height / 2 : 7;

  return (
    <rect {...commonProps} x={x - width / 2} y={y - height / 2} width={width} height={height} rx={rx}>
      <title>{title}</title>
    </rect>
  );
}

export function GraphCanvas({
  nodes,
  edges,
  selectedFile,
  theme,
  onOpenFile,
  layoutAlgorithm = 'force-directed',
  styleConfig = DEFAULT_STYLE_CONFIG,
  resetLayoutSignal = 0,
  fitToScreenSignal = 0,
  recenterSignal = 0,
  searchQuery,
  selectedNodeId,
  neighborNodeIds,
  onNodeClick,
}: GraphCanvasProps): ReactElement {
  const baseWidth = 700;
  const baseHeight = 500;

  const [zoom, setZoom] = useState(1);

  const layoutNodes = useMemo(
    () => computeLayout(nodes, edges, baseWidth, baseHeight, layoutAlgorithm),
    [nodes, edges, layoutAlgorithm, resetLayoutSignal],
  );

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map((n) => [n.id, n])),
    [layoutNodes],
  );

  useEffect(() => {
    setZoom(1);
  }, [fitToScreenSignal, recenterSignal]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick?.(node);
      if (node.kind === 'file' && node.relativePath) {
        onOpenFile(node.relativePath);
      }
    },
    [onNodeClick, onOpenFile],
  );

  const tooltipText = useCallback(
    (node: GraphNode): string =>
      `${node.label}\n入: ${node.backlinkCount}  出: ${node.linkCount}`,
    [],
  );

  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        const next = prev + delta;
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100));
      });
    },
    [],
  );

  const vbWidth = baseWidth / zoom;
  const vbHeight = baseHeight / zoom;
  const vbX = (baseWidth - vbWidth) / 2;
  const vbY = (baseHeight - vbHeight) / 2;
  const nodeSizeScale = clampScale(styleConfig.nodeSize);
  const edgeWidth = clampScale(styleConfig.edgeWidth);
  const fontSize = Math.max(9, Math.min(18, styleConfig.labelFontSize));
  const relationFontSize = Math.max(8, Math.min(16, styleConfig.labelFontSize - 1));
  const canvasBackground = styleConfig.canvasBackground || theme.background;

  return (
    <svg
      className="graph-canvas"
      data-testid="graph-canvas"
      data-graph-zoom={zoom.toFixed(2)}
      data-graph-layout={layoutAlgorithm}
      viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
      style={{ background: canvasBackground }}
      onWheel={handleWheel}
    >
      <defs>
        <pattern id={GRID_PATTERN_ID} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={theme.grid} strokeWidth="0.5" opacity="0.5" />
        </pattern>
      </defs>
      {styleConfig.showGrid && <rect width={baseWidth} height={baseHeight} fill={`url(#${GRID_PATTERN_ID})`} />}

      <g className="graph-edges">
        {edges.map((e, i) => {
          const s = nodeMap.get(e.source);
          const t = nodeMap.get(e.target);
          if (!s || !t) return null;
          const isUnresolved = e.kind === 'unresolved';
          const stroke = isUnresolved ? theme.edge.unresolved : styleConfig.edgeColor;
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;

          return (
            <g key={`e-${i}`} className="graph-edge-group">
              <line
                className="graph-edge"
                data-testid="graph-edge"
                data-graph-edge-kind={e.kind}
                data-graph-edge-source={e.source}
                data-graph-edge-target={e.target}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={stroke}
                strokeWidth={edgeWidth}
                strokeDasharray={isUnresolved ? '4,4' : undefined}
                opacity={0.6}
              />
              {styleConfig.showRelationLabels && e.label && (
                <text
                  className="graph-relation-label"
                  x={midX}
                  y={midY - 4}
                  fill={styleConfig.relationLabelColor}
                  fontSize={relationFontSize}
                  fontFamily="ui-serif, Georgia, serif"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {e.label.length > 14 ? `${e.label.slice(0, 13)}…` : e.label}
                </text>
              )}
            </g>
          );
        })}
      </g>

      <g className="graph-nodes">
        {nodes.map((n) => {
          const pos = nodeMap.get(n.id);
          if (!pos) return null;
          const isCurrent = selectedFile !== null && n.id === selectedFile;
          const isOrphan = n.kind === 'file' && n.isOrphan;
          const isUnresolved = n.kind === 'unresolved';

          let fill: string;
          let stroke: string;
          let strokeWidth: number;
          if (isCurrent) {
            fill = theme.node.current;
            stroke = theme.node.currentStroke;
            strokeWidth = 3;
          } else if (isUnresolved) {
            fill = theme.node.unresolved;
            stroke = theme.node.unresolvedStroke;
            strokeWidth = 1.5;
          } else if (isOrphan) {
            fill = theme.node.orphan;
            stroke = theme.node.orphanStroke;
            strokeWidth = 1;
          } else {
            fill = styleConfig.nodeColor;
            stroke = theme.node.fileStroke;
            strokeWidth = STROKE_WIDTH;
          }

          const radius = Math.min(
            NODE_RADIUS_BASE + (nodeSizeScale - 3) * 2 + n.backlinkCount,
            NODE_RADIUS_MAX + (nodeSizeScale - 3) * 2,
          );

          const nodeClass = [
            'graph-node',
            isCurrent ? 'graph-node-current' : '',
            n.kind === 'unresolved' ? 'graph-node-unresolved' : '',
          ].filter(Boolean).join(' ');

          return (
            <g key={n.id} className={nodeClass}>
              {isCurrent && (
                <circle
                  className="graph-node-halo"
                  cx={pos.x}
                  cy={pos.y}
                  r={radius + 7}
                  fill={theme.node.currentHalo}
                  stroke="none"
                />
              )}
              <NodeShapeElement
                shape={styleConfig.nodeShape}
                x={pos.x}
                y={pos.y}
                radius={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                node={n}
                isCurrent={isCurrent}
                onClick={() => handleNodeClick(n)}
                title={tooltipText(n)}
              />
              {styleConfig.showLabels && (
                <text
                  x={pos.x + radius + 6}
                  y={pos.y + fontSize / 3}
                  fill={isCurrent ? theme.node.label : styleConfig.labelColor}
                  fontSize={fontSize}
                  fontFamily="ui-serif, Georgia, serif"
                  fontWeight={isCurrent ? 700 : 400}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
