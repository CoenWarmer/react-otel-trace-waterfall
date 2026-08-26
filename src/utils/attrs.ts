import type { SpanNode } from '../types';

/**
 * Return the value of `key` from the span's attributes or resource as a
 * string, or undefined if absent or not a string. Checks attributes first,
 * then resource.
 */
export function stringAttr(span: SpanNode, key: string): string | undefined {
  const v = span.attributes?.[key] ?? span.resource?.[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Return the value of `key` from the span's attributes or resource as a
 * number, or undefined if absent or not a number. Checks attributes first,
 * then resource.
 */
export function numberAttr(span: SpanNode, key: string): number | undefined {
  const v = span.attributes?.[key] ?? span.resource?.[key];
  return typeof v === 'number' ? v : undefined;
}
