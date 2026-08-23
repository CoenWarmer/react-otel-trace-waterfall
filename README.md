# React OTel Trace Waterfall

A component to render OTel spans in a trace.

**Customizable**: Highly configurable. See props below.

**Virtualized support**: Supports (very) complex spans.

**Themeable**: Adjust most of what you can see.

**Live mode**: Supports following behavior.

**Inspectable spans**: (Customizable) inspect panel.

**Keyboard support**: Supports keyboard controls.

## Dependencies

Built on:

- `d3-scale`
- `Tanstack Virtualized`

## Props

| Prop                      | Type                                  | Default         | Notes                                                                    |
| ------------------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `spans`                   | `OtelSpan[]`                          | required        |                                                                          |
| `height`                  | `number \| string`                    | `'400px'`       |                                                                          |
| `loading`                 | `boolean`                             | `false`         |                                                                          |
| `theme`                   | `Partial<ThemeTokens>`                | `defaultTheme`  |                                                                          |
| `allowZoom`               | `boolean`                             | `true`          | Disables wheel + drag when false                                         |
| `zoomLevel`               | `number`                              | `1`             | Initial zoom factor from trace centre; > 1 starts locked (not following) |
| `liveMode`                | `boolean`                             | internal        | When provided, controls following mode; omit to let component manage it  |
| `onLiveModeChange`        | `(isLive: boolean) => void`           | —               | Fires when the user zooms (→ false) or resets (→ true)                   |
| `FitButtonComponent`      | `ComponentType<FitButtonProps>`       | built-in button | Custom fit-to-width button; receives `{ onClick }`                       |
| `ZoomResetComponent`      | `ComponentType<ZoomResetProps>`       | built-in button | Deprecated — use `FitButtonComponent` instead                            |
| `onZoomReset`             | `() => void`                          | —               | Called alongside zoom reset                                              |
| `onSelectSpan`            | `(span: SpanNode \| null) => void`    | —               | Called on selection change, `null` on deselect                           |
| `onSpanHover`             | `(span: SpanNode \| null) => void`    | —               | Called on row pointer-enter; `null` on pointer-leave                     |
| `TooltipComponent`        | `ComponentType<SpanTooltipProps>`     | —               | Rendered near the cursor while hovering; receives `{ span }`             |
| `SpanInspectComponent`    | `ComponentType<SpanInspectProps>`     | `SpanDetail`    | Receives `{ span, onClose }`                                             |
| `RowPrefixComponent`      | `ComponentType<RowPrefixProps>`       | —               | Rendered before every row label; receives `{ row, isSelected, isNew }`   |
| `SpanComponent`           | `ComponentType<SpanComponentProps>`   | `SpanRow`       | Full row replacement; wrapped for a11y                                   |
| `onCloseSpan`             | `() => void`                          | —               | Called when detail panel closes                                          |
| `SkeletonComponent`       | `ComponentType`                       | built-in        | No props                                                                 |
| `disableInspectPanel`     | `boolean`                             | `false`         | Hides the built-in detail panel; `onSelectSpan` still fires on click     |
| `disableKeyboardControls` | `boolean`                             | `false`         |                                                                          |
| `initialState`            | `'collapsed' \| 'expanded'`           | `'collapsed'`   | Seeds initial expandedIds                                                |
| `ExpandComponent`         | `ComponentType<ExpandComponentProps>` | ▸/▾ button      | Ignored when `SpanComponent` is set                                      |
