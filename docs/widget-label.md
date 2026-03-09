# Widget: label

The label is the most versatile widget in HAven. It displays text, can show live values from any HA entity, supports number formatting, icons, template expressions, and can change its appearance dynamically through conditional overrides.

[screenshothere - a few label examples side by side: a plain text label, a formatted power value, one with an MDI icon, and one using an override to change color]

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Text and Icons](#text-and-icons)
- [Entity Binding](#entity-binding)
- [Value Formatting](#value-formatting)
- [Attribute Source](#attribute-source)
- [Secondary Entity (entity2)](#secondary-entity-entity2)
- [Template Expressions](#template-expressions)
- [Animations](#animations)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A static label with no entity binding:

```json
{
  "id": "heading",
  "type": "label",
  "x": 20, "y": 10, "w": 300, "h": 40,
  "text": "Solar Power",
  "font_size": 24,
  "color": "text_muted"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `text` | Static text content. Also used as a placeholder before the entity value loads. Supports `[mdi:icon-name]` icons and `{{ ... }}` template expressions. |
| `font_size` | Font size in pixels. |
| `align` | Horizontal alignment: `left`, `center`, or `right`. |
| `valign` | Vertical alignment: `top`, `center` (default), or `bottom`. |
| `color` | Text color as a theme token or hex value. Supports `{{ ... }}` template expressions. |
| `background` | Background fill color as a theme token or hex value. |
| `letter_spacing` | Letter spacing in pixels. |
| `font_weight` | CSS font-weight value, e.g. `400`, `600`, or `bold`. |
| `animation` | Optional animation applied to the label (see [Animations](#animations)). |
| `entity` | Primary HA entity ID. The label shows the entity's state and updates on every state change. |
| `entity_attribute` | Attribute key to use as the value source instead of `state` (e.g. `media_title`). |
| `entity2` | Secondary HA entity ID. The label re-renders when either entity changes. |
| `format` | How to format the entity value (see [Value Formatting](#value-formatting)). |
| `prefix` | Text prefix used with the `power_prefix` format. |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Text and Icons

The `text` field accepts plain text, MDI icon tokens, HTML entities, and template expressions in any combination.

```json
"text": "Living Room"
"text": "[mdi:lightbulb-outline] Lights"
"text": "[mdi:thermometer]&nbsp;{{ round(state, 1) }} °C"
```

Use `&nbsp;` to guarantee a space next to an icon. Regular spaces adjacent to icon spans can be collapsed by the browser's flex rendering.

[screenshothere - label showing an MDI icon next to text, e.g. a thermometer icon and temperature value]

Supported HTML entities: `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`.

Full MDI icon library: https://pictogrammers.com/library/mdi/

---

## Entity Binding

Set `entity` to a HA entity ID to display live state values. The label fetches the current state on page load and subscribes to `state_changed` events, updating automatically.

```json
{
  "id": "outdoor_temp",
  "type": "label",
  "x": 20, "y": 60, "w": 200, "h": 50,
  "entity": "sensor.outdoor_temperature",
  "format": "none",
  "font_size": 36,
  "align": "center",
  "color": "text"
}
```

The `text` field acts as a placeholder shown before the entity value arrives. A value of `"--"` is a common convention.

---

## Value Formatting

The `format` property transforms the raw entity state before display:

| Format | Example output | Notes |
|--------|----------------|-------|
| `power` | `948 w` or `1.23 kW` | Auto-scales watts to kilowatts above 1000 |
| `power_abs` | `948 w` or `1.23 kW` | Same but uses absolute value (useful for bidirectional sensors) |
| `power_prefix` | `Solar: 1.23 kW` | Power value preceded by the `prefix` field |
| `kwh` | `25.0 kWh` | |
| `percent` | `89%` | |
| `time_24` | `14:05` | Parses entity state as ISO datetime |
| `time_12` | `2:05 PM` | |
| `date_iso` | `2026-02-27` | |
| `date_short` | `27 Feb` | |
| `datetime_24` | `2026-02-27 14:05` | |
| `datetime_12` | `2026-02-27 2:05 PM` | |
| *(none)* | Raw state string | Default when `format` is omitted |

[screenshothere - a grid of labels showing different format values from the same or similar sensors]

---

## Attribute Source

Use `entity_attribute` when the value you want to display lives in a HA entity attribute rather than `state`. This is common for media players where track title, artist, and album are all attributes.

```json
{
  "id": "track_title",
  "type": "label",
  "x": 20, "y": 280, "w": 380, "h": 40,
  "entity": "media_player.living_room",
  "entity_attribute": "media_title",
  "font_size": 22,
  "align": "left",
  "color": "text"
}
```

```json
{
  "id": "track_artist",
  "type": "label",
  "x": 20, "y": 320, "w": 380, "h": 32,
  "entity": "media_player.living_room",
  "entity_attribute": "media_artist",
  "font_size": 16,
  "align": "left",
  "color": "text_muted"
}
```

[screenshothere - a media player card area showing track title and artist labels, possibly with album art image widget nearby]

The label updates whenever the entity changes, even when the attribute value is what changed.

---

## Secondary Entity (entity2)

`entity2` adds a subscription to a second HA entity. The label re-renders when either entity changes. The primary entity (`entity`) still drives `format` and the `state`/`attr` template variables. The secondary entity adds `state2`/`attr2` variables and the `state2`/`attribute2` override condition sources.

A common use case is showing a total (primary) but changing color based on a live rate (secondary):

```json
{
  "id": "daily_energy",
  "type": "label",
  "x": 20, "y": 100, "w": 200, "h": 50,
  "entity": "sensor.daily_energy_total",
  "entity2": "sensor.current_power",
  "format": "kwh",
  "color": "text_muted",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "source": "state2", "type": "above", "value": 0 } ] },
      "set": { "color": "primary" }
    }
  ]
}
```

---

## Template Expressions

Labels support `{{ ... }}` expressions in both `text` and `color` fields. Expressions are evaluated locally in the browser against the bound entity state — no HA templates or automations required.

### Variables

| Variable | Description |
|----------|-------------|
| `state` | Primary entity value, numeric if possible, otherwise string |
| `state_str` | Primary entity state always as a string |
| `attr.<name>` | Primary entity attribute value |
| `state2` | Secondary entity value (requires `entity2`) |
| `state_str2` | Secondary entity state as a string |
| `attr2.<name>` | Secondary entity attribute value |

### Functions and operators

- Math functions: `round(x, n)`, `min(a, b)`, `max(a, b)`, `abs(x)`, `floor(x)`, `ceil(x)`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparisons: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Boolean: `&&`, `||`, `!`
- Ternary: `condition ? value_if_true : value_if_false`
- Grouping: `( ... )`

### Template examples

Display a rounded sensor value with a unit:
```json
"text": "{{ round(state, 1) }} °C"
```

Null-safe attribute with a fallback:
```json
"text": "{{ attr.volume_level != null ? (round(attr.volume_level * 100, 0) + '%') : '--' }}"
```

Combine values from two entities:
```json
"text": "{{ round(state, 1) }} kW / {{ round(state2, 1) }} kW"
```

Color chosen dynamically by threshold (returns a theme token name):
```json
"color": "{{ state > 5000 ? 'danger' : (state > 1000 ? 'warning' : 'primary') }}"
```

[screenshothere - a label using a template expression, e.g. showing a calculated percentage or combined value]

---

## Animations

The `animation` property applies a CSS animation to the label. Animations can also be applied or removed via override rules.

| Value | Effect |
|-------|--------|
| `none` | No animation (default) |
| `pulse` | Gentle opacity fade, approximately 2 second cycle |
| `pulse_fast` | Faster opacity fade, approximately 0.8 second cycle |
| `blink` | Hard on/off blink |
| `breathe` | Subtle scale pulse from 1.0 to 1.05 and back |

A common pattern is to apply an animation only when an alert condition is active:

```json
"overrides": [
  {
    "when": { "logic": "all", "conditions": [ { "type": "above", "value": 4000 } ] },
    "set": { "color": "danger", "animation": "pulse" }
  }
]
```

---

## Conditional Overrides

Labels support the full override system. The following properties can be changed by override rules:

`text`, `color`, `background`, `font_size`, `opacity`, `border_color`, `border_width`, `animation`, `visible`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Plain static heading

```json
{
  "id": "page_title",
  "type": "label",
  "x": 20, "y": 10, "w": 400, "h": 36,
  "text": "Energy Overview",
  "font_size": 22,
  "font_weight": "600",
  "align": "left",
  "color": "text"
}
```

### Live power reading with color and icon

```json
{
  "id": "solar_power",
  "type": "label",
  "x": 160, "y": 50, "w": 220, "h": 60,
  "text": "[mdi:solar-panel]&nbsp;--",
  "font_size": 48,
  "align": "right",
  "color": "icon_inactive",
  "entity": "sensor.pv_power",
  "format": "power",
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

[screenshothere - the solar power label in its inactive state (grey) and active state (green/primary color)]

### Clock using internal entity

```json
{
  "id": "clock",
  "type": "label",
  "x": 20, "y": 10, "w": 180, "h": 40,
  "entity": "internal.currentdtm",
  "format": "time_24",
  "font_size": 28,
  "align": "left",
  "color": "text_muted"
}
```

### Media player now playing

```json
{
  "id": "now_playing",
  "type": "label",
  "x": 20, "y": 300, "w": 360, "h": 36,
  "entity": "media_player.living_room",
  "entity_attribute": "media_title",
  "text": "Nothing playing",
  "font_size": 20,
  "align": "left",
  "color": "text",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "off" } ] },
      "set": { "color": "text_muted" }
    }
  ]
}
```

### Alert label that pulses when active

```json
{
  "id": "high_consumption_alert",
  "type": "label",
  "x": 20, "y": 400, "w": 300, "h": 40,
  "text": "High consumption",
  "font_size": 18,
  "color": "text_muted",
  "entity": "sensor.total_power",
  "visible": false,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "above", "value": 8000 } ] },
      "set": { "visible": true, "color": "danger", "animation": "pulse" }
    }
  ]
}
```
