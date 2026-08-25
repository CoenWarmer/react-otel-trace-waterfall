import type { FlatRow, SpanNode } from '../types';

export function flattenTree(
  roots: SpanNode[],
  expandedIds: Set<string>,
  options?: { foldEvents?: boolean },
): FlatRow[] {
  const fold = options?.foldEvents ?? false;
  const rows: FlatRow[] = [];

  function visit(nodes: SpanNode[]): void {
    for (const node of nodes) {
      const events = fold ? node.children.filter((c) => c.kind === 'EVENT') : [];
      const structural = fold
        ? node.children.filter((c) => c.kind !== 'EVENT')
        : node.children;

      // A node whose only children are folded events must not offer a chevron.
      const hasChildren = structural.length > 0;
      const isExpanded = expandedIds.has(node.spanId);
      rows.push({ span: node, hasChildren, isExpanded, events });

      if (hasChildren && isExpanded) visit(structural);
    }
  }

  visit(roots);
  return rows;
}
