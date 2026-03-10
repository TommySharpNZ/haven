# Widget: image

The image widget displays a static image or a dynamic image driven by a HA entity attribute. It supports object-fit scaling, rounded corners, an optional gradient overlay, and fullscreen tap-to-expand. A common use case is displaying media player album art that updates as tracks change.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Static Images](#static-images)
- [Entity-driven Images](#entity-driven-images)
- [Fit Modes](#fit-modes)
- [Gradient Overlay](#gradient-overlay)
- [Fullscreen on Tap](#fullscreen-on-tap)
- [Overrides](#overrides)
- [Examples](#examples)

---

## Minimal Example

A static floor plan image:

```json
{
  "id": "floorplan",
  "type": "image",
  "x": 10, "y": 10, "w": 400, "h": 300,
  "url": "images/floorplan.jpg",
  "fit": "contain"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `url` | URL of the image to display. Supports relative paths, absolute paths, and full URLs. Supports `{{ ... }}` template expressions. |
| `fit` | How the image fills the widget bounds. See [Fit Modes](#fit-modes). Default: `cover`. |
| `radius` | Corner radius in pixels. Default: `0`. |
| `background` | Background color shown behind the image (visible when `fit` is `contain` and the image does not fill the widget). Default: `transparent`. |
| `gradient` | Optional gradient overlay drawn on top of the image. See [Gradient Overlay](#gradient-overlay). |
| `entity` | HA entity ID. Used to drive the image URL via `entity_attribute` or override rules. |
| `entity_attribute` | Attribute key on the entity whose value is used as the image URL. |
| `fullscreen_on_tap` | Set to `true` to open the image fullscreen when tapped. Default: `false`. |
| `overrides` | Ordered list of conditional override rules. `url` can be set by override rules. |

---

## Static Images

Set `url` to display a fixed image. Paths are resolved relative to the HAven install location:

```json
{ "url": "images/floorplan.jpg" }
```

Absolute paths starting with `/` are resolved relative to the HA origin:

```json
{ "url": "/local/haven/images/logo.png" }
```

Full HTTP/HTTPS URLs are used as-is:

```json
{ "url": "https://example.com/image.jpg" }
```

---

## Entity-driven Images

### From an entity attribute

Set `entity` and `entity_attribute` to display an image whose URL is stored in an entity attribute. The image updates whenever the entity changes. A cache-busting timestamp is appended automatically to avoid stale images when the URL path stays the same between updates (common with media player album art).

```json
{
  "type": "image",
  "x": 10, "y": 10, "w": 120, "h": 120,
  "entity": "media_player.living_room",
  "entity_attribute": "entity_picture",
  "fit": "cover",
  "radius": 8
}
```

### From a template expression in url

The `url` field supports `{{ ... }}` template expressions evaluated against the bound entity state:

```json
{
  "type": "image",
  "entity": "input_select.weather_condition",
  "url": "images/weather/{{ state }}.png",
  "fit": "contain"
}
```

### From an override rule

Override rules can swap the image URL based on entity state:

```json
{
  "type": "image",
  "entity": "binary_sensor.front_door",
  "url": "images/door-closed.png",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "url": "images/door-open.png" }
    }
  ]
}
```

---

## Fit Modes

The `fit` property controls how the image is scaled to fill the widget bounds:

| Value | Behaviour |
|-------|-----------|
| `cover` (default) | Scales the image to fill the widget, cropping the edges if the aspect ratio differs |
| `contain` | Scales the image to fit entirely within the widget, leaving empty space if the aspect ratio differs |
| `fill` | Stretches the image to exactly fill the widget, ignoring aspect ratio |
| `none` | Displays the image at its natural size with no scaling |

Use `cover` for decorative backgrounds and thumbnails. Use `contain` for diagrams, floor plans, or any image where cropping would lose important content.

---

## Gradient Overlay

A `gradient` object can be layered on top of the image. This is useful for adding a dark vignette at the bottom to keep overlaid text readable. The gradient is drawn over the image with `pointer-events: none`, so taps still pass through to the fullscreen handler if enabled.

```json
{
  "url": "images/room.jpg",
  "gradient": {
    "from": "rgba(0,0,0,0)",
    "to": "rgba(0,0,0,0.7)",
    "angle": 180,
    "start_pct": 50,
    "end_pct": 100
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `from` | required | Start color (theme token or hex/rgba). |
| `to` | required | End color (theme token or hex/rgba). |
| `angle` | `180` | Gradient direction in degrees. `180` = top to bottom. |
| `start_pct` | `60` | Position (0-100) where the transition begins. |
| `end_pct` | `100` | Position (0-100) where the transition ends. |

---

## Fullscreen on Tap

Set `fullscreen_on_tap: true` to open the image in a fullscreen overlay when tapped. The overlay shows the image scaled to fit the screen (`contain`), with a close button and tap-outside-to-close behaviour.

```json
{
  "type": "image",
  "x": 10, "y": 10, "w": 200, "h": 150,
  "url": "images/floorplan.jpg",
  "fit": "cover",
  "fullscreen_on_tap": true
}
```

The fullscreen overlay always shows the current image URL, including dynamically resolved entity attribute URLs.

---

## Overrides

The `url` property can be changed by override rules, allowing the displayed image to switch based on entity state, attributes, or page. All standard condition types and sources apply.

See the [Conditional Overrides](overrides.md) reference for full condition syntax.

---

## Examples

### Floor plan with fullscreen tap

```json
{
  "id": "floorplan",
  "type": "image",
  "x": 10, "y": 10, "w": 460, "h": 280,
  "url": "images/floorplan.jpg",
  "fit": "contain",
  "radius": 8,
  "background": "surface",
  "fullscreen_on_tap": true
}
```

### Media player album art

```json
{
  "id": "album_art",
  "type": "image",
  "x": 10, "y": 10, "w": 120, "h": 120,
  "entity": "media_player.living_room",
  "entity_attribute": "entity_picture",
  "fit": "cover",
  "radius": 6
}
```

### State-driven image swap

```json
{
  "id": "door_image",
  "type": "image",
  "x": 10, "y": 10, "w": 160, "h": 120,
  "entity": "binary_sensor.front_door",
  "url": "images/door-closed.png",
  "fit": "contain",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "url": "images/door-open.png" }
    }
  ]
}
```

### Image with gradient overlay and label

A room photo with a dark bottom gradient so an overlaid label remains readable:

```json
{
  "id": "room_photo",
  "type": "image",
  "x": 0, "y": 0, "w": 480, "h": 200,
  "url": "images/living-room.jpg",
  "fit": "cover",
  "gradient": {
    "from": "rgba(0,0,0,0)",
    "to": "rgba(0,0,0,0.65)",
    "angle": 180,
    "start_pct": 40,
    "end_pct": 100
  },
  "fullscreen_on_tap": true
}
```
