# Widget: arc

The arc widget is an SVG circular gauge driven by a numeric HA entity value. A colored arc fills from a start angle to an end angle proportional to the value between a configured minimum and maximum. A numeric value is displayed at the center, with an optional static label beneath it. Fill color supports thresholds and conditional overrides, and an optional marker can indicate a second value on the same arc.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Arc Geometry](#arc-geometry)
- [Center Label](#center-label)
- [Value Formatting](#value-formatting)
- [Attribute Source](#attribute-source)
- [Marker](#marker)
- [Thresholds](#thresholds)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A battery state of charge gauge:

```json
{
  "id": "battery_gauge",
  "type": "arc",
  "x": 60, "y": 20, "w": 160, "h": 160,
  "entity": "sensor.battery_state_of_charge",
  "min": 0,
  "max": 100,
  "color": "primary",
  "label": "Battery"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | HA entity ID. Drives the arc fill and the center value display. |
| `entity2` | Secondary HA entity ID. Adds a second subscription for `state2`/`attribute2` override conditions. |
| `min` | Value at which the arc is empty. Default: `0`. |
| `max` | Value at which the arc is full. Default: `100`. |
| `start_angle` | Angle in degrees where the arc begins. `0` = top, clockwise. Default: `135`. |
| `end_angle` | Angle in degrees where the arc ends. Default: `405` (135 + 270, giving a 270-degree sweep). |
| `line_width` | Stroke width of the arc in pixels. Default: `12`. |
| `color` | Arc fill color as a theme token or hex value. Also applied to the center value number. Default: `primary`. |
| `background` | Track (unfilled) arc color as a theme token or hex value. Default: `surface2`. |
| `label` | Static text shown below the center value. Optional. |
| `label_color` | Color of the static label text. Default: `text_muted`. |
| `format` | How to format the center value. Accepts the same format strings as the label widget. |
| `value_attribute` | Attribute key to read the value from instead of `state`. |
| `marker_value_attribute` | Attribute key for a second value shown as a marker dot or tick on the arc. |
| `marker_color` | Color of the marker. Default: `text`. |
| `marker_size` | Size of the marker in pixels. Defaults to approximately 90% of `line_width`. |
| `marker_style` | Marker shape: `dot` (default) or `tick`. |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `thresholds` | Array of threshold rules that change the arc fill color based on the entity value. See [Thresholds](#thresholds). |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Arc Geometry

The arc is drawn as an SVG path inside the widget bounds. The widget is square by convention: if `w` and `h` differ, the arc uses the smaller dimension.

`start_angle` and `end_angle` use degrees measured clockwise from the top (12 o'clock position). The default values of `135` and `405` produce the standard 270-degree gauge sweep:

```
         0 (top)
    315     45
  270         90
    225     135  ← start
         180
```

Common configurations:

| Style | `start_angle` | `end_angle` | Sweep |
|-------|--------------|------------|-------|
| Standard gauge (default) | `135` | `405` | 270° |
| Full circle | `0` | `360` | 360° |
| Half circle (bottom) | `180` | `360` | 180° |
| Half circle (top) | `0` | `180` | 180° |

```json
{ "start_angle": 135, "end_angle": 405 }
```

---

## Center Label

The center value is displayed automatically in a large bold font sized to approximately 22% of the widget's smaller dimension. The color matches the arc fill color and updates with it.

Add a static `label` to show a unit or description below the value. The label font size is approximately 11% of the widget's smaller dimension:

```json
{
  "label": "°C",
  "label_color": "text_muted"
}
```

The label text can be changed by override rules using the `label` override property.

---

## Value Formatting

The `format` property transforms the raw entity value shown at the center. It accepts the same format strings as the label widget:

| Format | Example output |
|--------|----------------|
| *(none)* | Raw state string |
| `power` | `948 w` or `1.23 kW` |
| `kwh` | `25.0 kWh` |
| `percent` | `89%` |

```json
{ "format": "power" }
```

---

## Attribute Source

Set `value_attribute` to read the arc value from an entity attribute rather than the top-level state:

```json
{
  "entity": "climate.living_room",
  "value_attribute": "current_temperature",
  "min": 10,
  "max": 35,
  "label": "°C"
}
```

---

## Marker

A marker can be placed on the arc to indicate a second value from the same entity, such as a target or setpoint alongside the current reading.

Set `marker_value_attribute` to the attribute that holds the second value. The marker is positioned on the arc at the corresponding angle.

```json
{
  "entity": "climate.living_room",
  "value_attribute": "current_temperature",
  "marker_value_attribute": "temperature",
  "min": 10,
  "max": 35,
  "marker_color": "warning",
  "marker_style": "tick",
  "marker_size": 14,
  "label": "°C"
}
```

### Marker styles

| `marker_style` | Appearance |
|----------------|------------|
| `dot` (default) | A filled circle sitting on the arc stroke |
| `tick` | A short perpendicular line crossing the arc stroke |

`marker_size` sets the diameter of the dot or the total length of the tick in pixels.

---

## Thresholds

Thresholds change the arc fill color and the center value color based on the raw entity value. Rules are evaluated in order and the first match wins. Comparisons use the raw numeric value, not the percentage fill.

| Key | Matches when |
|-----|-------------|
| `below` | entity value is less than the specified number |
| `above` | entity value is greater than the specified number |
| `equals` | entity value as a string equals the specified value |
| `default` | always matches; used as the fallback when no other rule matches |

```json
"thresholds": [
  { "below": 20,  "color": "danger" },
  { "below": 50,  "color": "warning" },
  { "default": true, "color": "primary" }
]
```

When a threshold matches, both the arc fill and the center number change to that color. When an override rule also sets `color`, the override takes priority over thresholds.

---

## Conditional Overrides

Arcs support the full override system. The following properties can be changed by override rules:

`color`, `background`, `label`, `label_color`, `opacity`, `marker_color`, `marker_style`, `marker_size`, `marker_value_attribute`

Condition sources available: `state`, `attribute`, `state2`, `attribute2`.

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Battery state of charge with thresholds

```json
{
  "id": "battery_gauge",
  "type": "arc",
  "x": 60, "y": 20, "w": 160, "h": 160,
  "entity": "sensor.battery_state_of_charge",
  "min": 0,
  "max": 100,
  "line_width": 14,
  "background": "surface2",
  "label": "Battery",
  "thresholds": [
    { "below": 20,  "color": "danger" },
    { "below": 50,  "color": "warning" },
    { "default": true, "color": "primary" }
  ]
}
```

### Solar power gauge

```json
{
  "id": "solar_gauge",
  "type": "arc",
  "x": 60, "y": 20, "w": 160, "h": 160,
  "entity": "sensor.pv_power",
  "min": 0,
  "max": 5000,
  "format": "power",
  "color": "primary",
  "background": "surface2",
  "line_width": 12,
  "label": "Solar"
}
```

### Climate temperature with setpoint marker

```json
{
  "id": "climate_gauge",
  "type": "arc",
  "x": 60, "y": 20, "w": 160, "h": 160,
  "entity": "climate.living_room",
  "value_attribute": "current_temperature",
  "marker_value_attribute": "temperature",
  "min": 15,
  "max": 30,
  "start_angle": 135,
  "end_angle": 405,
  "line_width": 12,
  "color": "primary",
  "background": "surface2",
  "marker_color": "warning",
  "marker_style": "tick",
  "label": "°C"
}
```

### Full-circle gauge

```json
{
  "id": "humidity_gauge",
  "type": "arc",
  "x": 60, "y": 20, "w": 140, "h": 140,
  "entity": "sensor.humidity",
  "min": 0,
  "max": 100,
  "start_angle": 0,
  "end_angle": 360,
  "line_width": 10,
  "color": "primary",
  "background": "surface2",
  "label": "%"
}
```

### Half-circle gauge

```json
{
  "id": "power_half",
  "type": "arc",
  "x": 20, "y": 40, "w": 200, "h": 120,
  "entity": "sensor.total_power",
  "min": 0,
  "max": 10000,
  "start_angle": 180,
  "end_angle": 360,
  "format": "power",
  "line_width": 14,
  "color": "warning",
  "background": "surface2",
  "label": "Load"
}
```
