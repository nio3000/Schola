/**
 * GraphNodeRenderer — Phase 5-UI-GRAPH-THEME-IMP-9.
 *
 * Renders individual graph nodes with shape support and pseudo-3D effects.
 */
import type { ReactElement } from 'react';
import type { GraphNode } from '../../../lib/contracts/graph-query.types';
import type { LayoutNode } from '../lib/graphLayout';
import type { GraphTheme } from '../lib/graphTypes';

export type NodeShape = 'circle' | 'rectangle' | 'rounded-rectangle' | 'capsule' | 'hexagon' | 'diamond';

export interface CustomNodeStyle {
  readonly shape: NodeShape;
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly strokeWidth: number;
  readonly shadow: boolean;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly opacity: number;
}

export const DEFAULT_NODE_STYLE: CustomNodeStyle = {
  shape: 'circle',
  fillColor: '#4a90d9',
  strokeColor: '#ffffff',
  strokeWidth: 2,
  shadow: true,
  glow: false,
  glowColor: 'transparent',
  opacity: 1,
};

export interface Pseudo3dConfig {
  readonly nodeShadow: boolean;
  readonly doubleStroke: boolean;
  readonly outerGlow: boolean;
  readonly depthLayer: boolean;
  readonly edgeDepth: boolean;
  readonly highlightPath: boolean;
  readonly centerEmphasis: boolean;
  readonly peripheralFade: boolean;
  readonly cardThickness: boolean;
}

export const PSEUDO_3D_DEFAULT: Pseudo3dConfig = {
  nodeShadow: true,
  doubleStroke: true,
  outerGlow: true,
  depthLayer: true,
  edgeDepth: true,
  highlightPath: true,
  centerEmphasis: true,
  peripheralFade: false,
  cardThickness: true,
};

export interface GraphNodeRendererProps {
  readonly layoutNode: LayoutNode;
  readonly graphNode: GraphNode;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly isCurrentFile: boolean;
  readonly nodeStyle: CustomNodeStyle;
  readonly pseudo3d: Pseudo3dConfig;
  readonly theme: GraphTheme;
  readonly radius: number;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
}

const FILTER_ID_BASE = 'graph-node-glow';

function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

export function GraphNodeRenderer({
  layoutNode,
  graphNode,
  isSelected,
  isHighlighted,
  isCurrentFile,
  nodeStyle,
  pseudo3d,
  theme,
  radius,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GraphNodeRendererProps): ReactElement {
  const { x, y } = layoutNode;
  const fill = isCurrentFile
    ? theme.node.current
    : nodeStyle.fillColor;
  const stroke = isSelected
    ? theme.node.hoverStroke
    : isHighlighted
      ? theme.node.hoverStroke
      : nodeStyle.strokeColor;
  const strokeW = isSelected || isHighlighted
    ? nodeStyle.strokeWidth + 1.5
    : nodeStyle.strokeWidth;
  const opacity = nodeStyle.opacity;
  const filterId = `${FILTER_ID_BASE}-${layoutNode.id}`;

  const shapeEl = renderShape(x, y, radius, nodeStyle.shape);

  return (
    <g
      className="graph-node-group"
      data-testid={`graph-node-${graphNode.id}`}
      data-node-id={graphNode.id}
      data-selected={isSelected}
      data-highlighted={isHighlighted}
      data-current-file={isCurrentFile}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer', opacity }}
    >
      {/* Card thickness effect — draw a slightly offset darker shape behind */}
      {pseudo3d.cardThickness && (
        <g transform={`translate(2, 2)`} opacity={0.15}>
          {shapeEl}
        </g>
      )}

      {/* Double stroke effect */}
      {pseudo3d.doubleStroke && (
        <g stroke={stroke} strokeWidth={strokeW + 2} fill="none" opacity={0.3}>
          {shapeEl}
        </g>
      )}

      {/* Main shape */}
      {renderShapeWithStyle(x, y, radius, nodeStyle.shape, fill, stroke, strokeW, opacity)}

      {/* Glow filter definition */}
      {(nodeStyle.glow || (isCurrentFile && pseudo3d.outerGlow)) && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isCurrentFile ? 6 : 3} result="blur" />
            <feFlood floodColor={isCurrentFile ? theme.node.currentHalo : nodeStyle.glowColor} floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Glow overlay */}
      {(nodeStyle.glow || (isCurrentFile && pseudo3d.outerGlow)) && (
        <g filter={`url(#${filterId})`}>
          {shapeEl}
        </g>
      )}

      {/* Center emphasis — slightly larger highlight circle */}
      {isCurrentFile && pseudo3d.centerEmphasis && (
        <circle
          cx={x}
          cy={y}
          r={radius + 3}
          fill="none"
          stroke={theme.node.currentStroke}
          strokeWidth={0.5}
          opacity={0.5}
        />
      )}

      {/* Label */}
      <text
        x={x}
        y={y + radius + 14}
        textAnchor="middle"
        fill={theme.node.label}
        fontSize={11}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {graphNode.label.length > 16
          ? `${graphNode.label.slice(0, 15)}…`
          : graphNode.label}
      </text>
    </g>
  );
}

function renderShape(
  cx: number,
  cy: number,
  r: number,
  shape: NodeShape,
): ReactElement {
  switch (shape) {
    case 'rectangle':
      return <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4} rx={0} />;
    case 'rounded-rectangle':
      return <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4} rx={6} />;
    case 'capsule':
      return <rect x={cx - r} y={cy - r * 0.6} width={r * 2} height={r * 1.2} rx={r * 0.6} />;
    case 'hexagon':
      return <polygon points={hexagonPoints(cx, cy, r)} />;
    case 'diamond':
      return <polygon points={diamondPoints(cx, cy, r)} />;
    case 'circle':
    default:
      return <circle cx={cx} cy={cy} r={r} />;
  }
}

function renderShapeWithStyle(
  cx: number,
  cy: number,
  r: number,
  shape: NodeShape,
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
): ReactElement {
  switch (shape) {
    case 'rectangle':
      return (
        <rect
          x={cx - r}
          y={cy - r * 0.7}
          width={r * 2}
          height={r * 1.4}
          rx={0}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    case 'rounded-rectangle':
      return (
        <rect
          x={cx - r}
          y={cy - r * 0.7}
          width={r * 2}
          height={r * 1.4}
          rx={6}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    case 'capsule':
      return (
        <rect
          x={cx - r}
          y={cy - r * 0.6}
          width={r * 2}
          height={r * 1.2}
          rx={r * 0.6}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    case 'hexagon':
      return (
        <polygon
          points={hexagonPoints(cx, cy, r)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={diamondPoints(cx, cy, r)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    case 'circle':
    default:
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
  }
}
