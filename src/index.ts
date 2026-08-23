export { TraceWaterfall } from './components/TraceWaterfall';
export type {
  TraceWaterfallProps,
  ZoomResetProps,
  SpanInspectProps,
  SpanComponentProps,
  ExpandComponentProps,
} from './components/TraceWaterfall';
export { SpanDetail } from './components/SpanDetail';
export { buildSpanTree } from './utils/buildSpanTree';
export { flattenTree } from './utils/flattenTree';
export { getTraceDomain, buildTimeScale, formatNanoDuration, nanoToDate } from './utils/timeScale';
export type { TimeScale } from './utils/timeScale';
export { useZoomPan } from './hooks/useZoomPan';
export type { ZoomDomain, UseZoomPanResult } from './hooks/useZoomPan';
export { defaultTheme, darkTheme } from './theme';
export type { ThemeTokens } from './theme';
export type {
  OtelSpan,
  SpanNode,
  FlatRow,
  SpanKind,
  SpanStatus,
  SpanStatusCode,
  AttributeValue,
} from './types';
