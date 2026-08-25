export { TraceWaterfall } from './components/TraceWaterfall';
export type {
  TraceWaterfallProps,
  ZoomResetProps,
  FitButtonProps,
  SpanInspectProps,
  SpanTooltipProps,
  SpanComponentProps,
  ExpandComponentProps,
  RowPrefixProps,
  EventComponentProps,
} from './components/TraceWaterfall';
export { SpanDetail } from './components/SpanDetail';
export { buildSpanTree } from './utils/buildSpanTree';
export { flattenTree } from './utils/flattenTree';
export { getTraceDomain, buildTimeScale, formatNanoDuration, nanoToDate } from './utils/timeScale';
export type { TimeScale } from './utils/timeScale';
export { useZoomPan, easeOutCubic } from './hooks/useZoomPan';
export type { ZoomDomain, UseZoomPanResult, UseZoomPanOptions } from './hooks/useZoomPan';
export { ThemeContext, useTheme } from './ThemeContext';
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
