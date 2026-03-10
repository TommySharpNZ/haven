# Widget: slider

The slider widget is a draggable control for adjusting numeric entity values such as brightness, volume, cover position, or media playback position. It renders a track with a filled region and a draggable thumb, and calls a HA service with the chosen value on release (or continuously while dragging).

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Range and Step](#range-and-step)
- [Orientation](#orientation)
- [Entity Binding](#entity-binding)
- [Attribute Source](#attribute-source)
- [Dynamic Bounds](#dynamic-bounds)
- [Action](#action)
- [Update Mode](#update-mode)
- [Media Position (Live Progress)](#media-position-live-progress)
- [Appearance](#appearance)
- [Locking](#locking)
- [Conditional Overrides](#conditional-overrides)
- [Examples](#examples)

---

## Minimal Example

A brightness slider for a light:

```json
{
  "id": "brightness",
  "type": "slider",
  "x": 20, "y": 20, "w": 280, "h": 40,
  "entity": "light.living_room",
  "value_attribute": "brightness",
  "min": 0,
  "max": 255,
  "color": "primary",
  "action": {
    "type": "service",
    "service": "light.turn_on",
    "entity_id": "light.living_room",
    "data": { "brightness": "$value" }
  }
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | HA entity ID. The slider reads this entity's state and updates on every change. |
| `min` | Minimum value. Default: `0`. |
| `max` | Maximum value. Default: `100`. |
| `step` | Snap increment. Default: `1`. Supports decimals (e.g. `0.5`). |
| `orientation` | `horizontal` (default) or `vertical`. |
| `value_attribute` | Attribute key to read the current value from instead of `state`. |
| `min_attribute` | Attribute key to read the minimum bound from dynamically. |
| `max_attribute` | Attribute key to read the maximum bound from dynamically. |
| `update_mode` | When to send the value: `release` (default) or `drag`. |
| `live_progress` | Set to `false` to disable live tick interpolation for `media_position` sliders. Default: `true`. |
| `color` | Fill color as a theme token or hex value. Default: `primary`. |
| `background` | Track background color as a theme token or hex value. Default: `surface2`. |
| `thumb_color` | Thumb color as a theme token or hex value. Default: `text`. |
| `thumb_size` | Thumb diameter in pixels. Defaults to 90% of the track cross-dimension. |
| `radius` | Corner radius of the track in pixels. Defaults to half the track height (pill shape). |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `locked` | When `true`, the slider is non-interactive. Can be set via overrides. |
| `action` | Service action called when a value is chosen. The resolved value is passed as `$value`. |
| `overrides` | Ordered list of conditional override rules. See [Conditional Overrides](#conditional-overrides). |

---

## Range and Step

Set `min` and `max` to match the entity's value range. Set `step` to control the snapping increment:

```json
{ "min": 0, "max": 100, "step": 5 }
```

Decimal steps are supported. A `step` of `0.5` snaps to 0, 0.5, 1.0, 1.5, and so on:

```json
{ "min": 0.0, "max": 1.0, "step": 0.1 }
```

---

## Orientation

Set `orientation` to `vertical` for a vertical slider. The thumb moves from bottom (min) to top (max). Make sure `h` is larger than `w` for vertical sliders:

```json
{
  "type": "slider",
  "x": 20, "y": 20, "w": 40, "h": 200,
  "orientation": "vertical",
  "min": 0, "max": 100
}
```

---

## Entity Binding

Set `entity` to a HA entity ID. The slider reads the current value on page load from the entity state cache and updates whenever the entity changes. The thumb does not move while the user is dragging.

---

## Attribute Source

Set `value_attribute` when the numeric value lives in an entity attribute rather than the top-level state. Common examples:

| Entity type | `value_attribute` |
|-------------|-------------------|
| `light.*` | `brightness` |
| `media_player.*` | `volume_level`, `media_position` |
| `cover.*` | `current_position` |
| `climate.*` | `temperature`, `current_temperature` |
| `fan.*` | `percentage` |

```json
{
  "entity": "media_player.living_room",
  "value_attribute": "volume_level",
  "min": 0, "max": 1, "step": 0.01
}
```

---

## Dynamic Bounds

Use `min_attribute` and `max_attribute` to read the slider range from entity attributes instead of fixed config values. This is useful for climate entities where the min and max temperature are entity-reported:

```json
{
  "entity": "climate.living_room",
  "value_attribute": "temperature",
  "min_attribute": "min_temp",
  "max_attribute": "max_temp",
  "step": 0.5
}
```

When `min_attribute` or `max_attribute` is set, the corresponding fixed `min`/`max` value acts as a fallback until the entity state arrives.

---

## Action

The `action` property defines the service call made when the user finishes dragging. The resolved numeric value is available as `$value` in the service data:

```json
"action": {
  "type": "service",
  "service": "light.turn_on",
  "entity_id": "light.kitchen",
  "data": { "brightness": "$value" }
}
```

```json
"action": {
  "type": "service",
  "service": "media_player.volume_set",
  "entity_id": "media_player.living_room",
  "data": { "volume_level": "$value" }
}
```

```json
"action": {
  "type": "service",
  "service": "cover.set_cover_position",
  "entity_id": "cover.blinds",
  "data": { "position": "$value" }
}
```

```json
"action": {
  "type": "service",
  "service": "climate.set_temperature",
  "entity_id": "climate.living_room",
  "data": { "temperature": "$value" }
}
```

---

## Update Mode

`update_mode` controls when the action is sent during a drag:

| Value | Behaviour |
|-------|-----------|
| `release` | Action fires once when the user lifts their finger or releases the mouse. Default. |
| `drag` | Action fires continuously as the user drags. Useful for volume or brightness where real-time feedback is desirable. |

```json
{ "update_mode": "drag" }
```

Use `drag` mode with care on Wi-Fi connected devices. Sending a service call on every drag tick can flood the HA WebSocket connection.

---

## Media Position (Live Progress)

When `value_attribute` is set to `media_position`, the slider automatically interpolates the playback position between HA state updates using a 1-second timer. This keeps the thumb moving smoothly during playback without waiting for HA to push a new state.

The interpolation accounts for the `media_position_updated_at` timestamp and only advances the position when the player state is `playing`. It stops automatically when the user starts dragging.

To disable this behaviour and rely solely on HA state updates:

```json
{ "live_progress": false }
```

---

## Appearance

### Colors

```json
{
  "color": "primary",
  "background": "surface2",
  "thumb_color": "text"
}
```

All three colors support theme tokens or hex values and can be changed by override rules.

### Thumb size

The thumb defaults to 90% of the track's cross-dimension (height for horizontal, width for vertical). Override with `thumb_size` to set an exact pixel diameter:

```json
{ "thumb_size": 28 }
```

### Track radius

The track defaults to a pill shape (radius = half height). Use `radius` to control the roundness:

```json
{ "radius": 4 }
```

Setting `radius: 0` produces a flat rectangular track.

---

## Locking

Set `locked: true` to prevent dragging. The cursor changes to `not-allowed` and pointer events on the thumb are disabled. Locking can be applied dynamically via overrides:

```json
{
  "entity": "media_player.living_room",
  "value_attribute": "volume_level",
  "min": 0, "max": 1, "step": 0.01,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "off" } ] },
      "set": { "locked": true, "color": "icon_inactive" }
    }
  ]
}
```

---

## Conditional Overrides

Sliders support the full override system. The following properties can be changed by override rules:

`color`, `background`, `thumb_color`, `opacity`, `locked`

See the [Conditional Overrides](overrides.md) reference for full condition syntax, logic options, and source types.

---

## Examples

### Light brightness

```json
{
  "id": "kitchen_brightness",
  "type": "slider",
  "x": 20, "y": 80, "w": 280, "h": 36,
  "entity": "light.kitchen",
  "value_attribute": "brightness",
  "min": 0, "max": 255, "step": 1,
  "color": "primary",
  "background": "surface2",
  "action": {
    "type": "service",
    "service": "light.turn_on",
    "entity_id": "light.kitchen",
    "data": { "brightness": "$value" }
  }
}
```

### Volume with live drag feedback

```json
{
  "id": "tv_volume",
  "type": "slider",
  "x": 20, "y": 140, "w": 280, "h": 36,
  "entity": "media_player.tv",
  "value_attribute": "volume_level",
  "min": 0, "max": 1, "step": 0.02,
  "update_mode": "drag",
  "color": "primary",
  "action": {
    "type": "service",
    "service": "media_player.volume_set",
    "entity_id": "media_player.tv",
    "data": { "volume_level": "$value" }
  }
}
```

### Media playback position

```json
{
  "id": "media_seek",
  "type": "slider",
  "x": 20, "y": 200, "w": 380, "h": 28,
  "entity": "media_player.living_room",
  "value_attribute": "media_position",
  "max_attribute": "media_duration",
  "min": 0, "step": 1,
  "radius": 4,
  "thumb_size": 18,
  "color": "primary",
  "action": {
    "type": "service",
    "service": "media_player.media_seek",
    "entity_id": "media_player.living_room",
    "data": { "seek_position": "$value" }
  }
}
```

### Vertical cover position

```json
{
  "id": "blind_position",
  "type": "slider",
  "x": 340, "y": 20, "w": 40, "h": 200,
  "orientation": "vertical",
  "entity": "cover.living_room_blinds",
  "value_attribute": "current_position",
  "min": 0, "max": 100, "step": 5,
  "color": "primary",
  "action": {
    "type": "service",
    "service": "cover.set_cover_position",
    "entity_id": "cover.living_room_blinds",
    "data": { "position": "$value" }
  }
}
```

### Climate temperature with dynamic range

```json
{
  "id": "thermostat",
  "type": "slider",
  "x": 20, "y": 260, "w": 280, "h": 40,
  "entity": "climate.living_room",
  "value_attribute": "temperature",
  "min_attribute": "min_temp",
  "max_attribute": "max_temp",
  "step": 0.5,
  "color": "warning",
  "action": {
    "type": "service",
    "service": "climate.set_temperature",
    "entity_id": "climate.living_room",
    "data": { "temperature": "$value" }
  }
}
```
