# Widget: clock

The clock widget displays the current local time in HH:MM format. It updates every second and requires no entity binding. It is the simplest way to add a live time display to a dashboard.

For more control over time formatting, date display, or combining time with other entity data, use a `label` widget bound to the `internal.currentdtm` entity instead.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Comparison: clock vs label with internal.currentdtm](#comparison-clock-vs-label-with-internalcurrentdtm)
- [Examples](#examples)

---

## Minimal Example

```json
{
  "id": "clock",
  "type": "clock",
  "x": 20, "y": 10, "w": 160, "h": 50,
  "font_size": 36,
  "color": "text"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `font_size` | Font size in pixels. Default: `22`. |
| `color` | Text color as a theme token or hex value. Default: `text`. |
| `background` | Background color as a theme token or hex value. Default: `transparent`. |

The clock widget does not support entity binding, overrides, or formatting options. All it does is display HH:MM in the device's local time zone, updated every second.

---

## Comparison: clock vs label with internal.currentdtm

HAven also provides the `internal.currentdtm` internal entity, which publishes an ISO timestamp once per minute. A `label` widget bound to this entity can display time, date, or both using the `format` property, and can use conditional overrides just like any other label.

| Feature | `clock` widget | `label` with `internal.currentdtm` |
|---------|---------------|-------------------------------------|
| Updates | Every second | Every minute |
| Formats | HH:MM only | `time_24`, `time_12`, `date_iso`, `date_short`, `datetime_24`, `datetime_12` |
| Template expressions | No | Yes |
| Conditional overrides | No | Yes |
| Config simplicity | Minimal | Requires `entity` and `format` |

Use the `clock` widget when you only need a simple HH:MM time display. Use a `label` with `internal.currentdtm` when you need a different format, a date, or appearance changes based on time.

---

## Examples

### Large clock

```json
{
  "id": "main_clock",
  "type": "clock",
  "x": 20, "y": 10, "w": 300, "h": 80,
  "font_size": 64,
  "color": "text"
}
```

### Clock with surface background

```json
{
  "id": "clock_card",
  "type": "clock",
  "x": 20, "y": 10, "w": 180, "h": 56,
  "font_size": 36,
  "color": "text",
  "background": "surface"
}
```

### Date and time using label with internal.currentdtm

For a date display or 12-hour format, use a label instead:

```json
{
  "id": "time_label",
  "type": "label",
  "x": 20, "y": 10, "w": 200, "h": 44,
  "entity": "internal.currentdtm",
  "format": "time_12",
  "font_size": 32,
  "align": "left",
  "color": "text"
}
```

```json
{
  "id": "date_label",
  "type": "label",
  "x": 20, "y": 54, "w": 200, "h": 28,
  "entity": "internal.currentdtm",
  "format": "date_short",
  "font_size": 18,
  "align": "left",
  "color": "text_muted"
}
```
