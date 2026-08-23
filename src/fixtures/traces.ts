import type { OtelSpan } from '../types';

// 200 ms trace: api-gateway → postgres query + redis cache write
export const simpleTrace: OtelSpan[] = [
  {
    traceId: 'abc123',
    spanId: 'root',
    name: 'GET /api/users',
    startTimeUnixNano: '1700000000000000000',
    endTimeUnixNano: '1700000000200000000',
    kind: 'SERVER',
    status: { code: 'OK' },
    resource: { 'service.name': 'api-gateway' },
  },
  {
    traceId: 'abc123',
    spanId: 'db-query',
    parentSpanId: 'root',
    name: 'SELECT users',
    startTimeUnixNano: '1700000000010000000',
    endTimeUnixNano: '1700000000090000000',
    kind: 'CLIENT',
    status: { code: 'OK' },
    attributes: { 'db.system': 'postgresql', 'db.statement': 'SELECT * FROM users LIMIT 50' },
    resource: { 'service.name': 'api-gateway' },
  },
  {
    traceId: 'abc123',
    spanId: 'cache-set',
    parentSpanId: 'root',
    name: 'cache.set users',
    startTimeUnixNano: '1700000000100000000',
    endTimeUnixNano: '1700000000120000000',
    kind: 'CLIENT',
    status: { code: 'OK' },
    attributes: { 'db.system': 'redis', 'db.operation': 'SET' },
    resource: { 'service.name': 'api-gateway' },
  },
];

// 500 ms trace with an ERROR span
export const errorTrace: OtelSpan[] = [
  {
    traceId: 'err456',
    spanId: 'root-err',
    name: 'POST /api/orders',
    startTimeUnixNano: '1700000001000000000',
    endTimeUnixNano: '1700000001500000000',
    kind: 'SERVER',
    status: { code: 'ERROR', message: 'Internal Server Error' },
    resource: { 'service.name': 'orders-service' },
  },
  {
    traceId: 'err456',
    spanId: 'payment-call',
    parentSpanId: 'root-err',
    name: 'POST /payment',
    startTimeUnixNano: '1700000001050000000',
    endTimeUnixNano: '1700000001450000000',
    kind: 'CLIENT',
    status: { code: 'ERROR', message: 'Payment gateway timeout' },
    attributes: { 'http.method': 'POST', 'http.status_code': 504 },
    resource: { 'service.name': 'orders-service' },
  },
  {
    traceId: 'err456',
    spanId: 'audit-log',
    parentSpanId: 'root-err',
    name: 'audit.write',
    startTimeUnixNano: '1700000001460000000',
    endTimeUnixNano: '1700000001490000000',
    kind: 'INTERNAL',
    status: { code: 'OK' },
    resource: { 'service.name': 'orders-service' },
  },
];

// 7-level deep nested trace
export const deepTrace: OtelSpan[] = buildDeepTrace(7);

// 50-span wide fan-out: one root with 49 sibling children
export const wideTrace: OtelSpan[] = buildWideTrace(50);

function buildDeepTrace(levels: number): OtelSpan[] {
  const spans: OtelSpan[] = [];
  let parentSpanId: string | undefined;
  for (let i = 0; i < levels; i++) {
    const spanId = `deep-${i}`;
    spans.push({
      traceId: 'deep789',
      spanId,
      parentSpanId,
      name: `level-${i} operation`,
      startTimeUnixNano: String(1700000002000000000 + i * 10_000_000),
      endTimeUnixNano: String(1700000002000000000 + (levels - i) * 10_000_000),
      kind: 'INTERNAL',
      status: { code: 'OK' },
      resource: { 'service.name': `svc-${i}` },
    });
    parentSpanId = spanId;
  }
  return spans;
}

function buildWideTrace(childCount: number): OtelSpan[] {
  const root: OtelSpan = {
    traceId: 'wide000',
    spanId: 'wide-root',
    name: 'fan-out root',
    startTimeUnixNano: '1700000003000000000',
    endTimeUnixNano: '1700000003500000000',
    kind: 'SERVER',
    status: { code: 'OK' },
    resource: { 'service.name': 'orchestrator' },
  };
  const children: OtelSpan[] = Array.from({ length: childCount - 1 }, (_, i) => ({
    traceId: 'wide000',
    spanId: `wide-child-${i}`,
    parentSpanId: 'wide-root',
    name: `worker-${i}`,
    startTimeUnixNano: String(1700000003010000000 + i * 1_000_000),
    endTimeUnixNano: String(1700000003010000000 + i * 1_000_000 + 400_000_000),
    kind: 'INTERNAL',
    status: { code: 'OK' },
    resource: { 'service.name': 'worker' },
  }));
  return [root, ...children];
}

/**
 * Generate a realistic branching trace for performance / virtualization testing.
 * Deterministic — no Math.random(). Every 15th span is an ERROR.
 */
export function generateLargeTrace(spanCount: number): OtelSpan[] {
  const services = ['gateway', 'users', 'orders', 'inventory', 'payments', 'notifications'];
  const base = 1700000010000000000;
  const spans: OtelSpan[] = [];
  let counter = 0;

  function add(parentId: string | undefined, depth: number, offsetMs: number, durationMs: number): void {
    if (counter >= spanCount) return;
    const id = counter;
    const spanId = `lg-${id}`;
    const service = services[id % services.length];
    spans.push({
      traceId: 'large',
      spanId,
      parentSpanId: parentId,
      name: `${service}.op-${id}`,
      startTimeUnixNano: String(base + offsetMs * 1_000_000),
      endTimeUnixNano: String(base + (offsetMs + durationMs) * 1_000_000),
      kind: depth === 0 ? 'SERVER' : 'INTERNAL',
      status: { code: id % 15 === 0 && id !== 0 ? 'ERROR' : 'OK' },
      resource: { 'service.name': service },
    });
    counter++;

    if (depth < 10) {
      const branches = depth < 3 ? 4 : 2;
      const childDur = Math.max(1, Math.floor((durationMs - 10) / branches));
      for (let i = 0; i < branches && counter < spanCount; i++) {
        add(spanId, depth + 1, offsetMs + 5 + i * childDur, childDur);
      }
    }
  }

  add(undefined, 0, 0, 2000);
  return spans;
}

export const largeTrace: OtelSpan[] = generateLargeTrace(1000);
