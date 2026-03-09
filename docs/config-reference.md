# Config Reference

HAven device configs are JSON files stored in the `devices/` folder. Each file defines a single device: its canvas size, theme colors, pages, and all widgets. This page covers everything except individual widget types, which are documented in [Widget Reference](widgets.md).

---

## Contents

- [Top-Level Structure](#top-level-structure)
- [device block](#device-block)
- [theme block](#theme-block)
- [pages array](#pages-array)
- [Page 0 - Persistent Overlay](#page-0---persistent-overlay)
- [Page Background Images](#page-background-images)
- [Icons](#icons)
- [Actions](#actions)
- [Conditional Overrides](#conditional-overrides)
- [Internal Entities](#internal-entities)
- [Performance Notes](#performance-notes)

---

## Top-Level Structure

```json
{
  "version": "1.0",
  "device": { ... },
  "theme": { ... },
  "pages": [ ... ]
}
```

| Field | Description |
|-------|-------------|
| `version` | Config format version. Currently `"1.0"`. |
| `device` | Device settings: canvas size, screensaver, navigation. |
| `theme` | Color tokens and base font size. |
| `pages` | Array of page objects, each containing widgets. |

---

## device block

```json
"device": {
  "name": "Kitchen Tablet",
  "canvas": { "width": 1024, "height": 768 },
  "default_page": 1,
  "return_to_default": 60,
  "screensaver": {
    "timeout": 300,
    "opacity": 0.95,
    "text": "HAven"
  },
  "page_nav": {
    "show": true,
    "background_color": "rgba(0,0,0,0.20)",
    "primary_color": "text",
    "secondary_color": "#6f7781",
    "size": "medium"
  }
}
```

| Field | Description |
|-------|-------------|
| `name` | Human-readable label for this device. |
| `canvas.width` | Design width in pixels. |
| `canvas.height` | Design height in pixels. |
| `default_page` | Page ID to load on startup and return to after inactivity. |
| `return_to_default` | Seconds of inactivity before returning to `default_page`. Set to `0` or omit to disable. |
| `screensaver` | Optional screensaver config (see below). Omit to disable. |
| `page_nav` | Optional navigation dot styling (see below). |
| `page_navigation` | Alias for `page_nav`. Same fields. |
| `ha_token` | Optional Long-Lived Access Token embedded in config (see [Credentials](getting-started.md#credentials--security)). |
| `ha_url` | Optional HA URL override. Defaults to `window.location.origin`. |

### Screensaver

When configured, HAven dims the screen after a period of inactivity. Any touch, tap, swipe, or `haven_command` event dismisses it.

| Field | Default | Description |
|-------|---------|-------------|
| `timeout` | (required) | Seconds of inactivity before activating. |
| `opacity` | `0.2` | Overlay darkness: `0.0` = transparent, `1.0` = fully black. |
| `text` | (none) | Optional text shown on the screensaver overlay. Bounces around DVD-logo style; colour cycles on each bounce. Omit for a plain dark overlay. |

```json
"screensaver": {
  "timeout": 300,
  "opacity": 0.95,
  "text": "HAven Dashboard"
}
```

### Page navigation dots

| Field | Default | Description |
|-------|---------|-------------|
| `show` | `true` | Show or hide the navigation dot bar. |
| `background_color` | semi-transparent | Background pill color. Accepts theme tokens or any CSS color. |
| `primary_color` | `text` | Color of the active/current page dot. |
| `secondary_color` | muted grey | Color of inactive dots. |
| `size` | `medium` | Dot size: `small`, `medium`, or `large`. |

Set `"show": false` to hide the built-in dots entirely, for example when using custom navigation buttons.

---

## theme block

Color tokens are named values referenced throughout widget configs. Any widget property that accepts a color can use either a token name (`"primary"`) or a literal hex/rgb value (`"#8ADF45"`).

```json
"theme": {
  "colors": {
    "background":    "#161C23",
    "surface":       "#272E36",
    "surface2":      "#363f4a",
    "primary":       "#8ADF45",
    "warning":       "#F0AD4E",
    "danger":        "#D9534F",
    "text":          "#FFFFFF",
    "text_dim":      "#e6e6e6",
    "text_muted":    "#9fa5ad",
    "icon_inactive": "#464c53"
  },
  "font_size": 16
}
```

### Standard tokens

These ten tokens are used internally by HAven as widget defaults. They must be present in the `colors` block. You can change their hex values freely, but do not rename or remove them.

| Token | Default | Typical use |
|-------|---------|-------------|
| `background` | `#161C23` | Canvas/page background |
| `surface` | `#272E36` | Card and panel backgrounds |
| `surface2` | `#363f4a` | Elevated surfaces, active button backgrounds |
| `primary` | `#8ADF45` | Active states and highlights |
| `warning` | `#F0AD4E` | Warning-level values |
| `danger` | `#D9534F` | Error and alert values |
| `text` | `#FFFFFF` | Primary text |
| `text_dim` | `#e6e6e6` | Secondary text |
| `text_muted` | `#9fa5ad` | Inactive and hint text |
| `icon_inactive` | `#464c53` | Icons in off/inactive state |

### Custom tokens

Add any extra tokens to the `colors` block and reference them anywhere a color is accepted:

```json
"colors": {
  "background": "#161C23",
  ...
  "solar":  "#FFD700",
  "grid":   "#4488FF",
  "export": "#FF8844"
}
```

### font_size

`theme.font_size` sets the base font size in pixels. Individual widgets can override this with their own `font_size` property.

---

## pages array

Pages are the screens users navigate between. Each page is an object with an `id`, optional metadata, and a `widgets` array.

```json
"pages": [
  { "id": 1, "label": "Energy",  "widgets": [ ... ] },
  { "id": 2, "label": "Lights",  "widgets": [ ... ] },
  { "id": 3, "label": "Cameras", "widgets": [ ... ] }
]
```

Users navigate between pages by swiping left/right or tapping the navigation dots.

### Page properties

| Property | Description |
|----------|-------------|
| `id` | Unique integer. Referenced by navigation actions and `default_page`. |
| `label` | Display name shown in the navigation dot tooltip. |
| `background_image` | Path or URL to a background image (see below). |
| `background_image_opacity` | Image brightness: `0.0` to `1.0`. |
| `background_image_fit` | `cover` (default, may crop) or `contain` (letterbox). |
| `widgets` | Array of widget objects on this page. |

---

## Page 0 - Persistent Overlay

A page with `"id": 0` is treated as a persistent overlay. Its widgets render on top of every other page at all times. Page 0 does not appear in the navigation dots and cannot be navigated to directly.

Use it for always-on elements: clocks, connection indicators, navigation buttons, or status bars.

```json
{ "id": 0, "widgets": [ ... ] }
```

Background image, opacity, and fit are not applicable to page 0 (it renders transparently over the current page).

---

## Page Background Images

Pages can display a background image beneath their widgets.

```json
{
  "id": 1,
  "label": "Home",
  "background_image": "images/wallpaper.jpg",
  "background_image_opacity": 0.3,
  "background_image_fit": "cover",
  "widgets": []
}
```

| Property | Values | Description |
|----------|--------|-------------|
| `background_image` | path or URL | Relative paths resolve from the `haven/` folder. |
| `background_image_opacity` | `0.0` to `1.0` | `1.0` = full brightness, `0.1` = very subtle. |
| `background_image_fit` | `cover` (default), `contain` | How the image fills the canvas. |

---

## Icons

HAven bundles [Material Design Icons](https://pictogrammers.com/library/mdi/) (MDI) locally. No internet connection is required to display icons. MDI is the same icon set used by Home Assistant's own UI.

Use `[mdi:icon-name]` syntax in any label `text` or button `icon` field:

```json
"text": "[mdi:fire] Heating"
"text": "[mdi:lightbulb-outline] Living Room"
"icon": "[mdi:lightbulb]"
```

Icons and text can be freely mixed in a single string. The icon name matches the MDI name exactly, the same name you would use in a HA `icon:` field.

Full icon library: https://pictogrammers.com/library/mdi/

### Spacing around icons

Regular spaces work fine in plain text, but flex rendering collapses spaces directly adjacent to icon spans. Use `&nbsp;` when you need a guaranteed gap next to an icon:

```json
"text": "[mdi:home]&nbsp;Living Room"
"text": "Solar&nbsp;[mdi:weather-sunny]"
```

`&amp;`, `&lt;`, `&gt;`, and `&quot;` are also supported.

---

## Actions

Tappable widgets (button, rectangle, slider, switch, image, camera) support an `action` property that fires when the widget is tapped.

### Navigate to a page

```json
"action": { "type": "navigate", "page": 2 }
```

Directional navigation:

```json
"action": { "type": "navigate", "direction": "next" }
"action": { "type": "navigate", "direction": "prev" }
"action": { "type": "navigate", "direction": "home" }
```

- `direction: "home"` navigates to the first non-overlay page.
- At the first or last page, `prev` and `next` do nothing.
- If both `page` and `direction` are set, `page` takes priority.

### Trigger an automation

```json
"action": { "type": "automation", "entity_id": "automation.good_night" }
```

### Call a service

```json
"action": { "type": "service", "service": "light.turn_on", "entity_id": "light.kitchen" }
```

With optional service data:

```json
"action": {
  "type": "service",
  "service": "light.turn_on",
  "entity_id": "light.kitchen",
  "data": { "brightness": 128, "color_temp": 350 }
}
```

### Slider value token

For slider widgets, use `"$value"` in `action.data` to inject the current slider position at call time:

```json
"action": {
  "type": "service",
  "service": "media_player.volume_set",
  "entity_id": "media_player.living_room",
  "data": { "volume_level": "$value" }
}
```

---

## Conditional Overrides

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

### Condition logic

| Field | Values | Description |
|-------|--------|-------------|
| `logic` | `all`, `any` | `all` requires every condition to match (AND). `any` requires at least one (OR). |
| `conditions` | array | One or more condition objects. |

### Condition types

| Type | Description |
|------|-------------|
| `above` | Numeric value is greater than `value`. |
| `below` | Numeric value is less than `value`. |
| `equals` | Value matches `value` exactly (string or number). |
| `not_equals` | Value does not match `value`. |

### Condition sources

The `source` field controls what value the condition tests against:

| Source | Tests against | Notes |
|--------|---------------|-------|
| `state` | Primary entity state | Default when `source` is omitted. |
| `attribute` | A named attribute of the primary entity | Requires an `"attribute"` key naming the attribute. Returns false if the attribute is missing. |
| `state2` | Secondary entity (`entity2`) state | Returns false if `entity2` is not configured. |
| `attribute2` | A named attribute of `entity2` | Requires an `"attribute"` key. Returns false if missing. |
| `page` | Current page ID | No entity required. Useful for page-aware visibility or styling on overlay widgets. |

Examples:

```json
{ "source": "state",      "type": "equals", "value": "on" }
{ "source": "attribute",  "attribute": "hvac_action",   "type": "equals", "value": "heating" }
{ "source": "attribute",  "attribute": "brightness",    "type": "above",  "value": 128 }
{ "source": "state2",                                   "type": "above",  "value": 0 }
{ "source": "attribute2", "attribute": "battery_level", "type": "below",  "value": 20 }
{ "source": "page",                                     "type": "equals", "value": 2 }
```

### Controlling visibility

Use `set.visible` in an override rule to show or hide any widget:

```json
"overrides": [
  {
    "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "shuffle", "type": "equals", "value": true } ] },
    "set": { "visible": true }
  },
  {
    "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "shuffle", "type": "not_equals", "value": true } ] },
    "set": { "visible": false }
  }
]
```

### Properties settable via overrides

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

## Internal Entities

HAven provides a small set of built-in entity IDs that work exactly like HA entities in widget bindings:

| Entity ID | State | Updates |
|-----------|-------|---------|
| `internal.connectionstatus` | `connected`, `connecting`, or `disconnected` | On WebSocket state change |
| `internal.currentdtm` | ISO datetime string | Once per minute |

Example:clock label using the internal datetime entity:

```json
{
  "type": "label",
  "entity": "internal.currentdtm",
  "prefix": "[mdi:clock-outline]&nbsp;",
  "format": "time_24",
  "x": 20, "y": 10, "w": 200, "h": 40,
  "font_size": 24,
  "color": "text"
}
```

Example:connection indicator dot using overrides:

```json
{
  "type": "rectangle",
  "entity": "internal.connectionstatus",
  "x": 1004, "y": 748, "w": 12, "h": 12,
  "radius": 6,
  "background": "danger",
  "overrides": [
    { "when": { "logic": "all", "conditions": [{ "type": "equals", "value": "connected" }] },    "set": { "background": "primary" } },
    { "when": { "logic": "all", "conditions": [{ "type": "equals", "value": "connecting" }] },   "set": { "background": "warning" } }
  ]
}
```

---

## Performance Notes

HAven is lightweight, but a few patterns can add overhead on a busy HA instance.

**Override rules:** every `state_changed` event for a registered entity re-evaluates all of that widget's override rules. A page with 50 widgets each having 5 rules runs 250 condition checks per event. Keep override lists short and use `logic: "any"` where possible to short-circuit early.

**`entity2` bindings:** each `entity2` registers an additional callback independently of `entity`. Use it only where a second entity genuinely drives the widget's appearance.

**`history_chart` widgets:** each chart makes a `recorder/statistics_during_period` WebSocket request on page load and again on its `refresh_interval` timer. The default interval is 3600 seconds (1 hour). Only lower it when you need near-real-time charting.

**Camera snapshot/poster intervals:** each camera in `snapshot` or `poster` mode polls HA at `refresh_interval`. Prefer `mjpeg` for live feeds (one persistent connection). Use `poster` with a longer interval (60 s or more) for off-screen or secondary cameras.

**Console diagnostic:** when a page loads, HAven logs a summary to the browser console:

```
HAven page 1: 24 widgets, 18 entity, 3 entity2, 41 override rules
```

Use this to spot pages that have grown unexpectedly large.
