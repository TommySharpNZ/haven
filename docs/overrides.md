# Conditional Overrides

Most widget types support an `overrides` array that changes visual properties based on entity state. Rules are evaluated in order and all matching rules are applied. Later rules win on any conflicting property.

```json
"overrides": [
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "state", "type": "above", "value": 0 } ]
    },
    "set": { "color": "primary" }
  },
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "state", "type": "above", "value": 5000 } ]
    },
    "set": { "color": "danger" }
  }
]
```

---

## Contents

- [Condition Logic](#condition-logic)
- [Condition Types](#condition-types)
- [Condition Sources](#condition-sources)
- [Controlling Visibility](#controlling-visibility)
- [Properties Settable via Overrides](#properties-settable-via-overrides)
- [Template Expressions](#template-expressions)
- [Examples](#examples)

---

## Condition Logic

| Field | Values | Description |
|-------|--------|-------------|
| `logic` | `all`, `any` | `all` requires every condition to match (AND). `any` requires at least one (OR). |
| `conditions` | array | One or more condition objects. |

---

## Condition Types

| Type | Description |
|------|-------------|
| `above` | Numeric value is greater than `value`. |
| `below` | Numeric value is less than `value`. |
| `equals` | Value matches `value` exactly (string or number). |
| `not_equals` | Value does not match `value`. |

---

## Condition Sources

The `source` field controls what value the condition tests against. When `source` is omitted it defaults to `"state"`.

| Source | Tests against | Notes |
|--------|---------------|-------|
| `state` | Primary entity state | Default when `source` is omitted. |
| `attribute` | A named attribute of the primary entity | Requires an `"attribute"` key. Returns false if the attribute is missing. |
| `state2` | Secondary entity (`entity2`) state | Returns false if `entity2` is not configured. |
| `attribute2` | A named attribute of `entity2` | Requires an `"attribute"` key. Returns false if missing. |
| `page` | Current page ID | No entity required. Useful for page-aware visibility or styling on overlay widgets. |

```json
{ "source": "state",      "type": "equals", "value": "on" }
{ "source": "attribute",  "attribute": "hvac_action",   "type": "equals", "value": "heating" }
{ "source": "attribute",  "attribute": "brightness",    "type": "above",  "value": 128 }
{ "source": "state2",                                   "type": "above",  "value": 0 }
{ "source": "attribute2", "attribute": "battery_level", "type": "below",  "value": 20 }
{ "source": "page",                                     "type": "equals", "value": 2 }
```

---

## Controlling Visibility

Use `set.visible` inside an override rule to show or hide any widget. This works on all widget types.

```json
"overrides": [
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "attribute", "attribute": "shuffle", "type": "equals", "value": true } ]
    },
    "set": { "visible": true }
  },
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "attribute", "attribute": "shuffle", "type": "not_equals", "value": true } ]
    },
    "set": { "visible": false }
  }
]
```

---

## Properties Settable via Overrides

Which properties can be set varies by widget type:

| Widget | Settable via `set` |
|--------|--------------------|
| label | `text`, `color`, `background`, `font_size`, `opacity`, `border_color`, `border_width`, `animation`, `visible` |
| rectangle | `background`, `gradient`, `opacity`, `border_color`, `border_width`, `animation`, `visible` |
| button | `background`, `icon_color`, `label_color`, `icon`, `label`, `opacity`, `border_color`, `border_width`, `visible` |
| bar | `color`, `visible` |
| arc | `color`, `visible` |
| slider | `background`, `color`, `thumb_color`, `opacity`, `visible` |
| switch | `color`, `thumb_color`, `icon`, `icon_color`, `icon_scale`, `label`, `label_color`, `label_size`, `radius`, `thumb_radius`, `padding`, `opacity`, `locked`, `visible` |

---

## Template Expressions

Label `text` and `color` fields support `{{ ... }}` expressions evaluated locally against the bound entity state. Templates are not part of the override system but work alongside it.

### Variables

| Variable | Description |
|----------|-------------|
| `state` | Primary entity value (numeric if possible, otherwise string) |
| `state_str` | Primary entity state always as a string |
| `attr.<name>` | Primary entity attribute value |
| `state2` | Secondary entity value (requires `entity2`) |
| `state_str2` | Secondary entity state as a string |
| `attr2.<name>` | Secondary entity attribute value |

### Functions and operators

- Math: `round(x, n)`, `min(a, b)`, `max(a, b)`, `abs(x)`, `floor(x)`, `ceil(x)`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparisons: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Boolean: `&&`, `||`, `!`
- Ternary: `condition ? value_if_true : value_if_false`

### Template examples

Null-safe attribute with fallback:
```json
"text": "{{ attr.volume_level != null ? attr.volume_level : 0 }}"
```

Volume percent from HA `0..1` attribute:
```json
"text": "{{ attr.volume_level != null ? (round(attr.volume_level * 100, 0) + '%') : '--' }}"
```

Color chosen by threshold (returned as a theme token or hex):
```json
"color": "{{ state > 5000 ? 'danger' : (state > 1000 ? 'warning' : 'primary') }}"
```

Combined values from `entity` and `entity2`:
```json
"text": "{{ round(state, 1) }} kW / {{ round(state2, 1) }} kW"
```

Icon with live value:
```json
"text": "[mdi:thermometer]&nbsp;{{ round(state, 1) }} °C"
```

---

## Examples

### Label changes color above a threshold

```json
{
  "type": "label",
  "entity": "sensor.pv_power",
  "format": "power",
  "color": "icon_inactive",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "above", "value": 0 } ] },
      "set": { "color": "primary" }
    },
    {
      "when": { "logic": "all", "conditions": [ { "type": "above", "value": 5000 } ] },
      "set": { "color": "warning" }
    }
  ]
}
```

### Button reflects light on/off state

```json
{
  "type": "button",
  "entity": "light.kitchen",
  "icon": "[mdi:lightbulb-outline]",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "background": "surface2", "icon_color": "primary", "label_color": "text", "icon": "[mdi:lightbulb]" }
    }
  ]
}
```

### Rectangle border glows when any of two entities is active

```json
{
  "type": "rectangle",
  "entity": "alarm_control_panel.home",
  "entity2": "binary_sensor.motion_lounge",
  "background": "surface",
  "radius": 10,
  "overrides": [
    {
      "when": {
        "logic": "any",
        "conditions": [
          { "source": "state",  "type": "equals", "value": "triggered" },
          { "source": "state2", "type": "equals", "value": "on" }
        ]
      },
      "set": { "border_width": 3, "border_color": "danger" }
    }
  ]
}
```

### Widget hidden on a specific page

```json
{
  "type": "button",
  "entity": "light.living_room",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "page", "type": "equals", "value": 3 } ] },
      "set": { "visible": false }
    }
  ]
}
```

### Climate attribute drives a switch appearance

```json
{
  "type": "switch",
  "entity": "climate.lounge",
  "value_attribute": "hvac_action",
  "on_value": "heating",
  "off_value": "idle",
  "color": "surface2",
  "icon": "mdi:radiator-disabled",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "hvac_action", "type": "equals", "value": "heating" } ] },
      "set": { "color": "warning", "icon": "mdi:radiator" }
    }
  ]
}
```
