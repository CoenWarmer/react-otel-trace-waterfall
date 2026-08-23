import type { FlatRow, SpanNode } from '../types';

export function flattenTree(roots: SpanNode[], expandedIds: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];

  function visit(nodes: SpanNode[]): void {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.spanId);
      rows.push({ span: node, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        visit(node.children);
      }
    }
  }

  visit(roots);
  return rows;
}
