# Widget: rectangle

The rectangle widget is the foundation of HAven layouts. Use it to build card backgrounds, section dividers, colored overlays, and tappable zones. It can be driven by a HA entity to change color, opacity, or border dynamically, and it passes pointer events through to widgets underneath when no action is configured.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Fills: Background and Gradient](#fills-background-and-gradient)
- [Border](#border)
- [Entity Binding](#entity-binding)
- [Secondary Entity (entity2)](#secondary-entity-entity2)
- [Actions and Tappable Zones](#actions-and-tappable-zones)
- [Pointer Events Pass-through](#pointer-events-pass-through)
- [Animations](#animations)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A plain card background:

```json
{
  "id": "card_bg",
  "type": "rectangle",
  "x": 10, "y": 10, "w": 300, "h": 180,
  "background": "surface",
  "radius": 12
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `background` | Fill color as a theme token or hex value. Ignored when `gradient` is set. |
| `gradient` | Gradient fill object. Takes priority over `background`. See [Fills](#fills-background-and-gradient). |
| `radius` | Corner radius in pixels. |
| `opacity` | Overall opacity from `0.0` (invisible) to `1.0` (fully opaque). |
| `border_width` | Border thickness in pixels. Set to `0` for no border. |
| `border_color` | Border color as a theme token or hex value. |
| `entity` | Primary HA entity ID. Drives override conditions and re-renders on state change. |
| `entity2` | Secondary HA entity ID. Adds a second subscription for `state2`/`attribute2` override conditions. |
| `action` | Action to perform when tapped. See [Actions and Tappable Zones](#actions-and-tappable-zones). |
| `animation` | Optional animation applied to the rectangle. See [Animations](#animations). |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Fills: Background and Gradient

### Solid fill

Set `background` to a theme token or hex color:

```json
"background": "surface"
"background": "#1a2030"
"background": "rgba(0,0,0,0.5)"
```

### Gradient fill

Set `gradient` to an object with `from` and `to` colors. When `gradient` is present it overrides `background`.

```json
{
  "gradient": {
    "from": "surface",
    "to": "#000000",
    "angle": 180,
    "start_pct": 0,
    "end_pct": 100
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `from` | required | Start color (theme token or hex). |
| `to` | required | End color (theme token or hex). |
| `angle` | `180` | Gradient direction in degrees. `0` = bottom to top, `90` = right to left, `180` = top to bottom, `270` = left to right. |
| `start_pct` | `60` | Position (0-100) where the gradient transition begins. |
| `end_pct` | `100` | Position (0-100) where the gradient transition ends. |

A common use is a dark-to-transparent overlay over a background image:

```json
{
  "gradient": {
    "from": "rgba(0,0,0,0.8)",
    "to": "rgba(0,0,0,0)",
    "angle": 180,
    "start_pct": 40,
    "end_pct": 100
  }
}
```

---

## Border

Add a visible border with `border_width` and `border_color`:

```json
{
  "type": "rectangle",
  "x": 10, "y": 10, "w": 300, "h": 180,
  "background": "surface",
  "radius": 12,
  "border_width": 2,
  "border_color": "primary"
}
```

Both properties can be changed by override rules, making it straightforward to highlight a card when an entity enters a particular state.

---

## Entity Binding

Set `entity` to drive the rectangle's appearance from a HA entity. The rectangle does not display text or a value - the entity only serves as the source for override conditions. The rectangle re-renders whenever the entity state changes.

```json
{
  "id": "motion_highlight",
  "type": "rectangle",
  "x": 10, "y": 10, "w": 300, "h": 180,
  "background": "surface",
  "radius": 12,
  "entity": "binary_sensor.hallway_motion",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "background": "warning", "border_width": 2, "border_color": "danger" }
    }
  ]
}
```

---

## Secondary Entity (entity2)

`entity2` registers a second subscription. Overrides are re-evaluated when either entity changes. `state2` and `attribute2` condition sources reference the secondary entity.

```json
{
  "id": "climate_card",
  "type": "rectangle",
  "x": 10, "y": 10, "w": 300, "h": 180,
  "background": "surface",
  "radius": 12,
  "entity": "climate.living_room",
  "entity2": "sensor.living_room_temperature",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "heating" } ] },
      "set": { "border_color": "warning", "border_width": 2 }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "above", "value": 24 } ] },
      "set": { "border_color": "danger", "border_width": 2 }
    }
  ]
}
```

---

## Actions and Tappable Zones

Add an `action` to make the rectangle respond to taps. The same action types used by buttons apply here:

```json
{
  "id": "nav_zone",
  "type": "rectangle",
  "x": 0, "y": 600, "w": 340, "h": 168,
  "background": "surface",
  "radius": 0,
  "action": { "type": "navigate", "page": 2 }
}
```

```json
"action": { "type": "service", "service": "light.toggle", "entity_id": "light.living_room" }
"action": { "type": "automation", "entity_id": "automation.good_night" }
```

When tapped, the rectangle briefly dims (opacity feedback) before triggering the action.

---

## Pointer Events Pass-through

When no `action` is set, the rectangle has `pointer-events: none` applied automatically. Taps and touches pass through to whatever widget lies beneath. This means you can safely use rectangles as decorative card backgrounds behind buttons, labels, and other interactive widgets without blocking their inputs.

Once you add an `action`, the rectangle becomes interactive and captures pointer events.

---

## Animations

The `animation` property applies a CSS animation to the rectangle. Animations can also be applied or removed by override rules.

| Value | Effect |
|-------|--------|
| `none` | No animation (default) |
| `pulse` | Gentle opacity fade, approximately 2 second cycle |
| `pulse_fast` | Faster opacity fade, approximately 0.8 second cycle |
| `blink` | Hard on/off blink |
| `breathe` | Subtle scale pulse from 1.0 to 1.05 and back |

---

## Conditional Overrides

Rectangles support the full override system. The following properties can be changed by override rules:

`background`, `gradient`, `opacity`, `border_color`, `border_width`, `animation`, `visible`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Card background

A rounded surface card used as a background for other widgets:

```json
{
  "id": "energy_card",
  "type": "rectangle",
  "x": 10, "y": 10, "w": 460, "h": 200,
  "background": "surface",
  "radius": 12
}
```

### State-driven alert highlight

Card border turns red and pulses when a binary sensor is active:

```json
{
  "id": "leak_card",
  "type": "rectangle",
  "x": 10, "y": 220, "w": 300, "h": 160,
  "background": "surface",
  "radius": 12,
  "border_width": 0,
  "border_color": "danger",
  "entity": "binary_sensor.kitchen_leak",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "border_width": 3, "animation": "pulse" }
    }
  ]
}
```

### Gradient overlay over a page background image

A dark gradient at the bottom of a page keeps text readable over a background photo:

```json
{
  "id": "bottom_fade",
  "type": "rectangle",
  "x": 0, "y": 500, "w": 1024, "h": 268,
  "gradient": {
    "from": "rgba(0,0,0,0)",
    "to": "rgba(0,0,0,0.75)",
    "angle": 180,
    "start_pct": 0,
    "end_pct": 100
  }
}
```

### Tappable navigation zone

An invisible tap target covering a region of the canvas that navigates to another page:

```json
{
  "id": "tap_to_cameras",
  "type": "rectangle",
  "x": 700, "y": 0, "w": 324, "h": 768,
  "background": "rgba(0,0,0,0)",
  "action": { "type": "navigate", "page": 3 }
}
```

### Status color indicator driven by attribute

A small colored rectangle that changes fill based on a climate entity's current action:

```json
{
  "id": "hvac_status_dot",
  "type": "rectangle",
  "x": 280, "y": 20, "w": 12, "h": 12,
  "background": "icon_inactive",
  "radius": 6,
  "entity": "climate.living_room",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "heating" } ] },
      "set": { "background": "warning" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "cooling" } ] },
      "set": { "background": "primary" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "idle" } ] },
      "set": { "background": "text_muted" }
    }
  ]
}
```
