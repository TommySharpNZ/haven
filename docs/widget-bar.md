# Widget: bar

The bar widget is a horizontal progress bar driven by a numeric HA entity value. It fills from left to right proportional to the entity value relative to a configured maximum. Fill color can change automatically based on thresholds or conditional override rules.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Entity Binding](#entity-binding)
- [Secondary Entity (entity2)](#secondary-entity-entity2)
- [Thresholds](#thresholds)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A battery level bar:

```json
{
  "id": "battery_bar",
  "type": "bar",
  "x": 20, "y": 20, "w": 280, "h": 20,
  "entity": "sensor.battery_level",
  "max": 100,
  "color": "primary",
  "background": "surface2",
  "radius": 4
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | HA entity ID. Drives the fill width and override conditions. |
| `entity2` | Secondary HA entity ID. Adds a second subscription for `state2`/`attribute2` override conditions. |
| `max` | Value at which the bar is completely filled. Default: `100`. |
| `color` | Fill color as a theme token or hex value. Default: `primary`. |
| `background` | Track background color as a theme token or hex value. Default: `surface2`. |
| `radius` | Corner radius in pixels for both the track and the fill. Default: `0`. |
| `thresholds` | Array of threshold rules that change the fill color based on the entity value. See [Thresholds](#thresholds). |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Entity Binding

Set `entity` to a numeric HA entity ID. The bar reads the entity state on page load from the cache and applies it immediately with no blank-frame flash on page navigation. It subscribes to `state_changed` events and updates the fill width on every change.

The fill width is calculated as `(state / max) * 100%`, clamped between 0% and 100%. Non-numeric states render as 0%.

---

## Secondary Entity (entity2)

`entity2` adds a subscription to a second HA entity. The bar re-evaluates all override rules when either entity changes. The fill width is always driven by `entity` (the primary). `entity2` only contributes through `state2` and `attribute2` override condition sources.

```json
{
  "entity":  "sensor.daily_energy",
  "entity2": "sensor.current_power",
  "max": 30,
  "color": "primary",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "above", "value": 5000 } ] },
      "set": { "color": "warning" }
    }
  ]
}
```

---

## Thresholds

Thresholds provide a concise way to change the fill color based on the raw entity value. Rules are evaluated in order and the first match wins. Comparisons use the raw numeric entity value, not the percentage fill.

Each threshold entry is an object with one of these keys:

| Key | Matches when |
|-----|-------------|
| `below` | entity value is less than the specified number |
| `above` | entity value is greater than the specified number |
| `equals` | entity value as a string equals the specified value |
| `default` | always matches; used as the fallback color when no other rule matches |

All entries also require a `color` field (theme token or hex value).

```json
"thresholds": [
  { "below": 20,  "color": "danger" },
  { "below": 50,  "color": "warning" },
  { "default": true, "color": "primary" }
]
```

In this example:
- Below 20: red (`danger`)
- Below 50: amber (`warning`)
- 50 and above: green (`primary`, the default)

> **Evaluation order matters.** Rules are checked top to bottom and the first match is used. Put more specific (lower threshold) rules before more general ones.

> **Thresholds vs overrides.** When both `thresholds` and an `overrides` rule apply, the override `color` takes priority. Use thresholds for simple value-based color changes and overrides when conditions involve attributes, a second entity, or page state.

---

## Conditional Overrides

Bars support the full override system. The following properties can be changed by override rules:

`color`

Condition sources available: `state`, `attribute`, `state2`, `attribute2`.

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Battery level with danger/warning thresholds

```json
{
  "id": "battery_bar",
  "type": "bar",
  "x": 20, "y": 20, "w": 280, "h": 16,
  "entity": "sensor.battery_level",
  "max": 100,
  "radius": 8,
  "background": "surface2",
  "thresholds": [
    { "below": 20, "color": "danger" },
    { "below": 50, "color": "warning" },
    { "default": true, "color": "primary" }
  ]
}
```

### Solar power as proportion of capacity

```json
{
  "id": "solar_bar",
  "type": "bar",
  "x": 20, "y": 50, "w": 280, "h": 20,
  "entity": "sensor.pv_power",
  "max": 5000,
  "color": "primary",
  "background": "surface2",
  "radius": 4
}
```

### Storage tank level with three zones

```json
{
  "id": "tank_level",
  "type": "bar",
  "x": 20, "y": 80, "w": 280, "h": 24,
  "entity": "sensor.water_tank_level",
  "max": 100,
  "radius": 4,
  "background": "surface2",
  "thresholds": [
    { "below": 25,  "color": "danger" },
    { "below": 60,  "color": "warning" },
    { "above": 59,  "color": "primary" }
  ]
}
```

### Color driven by a second entity via overrides

The bar shows daily energy total but turns warning-colored when current power draw is high:

```json
{
  "id": "energy_bar",
  "type": "bar",
  "x": 20, "y": 110, "w": 280, "h": 16,
  "entity": "sensor.daily_energy_total",
  "entity2": "sensor.current_power",
  "max": 30,
  "color": "primary",
  "background": "surface2",
  "radius": 4,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "above", "value": 8000 } ] },
      "set": { "color": "danger" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "above", "value": 4000 } ] },
      "set": { "color": "warning" }
    }
  ]
}
```
