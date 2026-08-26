export interface ThemeTokens {
  /** Outer container and panel borders */
  borderColor: string;
  /** Info bar and time-axis header background */
  headerBackground: string;
  /** Info bar text */
  headerText: string;
  /** Row divider lines */
  rowBorder: string;
  /** Selected row background */
  rowSelectedBackground: string;
  /** Keyboard focus ring color (inset box-shadow) */
  rowFocusRing: string;
  /** Span name label text */
  spanNameColor: string;
  /** Span name text when status is ERROR */
  spanNameErrorColor: string;
  /** Palette cycled by service name to color bars */
  barPalette: readonly string[];
  /** Bar color for ERROR spans */
  barErrorColor: string;
  /** Time axis tick mark color */
  axisTickColor: string;
  /** Time axis tick label color */
  axisLabelColor: string;
  /** Expand/collapse chevron color */
  chevronColor: string;
  /** Detail panel background */
  detailBackground: string;
  /** Detail panel title text */
  detailTitleColor: string;
  /** Detail panel section heading text */
  detailSectionHeadingColor: string;
  /** Detail panel key column text */
  detailKeyColor: string;
  /** Detail panel value column text */
  detailValueColor: string;
  /** Per-depth-level indentation of span labels in px */
  rowIndentPx: number;
  /** Base inline (left) padding of span labels in px */
  rowPaddingInline: number;
  /** Border radius on the outer container and detail panel */
  borderRadius: string;
  /** Loading skeleton placeholder color */
  skeletonColor: string;
  /**
   * Background color for the "new span" flash animation played when a row appears during a live
   * trace. Set to 'transparent' to disable the animation.
   */
  newRowHighlightColor: string;
  /**
   * Fill color for event markers. Empty string uses the same barPalette cycling as regular bars
   * (keyed by service name).
   */
  eventMarkerColor: string;
  /** Diameter of event markers in px. */
  eventMarkerSize: number;
  /**
   * Transparent padding (px) added on every side of the bar's click target to make
   * narrow bars easier to aim at. Does not affect the visual bar size.
   * Default 4.
   */
  barHitPaddingPx: number;
  /** Font size (px) for span name labels in the label column. Default 12. */
  spanNameFontSize: number;
}

export const defaultTheme: ThemeTokens = {
  borderColor: '#e2e8f0',
  headerBackground: '#f7fafc',
  headerText: '#718096',
  rowBorder: '#f7fafc',
  rowSelectedBackground: '#ebf8ff',
  rowFocusRing: '#4299e1',
  spanNameColor: '#2d3748',
  spanNameErrorColor: '#e53e3e',
  barPalette: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#4fd1c5', '#667eea', '#f6ad55'],
  barErrorColor: '#fc8181',
  axisTickColor: '#cbd5e0',
  axisLabelColor: '#718096',
  chevronColor: '#4a5568',
  detailBackground: '#ffffff',
  detailTitleColor: '#1a202c',
  detailSectionHeadingColor: '#a0aec0',
  detailKeyColor: '#718096',
  detailValueColor: '#2d3748',
  rowIndentPx: 14,
  rowPaddingInline: 4,
  borderRadius: '6px',
  skeletonColor: '#edf2f7',
  newRowHighlightColor: '#bee3f8',
  eventMarkerColor: '',
  eventMarkerSize: 10,
  barHitPaddingPx: 4,
  spanNameFontSize: 12,
};

export const darkTheme: ThemeTokens = {
  borderColor: '#2d3748',
  headerBackground: '#1a202c',
  headerText: '#718096',
  rowBorder: '#1a202c',
  rowSelectedBackground: '#2a4365',
  rowFocusRing: '#63b3ed',
  spanNameColor: '#e2e8f0',
  spanNameErrorColor: '#fc8181',
  barPalette: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#4fd1c5', '#667eea', '#f6ad55'],
  barErrorColor: '#fc8181',
  axisTickColor: '#4a5568',
  axisLabelColor: '#718096',
  chevronColor: '#a0aec0',
  detailBackground: '#1a202c',
  detailTitleColor: '#e2e8f0',
  detailSectionHeadingColor: '#4a5568',
  detailKeyColor: '#718096',
  detailValueColor: '#cbd5e0',
  rowIndentPx: 14,
  rowPaddingInline: 4,
  borderRadius: '6px',
  skeletonColor: '#2d3748',
  newRowHighlightColor: '#2a4365',
  eventMarkerColor: '',
  eventMarkerSize: 10,
  barHitPaddingPx: 4,
  spanNameFontSize: 12,
};
