# Widget: scene

The scene widget is an option selector that reads the current value from a HA entity and lets the user pick from a defined list of options. It renders in one of three layouts: pill buttons, a native dropdown, or a tap-to-open picker modal. Selecting an option calls a HA service with the chosen value.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Options](#options)
- [Layouts](#layouts)
- [Entity Binding](#entity-binding)
- [Attribute Source](#attribute-source)
- [Action and the \$option Token](#action-and-the-option-token)
- [Locking](#locking)
- [Appearance](#appearance)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

An input select selector rendered as pill buttons:

```json
{
  "id": "mode_selector",
  "type": "scene",
  "x": 20, "y": 20, "w": 300, "h": 60,
  "entity": "input_select.house_mode",
  "options": [
    { "value": "Home",  "label": "Home" },
    { "value": "Away",  "label": "Away" },
    { "value": "Night", "label": "Night" }
  ],
  "action": {
    "type": "service",
    "service": "input_select.select_option",
    "entity_id": "input_select.house_mode",
    "data": { "option": "$option" }
  }
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `options` | Array of options to display. See [Options](#options). **Required.** |
| `layout` | Render mode: `buttons` (default), `dropdown`, or `picker`. |
| `entity` | HA entity ID. Drives the active/selected state and updates on every state change. |
| `value_attribute` | Attribute key to read the current value from instead of `state`. |
| `action` | Service action called when an option is selected. Use `$option` for the chosen value. |
| `background` | Widget background color as a theme token or hex value. Default: `transparent`. |
| `radius` | Corner radius of the widget container in pixels. Default: `8`. |
| `padding` | Inner padding in pixels between the container edge and the options. Default: `6`. |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `locked` | When `true`, all options are non-interactive. Can be set via overrides. |
| `option_background` | Background color of unselected options. Default: `surface2`. |
| `option_color` | Text color of unselected options. Default: `text`. |
| `selected_background` | Background color of the active/selected option. Default: `primary`. |
| `selected_color` | Text color of the active/selected option. Default: `background`. |
| `option_radius` | Corner radius of individual option buttons. Default: `18` (buttons), `8` (dropdown), `10`/`20` (picker). |
| `option_size` | Font size of option labels in pixels. Default: `14` (buttons), `16` (dropdown/picker). |
| `option_padding_x` | Horizontal padding inside each option button in pixels. Default: `12`. Buttons layout only. |
| `option_padding_y` | Vertical padding inside each option button in pixels. Default: `8`. Buttons layout only. |
| `option_gap` | Gap between option buttons in pixels. Default: `4`. Buttons layout only. |
| `option_panel_background` | Background color of the picker modal card. Default: `surface`. Picker layout only. |
| `option_panel_radius` | Corner radius of the picker modal card in pixels. Default: `12`. Picker layout only. |
| `placeholder` | Text shown on the picker button when no option is selected. Default: `Select`. Picker layout only. |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Options

The `options` array defines the choices displayed. Each entry can be a plain string or an object with `value`, `label`, and `icon` fields:

### Plain strings

```json
"options": ["Home", "Away", "Night"]
```

When a plain string is used, the value and the display label are both the string itself.

### Objects

```json
"options": [
  { "value": "home",  "label": "Home",  "icon": "[mdi:home]" },
  { "value": "away",  "label": "Away",  "icon": "[mdi:car]" },
  { "value": "night", "label": "Night", "icon": "[mdi:weather-night]" }
]
```

| Field | Description |
|-------|-------------|
| `value` | The value sent to HA when this option is selected. Also used to match against the entity state. **Required.** |
| `label` | Display text. Defaults to `value` if omitted. |
| `icon` | MDI icon token shown before the label. Uses `[mdi:icon-name]` syntax. Optional. |

> **Note:** Icons are not shown in the `dropdown` layout, as native HTML `<select>` elements do not support icons.

---

## Layouts

### buttons (default)

Renders all options as pill-shaped buttons arranged in a row. Wraps to a second row if the options do not fit. This is the most visually prominent layout and works best when there are 2 to 5 short options.

```json
{ "layout": "buttons" }
```

### dropdown

Renders a native browser `<select>` element. The most compact option. Best for long lists or when screen space is limited. Icon fields on options are ignored in this layout.

```json
{ "layout": "dropdown" }
```

### picker

Renders as a single button showing the current selection. Tapping it opens a modal overlay with all options listed as full-width buttons. Tapping an option selects it and closes the modal. Tapping outside the modal closes it without changing the selection.

```json
{ "layout": "picker" }
```

---

## Entity Binding

Set `entity` to a HA entity ID. On page load, the widget reads the current state and highlights the matching option. It subscribes to `state_changed` events and updates the active option automatically.

If no option matches the current entity value, no option appears selected, but the widget remains functional.

If no entity is set, the widget still renders and fires actions on selection, but no option is highlighted as active.

---

## Attribute Source

Set `value_attribute` to read the active value from an entity attribute instead of the top-level state. Useful for entities where the relevant value is in an attribute:

```json
{
  "entity": "climate.living_room",
  "value_attribute": "preset_mode",
  "options": [
    { "value": "eco",    "label": "Eco" },
    { "value": "boost",  "label": "Boost" },
    { "value": "normal", "label": "Normal" }
  ]
}
```

---

## Action and the $option Token

The `action` property defines the service call made when an option is selected. The `$option` token is replaced with the `value` string of the chosen option at call time:

```json
"action": {
  "type": "service",
  "service": "input_select.select_option",
  "entity_id": "input_select.house_mode",
  "data": { "option": "$option" }
}
```

```json
"action": {
  "type": "service",
  "service": "climate.set_preset_mode",
  "entity_id": "climate.living_room",
  "data": { "preset_mode": "$option" }
}
```

```json
"action": {
  "type": "service",
  "service": "select.select_option",
  "entity_id": "select.fan_speed",
  "data": { "option": "$option" }
}
```

If no `action` is set, selecting an option updates the visual state locally but no service call is made.

---

## Locking

Set `locked: true` to make all options non-interactive. In buttons layout the options are dimmed and show a `not-allowed` cursor. In dropdown and picker layouts the controls are disabled. Locking can be applied dynamically via overrides:

```json
{
  "locked": false,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "locked" } ] },
      "set": { "locked": true }
    }
  ]
}
```

---

## Appearance

### Button layout styling

```json
{
  "option_background": "surface2",
  "option_color": "text",
  "selected_background": "primary",
  "selected_color": "background",
  "option_radius": 18,
  "option_size": 14,
  "option_padding_x": 14,
  "option_padding_y": 8,
  "option_gap": 6
}
```

### Picker modal styling

```json
{
  "option_panel_background": "surface",
  "option_panel_radius": 14,
  "placeholder": "Choose mode",
  "option_size": 15
}
```

---

## Conditional Overrides

Scenes support the full override system. The following properties can be changed by override rules:

`background`, `opacity`, `locked`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Input select with icons, buttons layout

```json
{
  "id": "house_mode",
  "type": "scene",
  "x": 10, "y": 10, "w": 360, "h": 64,
  "entity": "input_select.house_mode",
  "layout": "buttons",
  "options": [
    { "value": "Home",  "label": "Home",  "icon": "[mdi:home]" },
    { "value": "Away",  "label": "Away",  "icon": "[mdi:car]" },
    { "value": "Night", "label": "Night", "icon": "[mdi:weather-night]" },
    { "value": "Guest", "label": "Guest", "icon": "[mdi:account]" }
  ],
  "selected_background": "primary",
  "selected_color": "background",
  "option_background": "surface2",
  "option_color": "text_muted",
  "action": {
    "type": "service",
    "service": "input_select.select_option",
    "entity_id": "input_select.house_mode",
    "data": { "option": "$option" }
  }
}
```

### Climate preset picker modal

```json
{
  "id": "climate_preset",
  "type": "scene",
  "x": 10, "y": 90, "w": 200, "h": 50,
  "entity": "climate.living_room",
  "value_attribute": "preset_mode",
  "layout": "picker",
  "placeholder": "Preset",
  "options": [
    { "value": "none",   "label": "None" },
    { "value": "eco",    "label": "Eco" },
    { "value": "boost",  "label": "Boost" },
    { "value": "comfort","label": "Comfort" }
  ],
  "option_background": "surface2",
  "option_color": "text",
  "selected_background": "warning",
  "selected_color": "background",
  "action": {
    "type": "service",
    "service": "climate.set_preset_mode",
    "entity_id": "climate.living_room",
    "data": { "preset_mode": "$option" }
  }
}
```

### Fan speed dropdown

```json
{
  "id": "fan_speed",
  "type": "scene",
  "x": 10, "y": 160, "w": 200, "h": 46,
  "entity": "select.fan_speed",
  "layout": "dropdown",
  "options": [
    { "value": "low",    "label": "Low" },
    { "value": "medium", "label": "Medium" },
    { "value": "high",   "label": "High" }
  ],
  "option_background": "surface2",
  "option_color": "text",
  "option_radius": 8,
  "action": {
    "type": "service",
    "service": "select.select_option",
    "entity_id": "select.fan_speed",
    "data": { "option": "$option" }
  }
}
```

### Sun phase display with entity-driven active option (no action)

Uses the scene widget purely as a visual state indicator with no tap action:

```json
{
  "id": "sun_phase",
  "type": "scene",
  "x": 10, "y": 220, "w": 360, "h": 52,
  "entity": "sun.sun",
  "layout": "buttons",
  "options": [
    { "value": "above_horizon", "label": "Day",   "icon": "[mdi:weather-sunny]" },
    { "value": "below_horizon", "label": "Night", "icon": "[mdi:weather-night]" }
  ],
  "selected_background": "warning",
  "selected_color": "background",
  "option_background": "surface2",
  "option_color": "text_muted",
  "locked": true
}
```
