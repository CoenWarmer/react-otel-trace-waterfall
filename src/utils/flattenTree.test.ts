import { describe, it, expect } from 'vitest';
import { flattenTree } from './flattenTree';
import { buildSpanTree } from './buildSpanTree';
import type { OtelSpan } from '../types';

function span(overrides: Partial<OtelSpan> & Pick<OtelSpan, 'spanId' | 'name'>): OtelSpan {
  return {
    traceId: 'trace-1',
    startTimeUnixNano: '1000000000',
    endTimeUnixNano: '2000000000',
    ...overrides,
  };
}

const threeSpans: OtelSpan[] = [
  span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '5000' }),
  span({ spanId: 'c1', name: 'c1', parentSpanId: 'root', startTimeUnixNano: '1100', endTimeUnixNano: '2000' }),
  span({ spanId: 'c2', name: 'c2', parentSpanId: 'root', startTimeUnixNano: '2100', endTimeUnixNano: '3000' }),
];

describe('flattenTree', () => {
  it('returns empty array for empty roots', () => {
    expect(flattenTree([], new Set())).toEqual([]);
  });

  it('returns only roots when none are expanded', () => {
    const roots = buildSpanTree(threeSpans);
    const rows = flattenTree(roots, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].span.spanId).toBe('root');
    expect(rows[0].hasChildren).toBe(true);
    expect(rows[0].isExpanded).toBe(false);
  });

  it('includes children when parent is in expandedIds', () => {
    const roots = buildSpanTree(threeSpans);
    const rows = flattenTree(roots, new Set(['root']));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.span.spanId)).toEqual(['root', 'c1', 'c2']);
  });

  it('marks hasChildren correctly for leaf spans', () => {
    const roots = buildSpanTree(threeSpans);
    const rows = flattenTree(roots, new Set(['root']));
    expect(rows[1].hasChildren).toBe(false);
    expect(rows[2].hasChildren).toBe(false);
  });

  it('excludes collapsed subtrees from row count', () => {
    // root → c1 → grandchild, c2
    const spans: OtelSpan[] = [
      span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
      span({ spanId: 'c1', name: 'c1', parentSpanId: 'root', startTimeUnixNano: '1100', endTimeUnixNano: '4000' }),
      span({ spanId: 'gc', name: 'gc', parentSpanId: 'c1', startTimeUnixNano: '1200', endTimeUnixNano: '3900' }),
      span({ spanId: 'c2', name: 'c2', parentSpanId: 'root', startTimeUnixNano: '4100', endTimeUnixNano: '8000' }),
    ];
    const roots = buildSpanTree(spans);

    // Expand root only — grandchild must not appear since c1 is collapsed
    const rows = flattenTree(roots, new Set(['root']));
    expect(rows.map((r) => r.span.spanId)).toEqual(['root', 'c1', 'c2']);
    expect(rows).toHaveLength(3);
  });

  it('shows grandchildren when both parent and grandparent are expanded', () => {
    const spans: OtelSpan[] = [
      span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
      span({ spanId: 'c1', name: 'c1', parentSpanId: 'root', startTimeUnixNano: '1100', endTimeUnixNano: '4000' }),
      span({ spanId: 'gc', name: 'gc', parentSpanId: 'c1', startTimeUnixNano: '1200', endTimeUnixNano: '3900' }),
    ];
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root', 'c1']));
    expect(rows.map((r) => r.span.spanId)).toEqual(['root', 'c1', 'gc']);
  });

  it('preserves depth on FlatRow.span', () => {
    const roots = buildSpanTree(threeSpans);
    const rows = flattenTree(roots, new Set(['root']));
    expect(rows[0].span.depth).toBe(0);
    expect(rows[1].span.depth).toBe(1);
    expect(rows[2].span.depth).toBe(1);
  });

  it('handles a single leaf span', () => {
    const roots = buildSpanTree([span({ spanId: 'solo', name: 'solo' })]);
    const rows = flattenTree(roots, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].hasChildren).toBe(false);
    expect(rows[0].isExpanded).toBe(false);
  });
});
