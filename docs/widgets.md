# Widgets

Widgets are the building blocks of a HAven dashboard. Each widget is a JSON object placed at an absolute pixel position on the canvas. They can display data, reflect entity state, respond to taps, and change appearance based on conditions.

---

## Contents

- [How Widgets Work](#how-widgets-work)
- [Base Properties](#base-properties)
- [Entity Binding](#entity-binding)
- [Widget Types](#widget-types)

---

## How Widgets Work

Every widget sits at a fixed `x`/`y` position with a fixed `w`/`h` size. Positions are in the design coordinate space. HAven scales the entire canvas uniformly to fit the screen, so a widget at `x: 500, y: 300` is always in the same relative position regardless of the physical screen size.

Widgets that bind to a HA entity register a callback when the page loads. When that entity changes in HA, only that widget updates. The rest of the page is untouched. This makes even busy dashboards with many entities very efficient.

Conditional overrides let any widget change its appearance based on entity state without writing any code. See the [Conditional Overrides](overrides.md) reference for full details.

---

## Base Properties

All widget types share these properties:

| Property | Description |
|----------|-------------|
| `id` | Unique string identifier for this widget within the page. |
| `type` | Widget type name (see table below). |
| `x` | Left edge position in pixels. |
| `y` | Top edge position in pixels. |
| `w` | Width in pixels. |
| `h` | Height in pixels. |
| `opacity` | Widget opacity from `0.0` (invisible) to `1.0` (fully opaque). Optional. |
| `border_width` | Border thickness in pixels. Optional. |
| `border_color` | Border color as a theme token or hex value. Optional. |
| `groupid` | Designer grouping hint. Ignored at runtime. |

---

## Entity Binding

Most widgets accept an `entity` property containing a HA entity ID. When bound:

- The widget fetches the current state on page load and renders immediately.
- It subscribes to `state_changed` events and updates whenever that entity changes.
- `overrides` rules are re-evaluated on every state change.

Some widgets also accept `entity2` for a second entity subscription. Both entities trigger re-evaluation of overrides when their state changes.

HAven also provides a small set of [internal entities](config-reference.md#internal-entities) (`internal.currentdtm`, `internal.connectionstatus`) that work identically to HA entities.

---

## Widget Types

| Type | Description | Detail |
|------|-------------|--------|
| `label` | Displays text. Supports live entity values, number formatting, icons, template expressions, and animations. The most versatile widget type. | [widget-label.md](widget-label.md) |
| `rectangle` | A filled rectangle for card backgrounds, overlays, and decorative elements. Supports solid color, linear gradients, and entity-driven styling. | [widget-rectangle.md](widget-rectangle.md) |
| `button` | A tappable button that reflects entity on/off state and calls a HA service on press. Icon and label auto-scale to button size. | [widget-button.md](widget-button.md) |
| `switch` | A sliding toggle switch that reflects and controls a binary entity state. Supports any two-value entity, not just `switch.*`. | [widget-switch.md](widget-switch.md) |
| `slider` | A draggable slider for controlling numeric values such as brightness, volume, or cover position. | [widget-slider.md](widget-slider.md) |
| `scene` | An option selector for entities with a fixed set of values. Renders as buttons, a dropdown, or a picker modal. | [widget-scene.md](widget-scene.md) |
| `bar` | A horizontal progress bar driven by a numeric entity value. Supports threshold-based color changes. | [widget-bar.md](widget-bar.md) |
| `arc` | An SVG circular gauge driven by a numeric entity value. Supports threshold-based colors and a center label. | [widget-arc.md](widget-arc.md) |
| `clock` | Displays the current time in HH:MM format, updated every second. No entity binding needed. | [widget-clock.md](widget-clock.md) |
| `image` | Displays a static image or a dynamic image from a HA entity attribute (e.g. media player album art). Optionally opens fullscreen on tap. | [widget-image.md](widget-image.md) |
| `camera` | Displays a camera feed with configurable preview modes (MJPEG, snapshot, poster, direct URL). Tapping opens a fullscreen HLS stream with audio. | [widget-camera.md](widget-camera.md) |
| `history_chart` | A vertical bar chart driven by HA long-term statistics. Supports daily, hourly, monthly, and yearly views with an optional fullscreen modal. | [widget-history-chart.md](widget-history-chart.md) |
| `agenda` | A scrollable event list from one or more HA calendar entities, with per-calendar colors, icons, and layout options. | [widget-agenda.md](widget-agenda.md) |
