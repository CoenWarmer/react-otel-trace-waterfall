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

| Prop                      | Type                                   | Default         | Notes                                                                     |
| ------------------------- | -------------------------------------- | --------------- | ------------------------------------------------------------------------- |
| `allowZoom`               | `boolean`                              | `true`          | Disables wheel + drag when false                                          |
| `disableInspectPanel`     | `boolean`                              | `false`         | Hides the built-in detail panel; `onSelectSpan` still fires on click      |
| `disableKeyboardControls` | `boolean`                              | `false`         |                                                                           |
| `EventMarkerComponent`    | `ComponentType<EventComponentProps>`   | diamond marker  | Custom marker for `EVENT` spans; receives `{ span, x, isSelected }`      |
| `ExpandComponent`         | `ComponentType<ExpandComponentProps>`  | ▸/▾ button      | Ignored when `SpanComponent` is set                                       |
| `FitButtonComponent`      | `ComponentType<FitButtonProps>`        | built-in button | Custom fit-to-width button; receives `{ onClick }`                        |
| `height`                  | `number \| string`                     | `'400px'`       |                                                                           |
| `initialState`            | `'collapsed' \| 'expanded'`            | `'collapsed'`   | Seeds initial expandedIds                                                 |
| `liveMode`                | `boolean`                              | internal        | When provided, controls following mode; omit to let component manage it   |
| `liveUpdateDuration`      | `number`                               | `300`           | Animation duration in ms when live mode receives new bounds; `0` to snap  |
| `liveUpdateEasing`        | `(t: number) => number`                | `easeOutCubic`  | Easing for the live update animation; see exported `easeOutCubic`         |
| `loading`                 | `boolean`                              | `false`         |                                                                           |
| `onCloseSpan`             | `() => void`                           | —               | Called when detail panel closes                                           |
| `onLiveModeChange`        | `(isLive: boolean) => void`            | —               | Fires when the user zooms (→ false) or resets (→ true)                    |
| `onSelectSpan`            | `(span: SpanNode \| null) => void`     | —               | Called on selection change, `null` on deselect                            |
| `onSpanHover`             | `(span: SpanNode \| null) => void`     | —               | Called on row pointer-enter; `null` on pointer-leave                      |
| `onZoomReset`             | `() => void`                           | —               | Called alongside zoom reset                                               |
| `RowPrefixComponent`      | `ComponentType<RowPrefixProps>`        | —               | Rendered before every row label; receives `{ row, isSelected, isNew }`    |
| `SkeletonComponent`       | `ComponentType`                        | built-in        | No props                                                                  |
| `SpanComponent`           | `ComponentType<SpanComponentProps>`    | `SpanRow`       | Full row replacement; wrapped for a11y                                    |
| `SpanInspectComponent`    | `ComponentType<SpanInspectProps>`      | `SpanDetail`    | Receives `{ span, onClose }`                                              |
| `spans`                   | `OtelSpan[]`                           | required        |                                                                           |
| `theme`                   | `Partial<ThemeTokens>`                 | `defaultTheme`  |                                                                           |
| `TooltipComponent`        | `ComponentType<SpanTooltipProps>`      | —               | Rendered near the cursor while hovering; receives `{ span }`              |
| `zoomLevel`               | `number`                               | `1`             | Initial zoom factor from trace centre; > 1 starts locked (not following)  |
| `ZoomResetComponent`      | `ComponentType<ZoomResetProps>`        | built-in button | Deprecated — use `FitButtonComponent` instead                             |
