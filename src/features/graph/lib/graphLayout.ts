/**
 * Graph layout algorithms — Phase 5-UI-GRAPH-THEME-IMP-7.
 *
 * Provides three 2D layout algorithms:
 *   1. Force-directed (Fruchterman-Reingold) — existing
 *   2. Hierarchical (top-down tree) — new
 *   3. Circular (radial arrangement) — new
 *
 * All algorithms are pure TypeScript; no D3, no Three.js, no external deps.
 */
import type { GraphNode, GraphEdge } from '../../../lib/contracts/graph-query.types';
import type { GraphLayoutAlgorithm } from './graphTypes';

export type { GraphLayoutAlgorithm };

export const DEFAULT_LAYOUT: GraphLayoutAlgorithm = 'force-directed';

export interface LayoutNode {
  readonly id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/* ── Force-directed ──────────────────────────────────────── */

const ITERATIONS = 200;
const REPULSION = 6000;
const ATTRACTION = 0.005;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.002;

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeForceDirectedLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  const rand = mulberry32(42);
  const layoutNodes: LayoutNode[] = nodes.map((n) => ({
    id: n.id,
    x: (0.3 + rand() * 0.4) * width,
    y: (0.3 + rand() * 0.4) * height,
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
  const edgePairs = edges
    .map((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      return s && t ? { s, t } : null;
    })
    .filter((p): p is { s: LayoutNode; t: LayoutNode } => p !== null);

  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < ITERATIONS; i++) {
    for (let a = 0; a < layoutNodes.length; a++) {
      for (let b = a + 1; b < layoutNodes.length; b++) {
        const na = layoutNodes[a];
        const nb = layoutNodes[b];
        const dx = na.x - nb.x;
        const dy = na.y - nb.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;
        na.vx += fx;
        na.vy += fy;
        nb.vx -= fx;
        nb.vy -= fy;
      }
    }

    for (const { s, t } of edgePairs) {
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = ATTRACTION * dist;
      const fx = (force * dx) / Math.max(dist, 1);
      const fy = (force * dy) / Math.max(dist, 1);
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (const n of layoutNodes) {
      n.vx += (cx - n.x) * CENTER_GRAVITY;
      n.vy += (cy - n.y) * CENTER_GRAVITY;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return layoutNodes;
}

/* ── Hierarchical (top-down tree) ────────────────────────── */

const H_LEVEL_GAP = 90;
const H_NODE_GAP = 70;
const H_MARGIN_X = 60;
const H_MARGIN_Y = 40;

/**
 * BFS-based level assignment. Root nodes (no incoming edges) start at level 0.
 */
function assignLevels(
  nodeIds: Set<string>,
  edges: readonly GraphEdge[],
): Map<string, number> {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjList.set(id, []);
    inDegree.set(id, 0);
  }
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adjList.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }

  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      levels.set(id, 0);
      queue.push(id);
    }
  }

  // If no roots (all have incoming edges), pick the first node as root
  if (queue.length === 0 && nodeIds.size > 0) {
    const first = nodeIds.values().next().value!;
    levels.set(first, 0);
    queue.push(first);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) ?? 0;
    for (const neighbor of adjList.get(current) ?? []) {
      if (!levels.has(neighbor) || (levels.get(neighbor) ?? 0) <= currentLevel) {
        levels.set(neighbor, currentLevel + 1);
        queue.push(neighbor);
      }
    }
  }

  // Assign remaining unvisited nodes
  let maxLevel = 0;
  for (const l of levels.values()) maxLevel = Math.max(maxLevel, l);
  for (const id of nodeIds) {
    if (!levels.has(id)) {
      levels.set(id, maxLevel + 1);
    }
  }

  return levels;
}

export function computeHierarchicalLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const levels = assignLevels(nodeIds, edges);

  const nodesByLevel = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const level = levels.get(n.id) ?? 0;
    const arr = nodesByLevel.get(level) ?? [];
    arr.push(n);
    nodesByLevel.set(level, arr);
  }

  const maxLevel = Math.max(...nodesByLevel.keys(), 1);
  const usableHeight = height - H_MARGIN_Y * 2;
  const levelSpacing = Math.min(H_LEVEL_GAP, usableHeight / Math.max(maxLevel + 1, 1));
  const totalHeight = levelSpacing * maxLevel;
  const startY = H_MARGIN_Y + (usableHeight - totalHeight) / 2;

  const layoutNodes: LayoutNode[] = [];

  for (const [level, levelNodes] of nodesByLevel) {
    const count = levelNodes.length;
    const usableWidth = width - H_MARGIN_X * 2;
    const nodeSpacing = Math.min(H_NODE_GAP, usableWidth / Math.max(count + 1, 1));
    const totalWidth = nodeSpacing * (count - 1);
    const startX = H_MARGIN_X + (usableWidth - totalWidth) / 2;

    levelNodes.forEach((n, i) => {
      layoutNodes.push({
        id: n.id,
        x: count === 1 ? width / 2 : startX + i * nodeSpacing,
        y: startY + level * levelSpacing,
        vx: 0,
        vy: 0,
      });
    });
  }

  return layoutNodes;
}

/* ── Circular (radial) ───────────────────────────────────── */

const C_RADIUS_BASE = 180;
const C_RADIUS_PER_NODE = 4;

function nodeConnectivitySum(nodeId: string, edges: readonly GraphEdge[]): number {
  let sum = 0;
  for (const e of edges) {
    if (e.source === nodeId) sum++;
    if (e.target === nodeId) sum++;
  }
  return sum;
}

export function computeCircularLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const count = nodes.length;

  if (count === 0) return [];
  if (count === 1) {
    return [{ id: nodes[0].id, x: cx, y: cy, vx: 0, vy: 0 }];
  }

  // Sort by connectivity — most connected nodes first
  const sorted = [...nodes].sort(
    (a, b) => nodeConnectivitySum(b.id, edges) - nodeConnectivitySum(a.id, edges),
  );

  const radius = Math.min(
    C_RADIUS_BASE + count * C_RADIUS_PER_NODE,
    Math.min(width, height) * 0.4,
  );

  const layoutNodes: LayoutNode[] = [];
  const angleStep = (2 * Math.PI) / count;

  sorted.forEach((n, i) => {
    const angle = i * angleStep - Math.PI / 2; // Start from top
    layoutNodes.push({
      id: n.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });

  return layoutNodes;
}

/* ── Unified entry ───────────────────────────────────────── */

export function computeLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
  algorithm?: GraphLayoutAlgorithm,
): LayoutNode[] {
  switch (algorithm) {
    case 'hierarchical':
      return computeHierarchicalLayout(nodes, edges, width, height);
    case 'circular':
      return computeCircularLayout(nodes, edges, width, height);
    case 'force-directed':
    default:
      return computeForceDirectedLayout(nodes, edges, width, height);
  }
}

export const resetLayout = computeLayout;
