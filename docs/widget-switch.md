# Widget: switch

The switch widget is a sliding toggle that reflects and controls a binary entity state. Unlike a standard HA switch, it works with any entity and any pair of values, not just `on`/`off`. The thumb slides left and right to show the current state, and tapping toggles it.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [on\_value and off\_value](#on_value-and-off_value)
- [Attribute Source](#attribute-source)
- [Default Toggle Action](#default-toggle-action)
- [Custom Action](#custom-action)
- [Thumb Icon](#thumb-icon)
- [Label](#label)
- [Appearance](#appearance)
- [Locking](#locking)
- [Optimistic Updates](#optimistic-updates)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A standard on/off toggle for a HA switch entity:

```json
{
  "id": "kitchen_switch",
  "type": "switch",
  "x": 20, "y": 20, "w": 90, "h": 46,
  "entity": "switch.kitchen_power",
  "on_value": "on",
  "off_value": "off"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | HA entity ID. The switch reads this entity's state and updates on every state change. |
| `on_value` | The state value (or attribute value) that means the switch is on. **Required.** |
| `off_value` | The state value (or attribute value) that means the switch is off. **Required.** |
| `value_attribute` | Attribute key to read the value from instead of `state`. |
| `color` | Track background color as a theme token or hex value. Default: `surface2`. |
| `thumb_color` | Thumb (knob) color. Default: `text`. |
| `thumb_radius` | Corner radius of the thumb in pixels. Defaults to half the thumb height (circular). |
| `radius` | Corner radius of the track in pixels. Defaults to half the track height (pill shape). |
| `padding` | Gap between the thumb and the track edge in pixels. Default: `3`. |
| `icon` | MDI icon token displayed inside the thumb. Uses `[mdi:icon-name]` syntax. |
| `icon_color` | Icon color inside the thumb. Default: `text_muted`. |
| `icon_scale` | Multiplier for icon size relative to thumb. Range `0.1` to `2.0`. Default: `1`. |
| `label` | Optional text label displayed alongside the track. |
| `label_color` | Label text color. Default: `text_muted`. |
| `label_size` | Label font size in pixels. Defaults to 34% of the widget height. |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `locked` | When `true`, the switch is non-interactive. Can be set via overrides. |
| `optimistic` | Set to `false` to disable optimistic UI updates. Default: `true`. |
| `action` | Custom action to call on tap instead of the default toggle. See [Custom Action](#custom-action). |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

> **Note:** Both `on_value` and `off_value` are required. If either is missing the switch renders an error state.

---

## on\_value and off\_value

These define what the entity state string means for the switch position. For a standard HA switch or light, use `"on"` and `"off"`. For other entity types, use whatever values that entity reports:

```json
"on_value": "on",   "off_value": "off"      // switch.*, light.*
"on_value": "home", "off_value": "not_home"  // device_tracker.*
"on_value": "above_horizon", "off_value": "below_horizon"  // sun.sun
"on_value": "locked", "off_value": "unlocked"  // lock.*
```

Values are compared as strings. If the current state matches neither value, the switch renders in an unknown/dimmed state with the thumb at the off position.

---

## Attribute Source

Set `value_attribute` to read the toggle value from an entity attribute instead of the top-level state. This is useful for entities where the on/off distinction lives in an attribute rather than state:

```json
{
  "type": "switch",
  "x": 20, "y": 20, "w": 90, "h": 46,
  "entity": "climate.living_room",
  "value_attribute": "preset_mode",
  "on_value": "boost",
  "off_value": "normal"
}
```

---

## Default Toggle Action

When no `action` is configured, tapping calls `homeassistant.toggle` on the bound entity. This works for lights, switches, fans, and most binary entities.

---

## Custom Action

Set `action` to override the default toggle behavior. The same action types used by buttons apply here. Value tokens let you pass the resolved on/off values into the service call:

| Token | Value |
|-------|-------|
| `$on_value` | The configured `on_value` string |
| `$off_value` | The configured `off_value` string |
| `$is_on` | `"true"` if toggling to on, `"false"` if toggling to off |

```json
{
  "type": "switch",
  "entity": "input_select.mode",
  "on_value": "Night",
  "off_value": "Day",
  "action": {
    "type": "service",
    "service": "input_select.select_option",
    "entity_id": "input_select.mode",
    "data": { "option": "$on_value" }
  }
}
```

A navigate action is also valid for a purely visual toggle-style navigation control:

```json
"action": { "type": "navigate", "page": 2 }
```

---

## Thumb Icon

Display an MDI icon inside the thumb using the `[mdi:icon-name]` syntax:

```json
{
  "type": "switch",
  "x": 20, "y": 20, "w": 90, "h": 46,
  "entity": "switch.garden_lights",
  "on_value": "on",
  "off_value": "off",
  "icon": "[mdi:lightbulb]",
  "icon_color": "warning",
  "icon_scale": 1.1
}
```

The icon size is calculated as 52% of the thumb height multiplied by `icon_scale`. Increase `icon_scale` to make the icon more prominent, or decrease it to make it smaller.

---

## Label

Add a `label` to display text alongside the switch track. The label supports `{{ ... }}` template expressions evaluated against the entity state:

```json
{
  "type": "switch",
  "x": 20, "y": 20, "w": 90, "h": 46,
  "entity": "switch.fan",
  "on_value": "on",
  "off_value": "off",
  "label": "Fan",
  "label_color": "text_muted",
  "label_size": 14
}
```

---

## Appearance

### Track and thumb shape

Both the track and thumb are pill-shaped by default (radius = half height). Override with `radius` for the track and `thumb_radius` for the thumb:

```json
{
  "radius": 8,
  "thumb_radius": 4
}
```

Setting both to a small value produces a rectangular toggle rather than a pill.

### Colors

```json
{
  "color": "surface2",
  "thumb_color": "text"
}
```

Colors are overrideable, making it straightforward to change the track color based on entity state via override rules.

### Padding

`padding` controls the gap between the thumb edge and the track edge. Increase it to give the thumb more breathing room, or reduce it to `0` for a flush look:

```json
{ "padding": 5 }
```

---

## Locking

Set `locked: true` to make the switch non-interactive. When locked, the cursor changes to `not-allowed` and taps are ignored. Locking can be applied dynamically via an override rule:

```json
{
  "entity": "lock.front_door",
  "on_value": "locked",
  "off_value": "unlocked",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "is_jammed", "type": "equals", "value": true } ] },
      "set": { "locked": true, "color": "danger" }
    }
  ]
}
```

---

## Optimistic Updates

By default (`optimistic: true`), the thumb moves immediately on tap before the HA state update arrives. This makes the switch feel instant on slow connections.

Set `optimistic: false` to wait for the confirmed state update from HA before moving the thumb:

```json
{ "optimistic": false }
```

---

## Conditional Overrides

Switches support the full override system. The following properties can be changed by override rules:

`color`, `thumb_color`, `icon`, `icon_color`, `icon_scale`, `label`, `label_color`, `label_size`, `radius`, `thumb_radius`, `padding`, `opacity`, `locked`, `on_value`, `off_value`, `value_attribute`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Standard light switch

```json
{
  "id": "hall_light",
  "type": "switch",
  "x": 20, "y": 20, "w": 90, "h": 46,
  "entity": "light.hallway",
  "on_value": "on",
  "off_value": "off",
  "color": "surface2",
  "thumb_color": "text",
  "icon": "[mdi:lightbulb]",
  "icon_color": "primary"
}
```

### Track color changes with state

The track turns green when on and stays neutral when off:

```json
{
  "id": "garden_pump",
  "type": "switch",
  "x": 20, "y": 80, "w": 90, "h": 46,
  "entity": "switch.garden_pump",
  "on_value": "on",
  "off_value": "off",
  "color": "surface2",
  "thumb_color": "text",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "color": "primary" }
    }
  ]
}
```

### Device tracker presence toggle

```json
{
  "id": "presence_tom",
  "type": "switch",
  "x": 20, "y": 140, "w": 90, "h": 46,
  "entity": "device_tracker.tom_phone",
  "on_value": "home",
  "off_value": "not_home",
  "icon": "[mdi:account]",
  "icon_color": "primary"
}
```

### Sun elevation toggle (view only, locked)

Displays current day/night state as a visual indicator with no tap interaction:

```json
{
  "id": "sun_state",
  "type": "switch",
  "x": 20, "y": 200, "w": 90, "h": 46,
  "entity": "sun.sun",
  "on_value": "above_horizon",
  "off_value": "below_horizon",
  "locked": true,
  "icon": "[mdi:weather-sunny]",
  "icon_color": "warning",
  "color": "surface2",
  "thumb_color": "text"
}
```

### Rectangular toggle with square thumb

```json
{
  "id": "eco_mode",
  "type": "switch",
  "x": 20, "y": 260, "w": 90, "h": 40,
  "entity": "input_boolean.eco_mode",
  "on_value": "on",
  "off_value": "off",
  "radius": 6,
  "thumb_radius": 4,
  "padding": 4,
  "icon": "[mdi:leaf]",
  "icon_color": "primary"
}
```
