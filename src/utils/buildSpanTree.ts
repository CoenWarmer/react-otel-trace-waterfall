import type { OtelSpan, SpanNode } from '../types';

export function buildSpanTree(spans: OtelSpan[]): SpanNode[] {
  if (spans.length === 0) return [];

  const nodeMap = new Map<string, SpanNode>();
  for (const span of spans) {
    nodeMap.set(span.spanId, { ...span, children: [], depth: 0 });
  }

  const roots: SpanNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentSpanId && nodeMap.has(node.parentSpanId)) {
      nodeMap.get(node.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  assignDepths(roots, 0, new Set());
  sortByStartTime(roots);

  return roots;
}

function assignDepths(nodes: SpanNode[], depth: number, ancestors: Set<string>): void {
  for (const node of nodes) {
    if (ancestors.has(node.spanId)) {
      console.warn(`[react-otel-trace-waterfall] Cycle detected at span "${node.spanId}", skipping subtree.`);
      continue;
    }
    node.depth = depth;
    const next = new Set(ancestors);
    next.add(node.spanId);
    assignDepths(node.children, depth + 1, next);
  }
}

function sortByStartTime(nodes: SpanNode[]): void {
  nodes.sort((a, b) => compareNano(a.startTimeUnixNano, b.startTimeUnixNano));
  for (const node of nodes) {
    sortByStartTime(node.children);
  }
}

function compareNano(a: string, b: string): number {
  const diff = BigInt(a) - BigInt(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}
