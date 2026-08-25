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

// ── foldEvents option ────────────────────────────────────────────────────────

describe('flattenTree with foldEvents', () => {
  const spans: OtelSpan[] = [
    span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
    span({ spanId: 'child', name: 'child', parentSpanId: 'root', startTimeUnixNano: '2000', endTimeUnixNano: '8000' }),
    span({ spanId: 'ev1', name: 'ev1', parentSpanId: 'root', kind: 'EVENT', startTimeUnixNano: '3000', endTimeUnixNano: '3001' }),
    span({ spanId: 'ev2', name: 'ev2', parentSpanId: 'root', kind: 'EVENT', startTimeUnixNano: '5000', endTimeUnixNano: '5001' }),
  ];

  it('without foldEvents, EVENT children get their own rows', () => {
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root']));
    const ids = rows.map((r) => r.span.spanId);
    expect(ids).toContain('ev1');
    expect(ids).toContain('ev2');
  });

  it('with foldEvents, EVENT children produce no row of their own', () => {
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root']), { foldEvents: true });
    const ids = rows.map((r) => r.span.spanId);
    expect(ids).not.toContain('ev1');
    expect(ids).not.toContain('ev2');
  });

  it('with foldEvents, EVENT children appear on the parent row.events', () => {
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root']), { foldEvents: true });
    const rootRow = rows.find((r) => r.span.spanId === 'root')!;
    expect(rootRow.events).toHaveLength(2);
    expect(rootRow.events!.map((e) => e.spanId)).toEqual(['ev1', 'ev2']);
  });

  it('folded events keep start-time order', () => {
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root']), { foldEvents: true });
    const rootRow = rows.find((r) => r.span.spanId === 'root')!;
    const starts = rootRow.events!.map((e) => Number(e.startTimeUnixNano));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('a parent whose only children are EVENTs reports hasChildren: false', () => {
    const onlyEvents: OtelSpan[] = [
      span({ spanId: 'parent', name: 'parent', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
      span({ spanId: 'ev', name: 'ev', parentSpanId: 'parent', kind: 'EVENT', startTimeUnixNano: '2000', endTimeUnixNano: '2001' }),
    ];
    const roots = buildSpanTree(onlyEvents);
    const rows = flattenTree(roots, new Set(), { foldEvents: true });
    expect(rows[0].hasChildren).toBe(false);
  });

  it('a parent with both EVENT and INTERNAL children still expands to show only INTERNAL', () => {
    const roots = buildSpanTree(spans);
    const rows = flattenTree(roots, new Set(['root']), { foldEvents: true });
    const ids = rows.map((r) => r.span.spanId);
    expect(ids).toContain('child');
    expect(ids).not.toContain('ev1');
    expect(ids).not.toContain('ev2');
  });

  it('a parentless EVENT root still gets its own row', () => {
    const withRootEvent: OtelSpan[] = [
      span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
      span({ spanId: 'ev-root', name: 'ev-root', kind: 'EVENT', startTimeUnixNano: '2000', endTimeUnixNano: '2001' }),
    ];
    const roots = buildSpanTree(withRootEvent);
    const rows = flattenTree(roots, new Set(), { foldEvents: true });
    const ids = rows.map((r) => r.span.spanId);
    expect(ids).toContain('ev-root');
  });

  it('without foldEvents option, behaviour is identical to the 2-arg signature', () => {
    const roots = buildSpanTree(spans);
    const withoutOpt = flattenTree(roots, new Set(['root']));
    const withOpt = flattenTree(roots, new Set(['root']), {});
    expect(withoutOpt.map((r) => r.span.spanId)).toEqual(withOpt.map((r) => r.span.spanId));
  });
});
