import { describe, it, expect } from 'vitest';
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

describe('buildSpanTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildSpanTree([])).toEqual([]);
  });

  it('returns a single root for a single span', () => {
    const result = buildSpanTree([span({ spanId: 's1', name: 'root' })]);
    expect(result).toHaveLength(1);
    expect(result[0].spanId).toBe('s1');
    expect(result[0].depth).toBe(0);
    expect(result[0].children).toHaveLength(0);
  });

  it('attaches children and assigns depths', () => {
    const spans = [
      span({ spanId: 'parent', name: 'parent', startTimeUnixNano: '1000', endTimeUnixNano: '3000' }),
      span({ spanId: 'child', name: 'child', parentSpanId: 'parent', startTimeUnixNano: '1500', endTimeUnixNano: '2500' }),
    ];
    const [root] = buildSpanTree(spans);
    expect(root.spanId).toBe('parent');
    expect(root.depth).toBe(0);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].spanId).toBe('child');
    expect(root.children[0].depth).toBe(1);
  });

  it('treats spans whose parent is not in the set as roots', () => {
    const spans = [
      span({ spanId: 's1', name: 'normal root' }),
      span({ spanId: 's2', name: 'orphan', parentSpanId: 'nonexistent' }),
    ];
    const result = buildSpanTree(spans);
    expect(result).toHaveLength(2);
  });

  it('sorts children by start time ascending', () => {
    const spans = [
      span({ spanId: 'p', name: 'parent', startTimeUnixNano: '1000', endTimeUnixNano: '5000' }),
      span({ spanId: 'c2', name: 'c2', parentSpanId: 'p', startTimeUnixNano: '2000', endTimeUnixNano: '3000' }),
      span({ spanId: 'c1', name: 'c1', parentSpanId: 'p', startTimeUnixNano: '1100', endTimeUnixNano: '1900' }),
    ];
    const [root] = buildSpanTree(spans);
    expect(root.children.map((c) => c.spanId)).toEqual(['c1', 'c2']);
  });

  it('handles deep nesting and assigns correct depths', () => {
    const spans = [
      span({ spanId: 'l0', name: 'l0', startTimeUnixNano: '1000', endTimeUnixNano: '5000' }),
      span({ spanId: 'l1', name: 'l1', parentSpanId: 'l0', startTimeUnixNano: '1100', endTimeUnixNano: '4900' }),
      span({ spanId: 'l2', name: 'l2', parentSpanId: 'l1', startTimeUnixNano: '1200', endTimeUnixNano: '4800' }),
      span({ spanId: 'l3', name: 'l3', parentSpanId: 'l2', startTimeUnixNano: '1300', endTimeUnixNano: '4700' }),
    ];
    const [root] = buildSpanTree(spans);
    expect(root.depth).toBe(0);
    expect(root.children[0].depth).toBe(1);
    expect(root.children[0].children[0].depth).toBe(2);
    expect(root.children[0].children[0].children[0].depth).toBe(3);
  });

  it('handles a wide fan-out (many children on one parent)', () => {
    const childCount = 30;
    const spans: OtelSpan[] = [
      span({ spanId: 'root', name: 'root', startTimeUnixNano: '1000', endTimeUnixNano: '9000' }),
      ...Array.from({ length: childCount }, (_, i) =>
        span({
          spanId: `child-${i}`,
          name: `child-${i}`,
          parentSpanId: 'root',
          startTimeUnixNano: String(1100 + i * 10),
          endTimeUnixNano: String(1200 + i * 10),
        })
      ),
    ];
    const [root] = buildSpanTree(spans);
    expect(root.children).toHaveLength(childCount);
  });

  it('does not crash or infinite-loop on 100-level deep chains', () => {
    const spans = Array.from({ length: 100 }, (_, i) =>
      span({
        spanId: `s${i}`,
        name: `span-${i}`,
        parentSpanId: i > 0 ? `s${i - 1}` : undefined,
        startTimeUnixNano: String(1000 + i),
        endTimeUnixNano: String(2000 + i),
      })
    );
    expect(() => buildSpanTree(spans)).not.toThrow();
    const [root] = buildSpanTree(spans);
    expect(root.spanId).toBe('s0');
  });

  it('drops both spans in a mutual cycle, leaving other roots intact', () => {
    // A→B and B→A: both get attached as each other's child, neither becomes a root.
    const spans = [
      span({ spanId: 'A', name: 'A', parentSpanId: 'B' }),
      span({ spanId: 'B', name: 'B', parentSpanId: 'A' }),
      span({ spanId: 'safe', name: 'safe root' }),
    ];
    const result = buildSpanTree(spans);
    expect(result).toHaveLength(1);
    expect(result[0].spanId).toBe('safe');
  });

  it('handles a single span with no parent', () => {
    const result = buildSpanTree([span({ spanId: 'solo', name: 'only span' })]);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(0);
  });
});
