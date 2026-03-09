# Widget: button

The button widget is a tappable element that reflects entity state and calls HA services on press. It combines an icon and a label that auto-scale to fit the button dimensions, and uses conditional overrides to change its icon, colors, and label based on the current entity state.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Icon and Label](#icon-and-label)
- [Auto-sizing](#auto-sizing)
- [Entity Binding and State Styling](#entity-binding-and-state-styling)
- [Actions](#actions)
- [Locking](#locking)
- [Animations](#animations)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A button that toggles a light:

```json
{
  "id": "kitchen_light",
  "type": "button",
  "x": 20, "y": 20, "w": 120, "h": 120,
  "icon": "[mdi:lightbulb-outline]",
  "label": "Kitchen",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.kitchen" }
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `icon` | MDI icon token to display. Uses `[mdi:icon-name]` syntax. |
| `icon_color` | Icon color as a theme token or hex value. Default: `text`. |
| `icon_size` | Icon font size in pixels. Overrides auto-sizing. |
| `label` | Label text shown below the icon. Supports `{{ ... }}` template expressions. |
| `label_color` | Label text color as a theme token or hex value. Default: `text_dim`. |
| `label_size` | Label font size in pixels. Overrides auto-sizing. |
| `background` | Button background color as a theme token or hex value. Default: `surface2`. |
| `radius` | Corner radius in pixels. |
| `gap` | Gap between icon and label in pixels. |
| `padding` | Inner padding in pixels. |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `border_width` | Border thickness in pixels. |
| `border_color` | Border color as a theme token or hex value. |
| `entity` | HA entity ID. Drives override conditions and re-renders on state change. |
| `action` | Action to perform when tapped. See [Actions](#actions). |
| `locked` | When `true`, the button is non-interactive. Overrides can set this dynamically. |
| `animation` | Optional animation applied to the button. See [Animations](#animations). |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Icon and Label

### Icons

Set `icon` to an MDI icon token using `[mdi:icon-name]` syntax. The icon renders at the center of the button, above the label if both are present.

```json
"icon": "[mdi:lightbulb]"
"icon": "[mdi:thermometer]"
"icon": "[mdi:power]"
```

Full MDI icon library: https://pictogrammers.com/library/mdi/

### Label

The `label` field supports plain text and `{{ ... }}` template expressions. When an entity is bound, the template is evaluated against the current entity state on every update.

```json
"label": "Kitchen"
"label": "{{ round(state, 0) }}%"
"label": "{{ state == 'on' ? 'On' : 'Off' }}"
```

### Icon only or label only

Omit `label` entirely for an icon-only button. Omit `icon` for a text-only button. The auto-sizing adjusts to whichever elements are present.

---

## Auto-sizing

Icon and label sizes scale automatically based on the button's `w` and `h` dimensions. The calculation uses the smaller of the two dimensions as the base:

| Content | Icon size | Label size |
|---------|-----------|------------|
| Icon and label | 42% of base | 14% of base |
| Icon only | 60% of base | - |
| Label only | - | 20% of base |

Override either with `icon_size` or `label_size` to pin the size regardless of button dimensions:

```json
{
  "w": 160, "h": 80,
  "icon": "[mdi:power]",
  "label": "Toggle",
  "icon_size": 28,
  "label_size": 14
}
```

---

## Entity Binding and State Styling

Set `entity` to drive the button's appearance from a HA entity. The most common pattern is to show one set of colors when the entity is `on` and another when it is `off`, and optionally swap the icon.

```json
{
  "id": "living_light",
  "type": "button",
  "x": 20, "y": 20, "w": 120, "h": 120,
  "icon": "[mdi:lightbulb-outline]",
  "label": "Living Room",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "entity": "light.living_room",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": {
        "background": "surface2",
        "icon_color": "primary",
        "label_color": "text",
        "icon": "[mdi:lightbulb]"
      }
    }
  ],
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.living_room" }
}
```

The base properties (`background`, `icon_color`, `label_color`, `icon`, `label`) act as defaults when no override rule matches.

---

## Actions

The `action` property defines what happens when the button is tapped. Three action types are available:

### Service call

```json
"action": { "type": "service", "service": "light.toggle", "entity_id": "light.kitchen" }
```

With additional service data:

```json
"action": {
  "type": "service",
  "service": "light.turn_on",
  "entity_id": "light.kitchen",
  "data": { "brightness_pct": 80, "color_temp": 350 }
}
```

### Navigation

```json
"action": { "type": "navigate", "page": 2 }
```

### Trigger automation

```json
"action": { "type": "automation", "entity_id": "automation.good_night" }
```

When tapped, the button briefly dims to 75% opacity as visual feedback before the action fires.

---

## Locking

Set `locked: true` in the widget config to make the button non-interactive from the start. When locked, the cursor changes to `not-allowed` and taps are ignored.

More usefully, locking can be applied dynamically via an override rule. This lets you disable a button based on a condition without hiding it:

```json
{
  "id": "arm_alarm",
  "type": "button",
  "x": 20, "y": 20, "w": 120, "h": 120,
  "icon": "[mdi:shield-outline]",
  "label": "Arm",
  "background": "surface",
  "icon_color": "icon_inactive",
  "entity": "alarm_control_panel.home",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "armed_away" } ] },
      "set": { "locked": true, "icon_color": "primary", "icon": "[mdi:shield-check]" }
    }
  ],
  "action": { "type": "service", "service": "alarm_control_panel.alarm_arm_away", "entity_id": "alarm_control_panel.home" }
}
```

---

## Animations

The `animation` property applies a CSS animation to the button. Animations can also be applied or removed by override rules.

| Value | Effect |
|-------|--------|
| `none` | No animation (default) |
| `pulse` | Gentle opacity fade, approximately 2 second cycle |
| `pulse_fast` | Faster opacity fade, approximately 0.8 second cycle |
| `blink` | Hard on/off blink |
| `breathe` | Subtle scale pulse from 1.0 to 1.05 and back |

---

## Conditional Overrides

Buttons support the full override system. The following properties can be changed by override rules:

`background`, `icon_color`, `label_color`, `icon`, `label`, `opacity`, `border_color`, `border_width`, `locked`, `animation`, `visible`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Light with on/off icon swap

```json
{
  "id": "bedroom_light",
  "type": "button",
  "x": 20, "y": 20, "w": 120, "h": 120,
  "icon": "[mdi:lightbulb-outline]",
  "label": "Bedroom",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "entity": "light.bedroom",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "background": "surface2", "icon_color": "primary", "label_color": "text", "icon": "[mdi:lightbulb]" }
    }
  ],
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.bedroom" }
}
```

### Climate mode button with attribute condition

Changes color based on the `hvac_action` attribute rather than the entity state:

```json
{
  "id": "climate_btn",
  "type": "button",
  "x": 160, "y": 20, "w": 120, "h": 120,
  "icon": "[mdi:thermometer]",
  "label": "Climate",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "entity": "climate.living_room",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "heating" } ] },
      "set": { "icon_color": "warning", "label_color": "text" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "cooling" } ] },
      "set": { "icon_color": "primary", "label_color": "text" }
    }
  ],
  "action": { "type": "navigate", "page": 3 }
}
```

### Icon-only navigation button

```json
{
  "id": "nav_cameras",
  "type": "button",
  "x": 960, "y": 10, "w": 54, "h": 54,
  "icon": "[mdi:cctv]",
  "background": "surface",
  "icon_color": "text_muted",
  "radius": 8,
  "action": { "type": "navigate", "page": 4 }
}
```

### Label-only button with template

Displays the entity state value as the button label. Useful for mode selectors where the current value should be visible on the button itself:

```json
{
  "id": "fan_speed",
  "type": "button",
  "x": 300, "y": 20, "w": 120, "h": 80,
  "label": "{{ state }}",
  "label_size": 18,
  "background": "surface",
  "label_color": "text",
  "entity": "fan.ceiling",
  "action": { "type": "service", "service": "fan.toggle", "entity_id": "fan.ceiling" }
}
```

### Button with border highlight and pulse when alerting

```json
{
  "id": "door_alert",
  "type": "button",
  "x": 20, "y": 160, "w": 120, "h": 120,
  "icon": "[mdi:door-closed]",
  "label": "Front Door",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "border_width": 0,
  "border_color": "danger",
  "entity": "binary_sensor.front_door",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": {
        "icon": "[mdi:door-open]",
        "icon_color": "danger",
        "label_color": "text",
        "border_width": 2,
        "animation": "pulse"
      }
    }
  ]
}
```
