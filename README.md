## HAven
### *A lightweight Home Assistant dashboard for screens that Lovelace left behind*

That old iPad gathering dust. The Android tablet mounted on the kitchen wall. The Fire HD you picked up for $30. HAven gives them a second life as always-on Home Assistant displays — no addons, no server-side code, no install. Just static files dropped into your HA `www/` folder and a browser that can open a URL.

Inspired by the pixel-perfect philosophy of [OpenHASP](https://openhasp.com) — itself built on [LVGL](https://lvgl.io), the embedded graphics library that brought beautiful UIs to microcontrollers. HAven borrows the same core idea: a fixed canvas, absolute widget placement, and JSON-driven config files. But instead of flashing firmware onto an ESP32, you point a browser at a URL.

Written in vanilla ES5 JavaScript with no framework dependencies, HAven tries really hard to work on even the oldest browsers — ancient iPad Safaris, budget Android WebViews, smart TV browsers from 2016. No guarantees, but if it has a browser and can reach your HA instance, there's a good chance it'll run.

---

## Contents

- [Installation](#installation)
- [How It Works](#how-it-works)
- [Device Config Structure](#device-config-structure)
- [Theming](#theming)
- [Icons](#icons)
- [Actions](#actions)
- [Widget Types](#widget-types)
  - [label](#label)
  - [rectangle](#rectangle)
  - [bar](#bar)
  - [slider](#slider)
  - [switch](#switch)
  - [scene](#scene)
  - [button](#button)
  - [clock](#clock)
  - [image](#image)
  - [camera](#camera)
  - [arc](#arc)
  - [agenda](#agenda)
  - [history\_chart](#history_chart)
- [Pages & Navigation](#pages--navigation)
- [Credentials & Security](#credentials--security)
- [Connection Status](#connection-status)
- [Internal Entities](#internal-entities)
- [Visual Designer](#visual-designer)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Installation

1. Copy the `haven/` folder into your Home Assistant `config/www/` directory
2. Navigate to `http://your-ha-ip:8123/local/haven/index.html?device=example`
3. On first load, enter your HA URL and a Long-Lived Access Token when prompted
4. Edit `devices/example.json` or create your own device config files

```
config/
  www/
    haven/
      index.html
      app.js
      style.css
      fonts/
      devices/
        example.json      ← start here
        my-tablet.json    ← your own device config
```

### Getting a Long-Lived Access Token

1. In Home Assistant go to your Profile (bottom-left avatar)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**, give it a name e.g. "Kitchen Tablet"
4. Copy the token immediately - it is only shown once

---

## How It Works

- Each tablet/device has its own JSON config file in `devices/`
- `?device=ipad` in the URL loads `devices/ipad.json`
- Omit `?device=` to load `devices/default.json` (if missing, a landing/help page is shown)
- The config defines a fixed canvas size (e.g. 1024x768) and all widgets are placed at absolute pixel positions within that canvas
- The canvas scales uniformly to fill whatever screen it is displayed on - like a retro game emulator
- On load the app connects to HA via WebSocket, fetches current entity states, then subscribes to `state_changed` events
- When an entity changes, only the DOM elements bound to that entity are updated - no page re-renders

---

## Device Config Structure

```json
{
  "version": "1.0",
  "device": {
    "name": "Kitchen Tablet",
    "canvas": { "width": 1024, "height": 768 },
    "default_page": 1,
    "return_to_default": 60
  },
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
  },
  "pages": [
    {
      "id": 1,
      "label": "Home",
      "widgets": []
    }
  ]
}
```

### device block

| Field | Description |
|-------|-------------|
| `name` | Human readable label for this device |
| `canvas.width` | Design width in pixels |
| `canvas.height` | Design height in pixels |
| `default_page` | Page ID to show on load and return to after inactivity |
| `return_to_default` | Seconds of inactivity before returning to default page |
| `screensaver` | Optional. Object with `timeout` (seconds), `opacity` (0.0–1.0, default 0.2), `text` (optional overlay label). Set `timeout: 0` or omit to disable. |
| `page_nav` | Optional nav dot config (`show`, `background_color`, `primary_color`, `secondary_color`, `size`) |
| `page_navigation` | Optional alias for `page_nav` (same fields). Useful if you prefer a clearer name. |

---

## Design Considerations

HAven scales a fixed design canvas to fit the screen, so you usually do **not** need to design at native panel resolution.

- Prefer a practical tablet-friendly base like `1024x768`, `1280x800`, or `1366x768`.
- Use native resolutions (for example iPad Pro `2723x2048`) only when you truly need very dense layouts.
- Lower design resolutions are easier to build/maintain and generally produce better touch ergonomics (larger tap targets).
- The same config can then scale cleanly across different devices.

### Things worth keeping an eye on as your config grows

HAven is designed to be lightweight, but a few patterns can quietly add overhead on a busy HA instance:

**Override rules** — Every HA state_changed event that matches a registered entity re-evaluates all of that widget's override rules. A page with 50 widgets each having 5 override rules runs 250 condition checks per relevant event. Keep override lists short; use `logic: "any"` where possible to short-circuit early.

**`entity2` bindings** — Each `entity2` registers an additional callback independent of `entity`. A page with many widgets using both doubles the number of registered entity callbacks. Use `entity2` only where you genuinely need a second entity to drive appearance.

**`history_chart` widgets** — Each chart makes a `recorder/statistics_during_period` WebSocket request on page load and again on its `refresh_interval` timer. Multiple charts with short refresh intervals generate sustained WS traffic. Default `refresh_interval` is 3600 (1 hour); only lower it when you need near-real-time charting.

**Camera poster/snapshot intervals** — Each camera in `poster` or `snapshot` mode polls HA at its `refresh_interval`. With many cameras and short intervals this can generate noticeable bandwidth and CPU load. Prefer `mjpeg` for live feeds (one persistent connection); use `poster` with a longer interval (60 s+) for off-screen or rarely-checked cameras.

**Console diagnostic** — When a page loads, HAven logs a summary to the browser console:
```
HAven page 1: 24 widgets, 18 entity, 3 entity2, 41 override rules
```
Use this to spot pages that have grown unexpectedly large.

---

## Theming

Common colors are defined as named tokens in the `theme.colors` block. Any widget property that accepts a color can use either a token name (`"primary"`) or a literal hex value (`"#8ADF45"`). Tokens are resolved at render time.

**Default tokens:**

| Token | Default | Use |
|-------|---------|-----|
| `background` | `#161C23` | Canvas/page background |
| `surface` | `#272E36` | Card/panel backgrounds |
| `surface2` | `#363f4a` | Elevated surface, active button backgrounds |
| `primary` | `#8ADF45` | Active state, highlights |
| `warning` | `#F0AD4E` | Warning values |
| `danger` | `#D9534F` | Alert/error values |
| `text` | `#FFFFFF` | Primary text |
| `text_dim` | `#e6e6e6` | Secondary text |
| `text_muted` | `#9fa5ad` | Inactive/hint text |
| `icon_inactive` | `#464c53` | Icons in off state |

**Change the hex values freely.** The token names above are reserved — the app uses them internally as defaults (e.g. labels default to `text`, arc labels default to `text_muted`). Removing or renaming them will break those defaults. You can add extra tokens (e.g. `"solar": "#FFD700"`) and reference them anywhere a color is accepted.

### Page background images

Pages can have a background image:

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
| `background_image` | path or URL | Relative paths resolve from the haven folder |
| `background_image_opacity` | 0.0–1.0 | 1.0 = full brightness, 0.1 = very subtle |
| `background_image_fit` | `cover` (default), `contain` | How the image fills the canvas |

---

## Icons

HAven uses [Material Design Icons](https://pictogrammers.com/library/mdi/) (MDI), bundled locally - no internet required. MDI is the same icon set used by Home Assistant's own UI, so names are already familiar if you've written HA config YAML.

Use `[mdi:icon-name]` syntax anywhere in label `text` or button `icon` fields:

```json
"text":     "[mdi:fire] Heating"
"text":     "[mdi:lightbulb-outline] Living Room : 3 lights on"
"text":     "[mdi:solar-panel] 1.4 kW"
"icon": "[mdi:lightbulb-outline]"
```

Icons and text can be freely mixed in a single string. The icon name matches the MDI name exactly - the same name you'd use in a HA entity `icon:` field.

Full icon library: https://pictogrammers.com/library/mdi/

> **Font files required:** Place `materialdesignicons-webfont.woff2` and `materialdesignicons.css` in the `fonts/` folder.

**Spacing around icons**

Regular spaces work fine in plain text. However flex rendering collapses spaces that are directly adjacent to icon spans. Use `&nbsp;` when you need guaranteed space next to an icon:

```json
"text": "[mdi:home]&nbsp;Living Room"
"text": "Solar&nbsp;[mdi:weather-sunny]"
"text": "12.4&nbsp;[mdi:arrow-right]&nbsp;8.1"
```

`&amp;`, `&lt;`, `&gt;`, and `&quot;` are also supported.

## Actions : Still to be tested!!!

Any tappable widget can have an `action` property. Three types are supported:

### Navigate to a page : Still to be tested!!!
```json
"action": { "type": "navigate", "page": 2 }
```

Directional navigation is also supported:

```json
"action": { "type": "navigate", "direction": "next" }
"action": { "type": "navigate", "direction": "prev" }
"action": { "type": "navigate", "direction": "home" }
```

Notes:
- `direction: "home"` navigates to the first non-overlay page.
- At the first/last page, `prev`/`next` does nothing.
- If both `page` and `direction` are set, `page` wins.

### Trigger an automation : Still to be tested!!!
```json
"action": { "type": "automation", "entity_id": "automation.good_night" }
```

### Call a service : Still to be tested!!!
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

**Slider value token (`$value`)**

For slider widgets, `"$value"` in `action.data` is replaced at call time with the current slider value.

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

Widgets support ordered conditional overrides via an `overrides` array. Each rule has a `when` block (logic + conditions) and a `set` block (attributes to override). Rules are evaluated in order and all matching rules are applied — later rules win.

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

**Condition logic**
- `logic`: `all` (AND) or `any` (OR)
- `conditions`: array of condition objects
- Condition types: `above`, `below`, `equals`, `not_equals`
- Conditions can be nested using groups with their own `logic`/`conditions`

**Condition sources**

The `source` field controls what value a condition tests against:

| Source | Tests against | Notes |
|--------|---------------|-------|
| `state` | Primary entity state string/number | Default when `source` is omitted |
| `attribute` | A specific attribute of the primary entity | Requires an `"attribute"` key. Returns false if attribute is missing. |
| `state2` | Secondary entity (`entity2`) state value | Returns false if `entity2` not configured |
| `attribute2` | An attribute of `entity2` | Requires an `"attribute"` key. Returns false if attribute is missing. |
| `page` | Current page id | No entity required. Useful for page-aware visibility/styling. |

```json
{ "source": "state",      "type": "equals", "value": "on" }
{ "source": "attribute",  "attribute": "hvac_action",   "type": "equals", "value": "heating" }
{ "source": "attribute",  "attribute": "brightness",    "type": "above",  "value": 128 }
{ "source": "state2",     "type": "above",  "value": 0 }
{ "source": "attribute2", "attribute": "battery_level", "type": "below",  "value": 20 }
{ "source": "page",       "type": "equals", "value": 1 }
```

**Visibility via overrides (`set.visible`)**

Use `set.visible` inside override rules to show or hide any widget.

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

---

## Widget Types

All widgets share these base properties:

| Property | Description |
|----------|-------------|
| `id` | Unique string identifier |
| `type` | Widget type name |
| `x` | Left position in pixels |
| `y` | Top position in pixels |
| `w` | Width in pixels |
| `h` | Height in pixels |
| `opacity` | 0.0–1.0, optional |
| `border_width` | Border thickness in px, optional |
| `border_color` | Border color - token or hex, optional |
| `groupid` | Designer grouping hint, ignored at runtime |

---

### label

Displays text. Can be bound to a HA entity for live updates with state-based styling.

```json
{
  "id": "solar_power",
  "type": "label",
  "x": 160, "y": 50, "w": 220, "h": 60,
  "text": "--",
  "font_size": 52,
  "align": "right",
  "color": "icon_inactive",
  "background": "surface",
  "letter_spacing": 1,
  "entity": "sensor.pv_power",
  "format": "power",
  "overrides": [
    { "when": { "logic": "all", "conditions": [ { "source": "state", "type": "above", "value": 0 } ] },
      "set": { "color": "primary" } }
  ]
}
```

| Property | Description |
|----------|-------------|
| `text` | Static text. Supports `[mdi:icon-name]` icons and `{{ ... }}` templates. Used as placeholder before entity loads. |
| `font_size` | Size in pixels |
| `align` | `left`, `center`, or `right` |
| `valign` | Vertical alignment: `top`, `center` (default), or `bottom` |
| `color` | Text color - token or hex. Supports `{{ ... }}` templates. |
| `background` | Background color - token or hex |
| `letter_spacing` | Letter spacing in px |
| `font_weight` | CSS font-weight value (e.g. `400`, `600`, `bold`) |
| `animation` | Optional animation: `none`, `pulse`, `pulse_fast`, `blink`, `breathe` |
| `entity` | Primary HA entity ID for live value |
| `entity_attribute` | Optional primary entity attribute key to use as value source (e.g. `media_title`, `media_artist`) |
| `entity2` | Secondary HA entity ID. Label re-renders when either entity changes. |
| `format` | How to format the entity value (see below) |
| `prefix` | Text prefix for `power_prefix` format |
| `overrides` | Conditional attribute overrides (ordered). See [Conditional Overrides](#conditional-overrides). |

**Format values:**

| Format | Example output |
|--------|----------------|
| `power` | `948 w` or `1.23 kW` (auto-scales) |
| `power_abs` | Same but absolute value (useful for bidirectional sensors) |
| `power_prefix` | Power value with a text prefix from the `prefix` field |
| `kwh` | `25.0 kWh` |
| `percent` | `89%` |
| `time_24` | `14:05` |
| `time_12` | `2:05 PM` |
| `date_iso` | `2026-02-27` |
| `date_short` | `27 Feb` |
| `datetime_24` | `2026-02-27 14:05` |
| `datetime_12` | `2026-02-27 2:05 PM` |
| *(none)* | Raw entity state string |

**entity2 — secondary entity binding**

Labels can subscribe to a second entity with `entity2`. The label re-renders whenever either entity changes. `entity` remains the primary (drives `format`, default override tests, and template variables `state`/`state_str`/`attr`). `entity2` adds `state2`/`state_str2`/`attr2` template variables and the `state2`/`attribute2` condition sources.

**Attribute source on labels**

Use `entity_attribute` when the displayed value lives in a HA attribute instead of state (common for media player metadata):

```json
{
  "type": "label",
  "entity": "media_player.living_room",
  "entity_attribute": "media_title",
  "x": 20, "y": 340, "w": 420, "h": 40,
  "font_size": 28,
  "align": "left",
  "color": "text"
}
```

```json
{
  "type": "label",
  "entity": "sensor.total_kwh",
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

**Conditional overrides — label-specific `set` properties:**

`text`, `color`, `background`, `font_size`, `opacity`, `border_color`, `border_width`, `animation`.

**Label animation**

Labels support optional `animation` values:
- `none` (default)
- `pulse` (gentle ~2s fade)
- `pulse_fast` (~0.8s)
- `blink` (hard on/off)
- `breathe` (subtle scale 1.0 → 1.05 → 1.0)

See [Conditional Overrides](#conditional-overrides) for full condition syntax including `attribute`, `state2`, and `attribute2` sources.

---

### Template expressions

Labels can include `{{ ... }}` expressions in their `text` and `color` fields. Expressions are evaluated locally against the bound entity state.

**Variables**
- `state` — primary entity value (numeric if possible, otherwise string)
- `state_str` — primary entity state (always string)
- `attr.<name>` — primary entity attribute
- `state2` — secondary entity value (requires `entity2`)
- `state_str2` — secondary entity state string
- `attr2.<name>` — secondary entity attribute

**Functions**
- `round(x, n)`, `min(a,b)`, `max(a,b)`, `abs(x)`, `floor(x)`, `ceil(x)`

**Syntax / operators (JavaScript-style)**
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparisons: `>`, `<`, `>=`, `<=`, `==`, `!=`, `===`, `!==`
- Boolean logic: `&&`, `||`, `!`
- Conditional (ternary): `condition ? value_if_true : value_if_false`
- Parentheses for grouping: `( ... )`

**Common patterns**
- Null-safe attribute fallback:
  `{{ attr.volume_level != null ? attr.volume_level : 0 }}`
- Volume percent from HA `0..1` attribute:
  `{{ attr.volume_level != null ? (round(attr.volume_level * 100, 0) + '%') : '--' }}`
- Choose color by threshold:
  `{{ state > 5000 ? 'danger' : (state > 1000 ? 'warning' : 'primary') }}`
- Combine values from `entity` + `entity2`:
  `{{ round(state, 1) }} kW / {{ round(state2, 1) }} kW`

**Example**
```json
{
  "type": "label",
  "entity": "sensor.temperature",
  "text": "[mdi:thermometer]&nbsp;{{ round(state, 1) }} °C"
}
```

**Conditional example**
```json
{
  "type": "label",
  "entity": "sensor.master_house_total_power",
  "text": "{{ round((state / 1000), 2) }} kW",
  "color": "{{ ((state/1000)/21*100) <= 33 ? '#008000' : ((state/1000)/21*100) <= 66 ? '#cc7a00' : '#cc0000' }}"
}
```

---

### rectangle

A rectangle fill layer for cards, overlays, and decorative elements. Supports solid color, a linear gradient, and full entity-driven conditional styling via `overrides`.

```json
{
  "id": "card_bg",
  "type": "rectangle",
  "x": 0, "y": 48, "w": 390, "h": 130,
  "background": "surface",
  "radius": 10,
  "border_width": 2,
  "border_color": "primary"
}
```

Gradient example (mostly transparent, fading to solid near the bottom):
```json
{
  "id": "card_fade",
  "type": "rectangle",
  "x": 0, "y": 360, "w": 390, "h": 140,
  "gradient": {
    "from": "transparent",
    "to": "surface2",
    "angle": 180,
    "start_pct": 62,
    "end_pct": 100
  },
  "radius": 10
}
```

Entity-driven example — card border glows red when an alarm is triggered, using a secondary entity to also test an attribute:
```json
{
  "id": "alarm_card",
  "type": "rectangle",
  "x": 0, "y": 0, "w": 390, "h": 130,
  "background": "surface",
  "radius": 10,
  "entity": "alarm_control_panel.home",
  "entity2": "binary_sensor.motion_lounge",
  "overrides": [
    {
      "when": { "logic": "any", "conditions": [
        { "source": "state",  "type": "equals", "value": "triggered" },
        { "source": "state2", "type": "equals", "value": "on" }
      ]},
      "set": { "border_width": 3, "border_color": "danger" }
    }
  ]
}
```

| Property | Description |
|----------|-------------|
| `background` | Fill color — theme token or hex |
| `gradient` | Linear gradient object `{ from, to, angle, start_pct, end_pct }` |
| `radius` | Corner radius in px |
| `border_width` | Border thickness in px |
| `border_color` | Border color — theme token or hex |
| `opacity` | Widget opacity 0–1 |
| `action` | Action to perform on tap |
| `entity` | Primary HA entity. Drives `state` and `attribute` override conditions |
| `entity2` | Secondary HA entity. Enables `state2` and `attribute2` override conditions. Both entities trigger a re-evaluate when their state changes |
| `animation` | Optional animation: `none`, `pulse`, `pulse_fast`, `blink`, `breathe` |
| `overrides` | Ordered conditional style overrides. Settable: `background`, `gradient`, `opacity`, `border_width`, `border_color`, `animation` |

Override condition `source` values follow the same rules as `label` — see [Conditional Overrides](#conditional-overrides).

---

### bar

A horizontal progress bar driven by a numeric entity value.

```json
{
  "id": "battery_bar",
  "type": "bar",
  "x": 160, "y": 340, "w": 420, "h": 22,
  "entity": "sensor.battery_state_of_charge",
  "max": 100,
  "radius": 4,
  "thresholds": [
    { "below": 20, "color": "danger" },
    { "below": 50, "color": "warning" },
    { "default": true, "color": "primary" }
  ]
}
```

| Property | Description |
|----------|-------------|
| `entity` | HA entity providing the numeric value |
| `entity2` | Secondary entity. Enables `state2`/`attribute2` override conditions. Both trigger re-evaluation. |
| `max` | Value that represents 100% fill |
| `radius` | Corner radius in px |
| `background` | Track background color (token or hex, default `surface2`) |
| `thresholds` | Array of color rules. First matching `below` (raw entity value) wins. `default` applies when no rule matches. |
| `overrides` | Conditional style rules. Settable: `color`. Supports all `source` values including `state2`, `attribute2`. |

---

### slider

An interactive slider for controlling numeric Home Assistant service values (brightness, cover position, volume, etc).

```json
{
  "id": "living_volume",
  "type": "slider",
  "x": 40, "y": 220, "w": 280, "h": 36,
  "entity": "media_player.living_room",
  "value_attribute": "volume_level",
  "min": 0,
  "max": 1,
  "step": 0.01,
  "orientation": "horizontal",
  "update_mode": "release",
  "background": "surface2",
  "color": "primary",
  "thumb_color": "text",
  "thumb_size": 24,
  "radius": 18,
  "action": {
    "type": "service",
    "service": "media_player.volume_set",
    "entity_id": "media_player.living_room",
    "data": { "volume_level": "$value" }
  }
}
```

| Property | Description |
|----------|-------------|
| `entity` | HA entity used to read current value |
| `value_attribute` | Optional attribute key to read from (e.g. `brightness`, `volume_level`). If omitted, reads `state`. |
| `min` | Minimum slider value (default `0`) |
| `max` | Maximum slider value (default `100`) |
| `min_attribute` | Optional attribute key used as dynamic minimum bound |
| `max_attribute` | Optional attribute key used as dynamic maximum bound (useful for media seek with `media_duration`) |
| `step` | Step size (default `1`) |
| `orientation` | `horizontal` (default) or `vertical` |
| `update_mode` | `release` (default) sends once on drag end, `drag` sends continuously while dragging |
| `background` | Track color - token or hex |
| `color` | Fill color - token or hex |
| `thumb_color` | Thumb color - token or hex |
| `thumb_size` | Thumb diameter in px |
| `radius` | Track corner radius in px |
| `action` | Service action with `"$value"` token in `data` |
| `overrides` | Conditional style overrides (`background`, `color`, `thumb_color`, `opacity`) |

**Interaction:** slider is drag-only (no tap-to-jump).

**Future enhancement (planned):** support for a slider `thumb_icon` option may be added to help discoverability for controls like volume/brightness.

**Per-track seek example**
```json
{
  "type": "slider",
  "entity": "media_player.office",
  "value_attribute": "media_position",
  "min": 0,
  "max": 1,
  "max_attribute": "media_duration",
  "step": 1,
  "action": {
    "type": "service",
    "service": "media_player.media_seek",
    "entity_id": "media_player.office",
    "data": { "seek_position": "$value" }
  }
}
```

---

### switch

A binary toggle switch — a sliding thumb on a track that reflects an entity's on/off state and toggles it on tap. Works with any entity whose state (or an attribute) has two distinct values: not just `switch.*` and `input_boolean.*`, but also `sun.sun`, `climate.*` attributes, or anything else with a clear on/off pair.

The switch follows the same pattern as `button`: **base properties define the default (off) appearance**, and `overrides` rules change colors, icons, and labels when the entity reaches the on state.

```json
{
  "id": "kitchen_light",
  "type": "switch",
  "x": 40, "y": 120, "w": 160, "h": 36,
  "entity": "switch.kitchen",
  "on_value": "on",
  "off_value": "off",
  "color": "surface2",
  "thumb_color": "text",
  "icon": "mdi:lightbulb-outline",
  "icon_color": "text_muted",
  "radius": 18,
  "padding": 3,
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [{ "type": "equals", "value": "on" }] },
      "set": { "color": "primary", "icon": "mdi:lightbulb", "icon_color": "background" }
    }
  ]
}
```

`on_value` and `off_value` are **required**. If either is missing the switch renders a red error instead. All other properties are optional.

| Property | Default | Description |
|----------|---------|-------------|
| `entity` | — | HA entity to bind to |
| `on_value` | *(required)* | State value (or attribute value) that means "on" |
| `off_value` | *(required)* | State value (or attribute value) that means "off" |
| `value_attribute` | — | Read this attribute instead of `state`. E.g. `hvac_action` on a climate entity |
| `color` | `surface2` | Track color (default/off state — override for on state) |
| `thumb_color` | `text` | Thumb color |
| `icon` | — | Icon shown in the thumb. Supports `[mdi:name]` or bare `mdi:name`. Override for on state |
| `icon_color` | `text_muted` | Thumb icon color. Override for on state |
| `icon_scale` | `1` | Multiplier for icon size (1 = auto-fit to thumb, max 2) |
| `radius` | `h / 2` | Track corner radius in px. Defaults to fully rounded pill |
| `thumb_radius` | `thumbSize / 2` | Thumb corner radius in px. Defaults to circular |
| `padding` | `3` | Gap in px between thumb and track edge |
| `label` | — | Text overlaid on the switch. Supports `{{ }}` templates |
| `label_color` | `text_muted` | Label text color |
| `label_size` | auto | Label font size in px. Defaults to ~34% of widget height |
| `locked` | `false` | When `true`, taps are disabled and the cursor shows `not-allowed` |
| `optimistic` | `true` | When `true` (default) the thumb moves immediately on tap without waiting for HA to confirm. Set to `false` to wait for the state_changed event |
| `action` | `homeassistant.toggle` | Action to fire on tap. If `entity` is set and `action` is omitted, defaults to calling `homeassistant.toggle` on the entity |
| `overrides` | — | Conditional style overrides (see below) |

**Unknown state:** If the current entity state matches neither `on_value` nor `off_value`, the switch shows in the off position at reduced opacity until a known state arrives.

**Optimistic vs confirmed toggle**

By default (`optimistic: true`) the thumb slides immediately when tapped — responsive but briefly out of sync if the service call fails. Set `optimistic: false` to hold the thumb in place until HA sends back the updated state.

**Reading an attribute instead of state**

Use `value_attribute` when the relevant value lives in an attribute rather than `state`. Common examples:

```json
{ "entity": "climate.lounge", "value_attribute": "hvac_action", "on_value": "heating", "off_value": "idle" }
{ "entity": "media_player.tv",  "value_attribute": "is_volume_muted", "on_value": "True",   "off_value": "False" }
```

**Non-standard on/off values**

`on_value` and `off_value` are compared as strings, so they work with any entity state:

```json
{ "entity": "sun.sun", "on_value": "above_horizon", "off_value": "below_horizon" }
```

**Custom action with tokens**

The following tokens are available in `action.data` when using a custom action:

| Token | Value |
|-------|-------|
| `$on_value` | The configured `on_value` |
| `$off_value` | The configured `off_value` |
| `$is_on` | `"true"` or `"false"` after the tap |

**Conditional overrides**

The following properties can be set via `overrides`:

`color`, `thumb_color`, `icon`, `icon_color`, `icon_scale`, `label`, `label_color`, `label_size`, `radius`, `thumb_radius`, `padding`, `opacity`, `locked`

Example — a door sensor that changes colour and label when open:

```json
{
  "type": "switch",
  "entity": "binary_sensor.front_door",
  "on_value": "on", "off_value": "off",
  "color": "surface2",
  "thumb_color": "text",
  "icon": "mdi:door-closed-lock",
  "icon_color": "text_muted",
  "label": "Closed", "label_color": "text_muted",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [{ "type": "equals", "value": "on" }] },
      "set": { "color": "danger", "icon": "mdi:door-open", "label": "OPEN", "label_color": "text" }
    }
  ]
}
```

---

### scene

Generic option selector widget for controlling an entity state/attribute with a fixed set of options.

```json
{
  "id": "repeat_mode",
  "type": "scene",
  "x": 120, "y": 760, "w": 280, "h": 56,
  "entity": "media_player.kitchen_sonos",
  "value_attribute": "repeat",
  "layout": "buttons",
  "options": [
    { "value": "off", "label": "Off", "icon": "[mdi:repeat-off]" },
    { "value": "all", "label": "All", "icon": "[mdi:repeat-variant]" },
    { "value": "one", "label": "One", "icon": "[mdi:repeat-once]" }
  ],
  "background": "transparent",
  "option_background": "surface2",
  "option_color": "text",
  "selected_background": "primary",
  "selected_color": "background",
  "action": {
    "type": "service",
    "service": "media_player.repeat_set",
    "entity_id": "media_player.kitchen_sonos",
    "data": { "repeat": "$option" }
  }
}
```

| Property | Description |
|----------|-------------|
| `entity` | Entity used to read current value |
| `value_attribute` | Optional attribute key to read selected value from (otherwise reads `state`) |
| `layout` | `buttons` (default), `dropdown`, or `picker` |
| `options` | Static option list. Each item can be a string or object `{value,label,icon}` |
| `action` | Service action; use `"$option"` in `data` to inject selected value |
| `option_background` / `option_color` | Default option colors |
| `selected_background` / `selected_color` | Active/selected option colors |

`picker` layout shows a single control that opens a small option modal on tap.

---

### button

A tappable button that reflects entity state visually and calls a HA service on press.

```json
{
  "id": "kitchen_light",
  "type": "button",
  "x": 20, "y": 60, "w": 180, "h": 140,
  "label": "Kitchen",
  "entity": "light.kitchen",
  "background": "surface",
  "icon_color": "icon_inactive",
  "label_color": "text_muted",
  "icon": "[mdi:lightbulb-outline]",
  "overrides": [
    {
      "when": { "logic": "all", "conditions": [ { "type": "equals", "value": "on" } ] },
      "set": { "background": "surface2", "icon_color": "primary", "label_color": "text",
               "icon": "[mdi:lightbulb]" }
    }
  ],
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.kitchen" }
}
```

| Property | Description |
|----------|-------------|
| `label` | Text shown below the icon. Supports `[mdi:icon-name]` and `{{ ... }}` templates |
| `entity` | HA entity to watch for state |
| `background` | Default button background (token or hex) |
| `icon_color` | Default icon color (token or hex) |
| `label_color` | Default label text color (token or hex) |
| `icon` | Default icon (used when no override `set.icon` matches). Supports `[mdi:icon-name]`. |
| `icon_size` | Icon size in px (optional). If omitted, auto-scales based on button size |
| `label_size` | Label font size in px (optional). If omitted, auto-scales based on button size |
| `radius` | Corner radius in px (optional) |
| `gap` | Space between icon and label in px (optional) |
| `padding` | Padding inside the button in px (optional) |
| `border_width` | Border thickness in px (optional) |
| `border_color` | Border color - token or hex (optional) |
| `overrides` | Ordered conditional style overrides. **Preferred over `states`.** See below. |
| `states` | Legacy on/off state map. Ignored when `overrides` is present. |
| `action` | Action to perform on tap |

**Button overrides**

`overrides` applies the same ordered condition system as labels. The `set` block for buttons supports: `background`, `icon_color`, `label_color`, `icon`, `label`, `opacity`, `border_color`, `border_width`.

```json
"overrides": [
  {
    "when": { "logic": "all", "conditions": [ { "source": "state", "type": "equals", "value": "on" } ] },
    "set": { "background": "surface2", "icon_color": "primary", "label_color": "text",
             "icon": "[mdi:lightbulb]" }
  },
  {
    "when": { "logic": "all", "conditions": [ { "source": "attribute", "attribute": "brightness", "type": "above", "value": 200 } ] },
    "set": { "icon_color": "warning" }
  }
]
```

See [Conditional Overrides](#conditional-overrides) for full condition syntax.

**Legacy states (still supported)**

```json
"states": {
  "on":  { "background": "surface2", "icon_color": "primary",      "label_color": "text" },
  "off": { "background": "surface",  "icon_color": "icon_inactive", "label_color": "text_muted" }
}
```

The `states` map keys are raw entity state strings. Use `overrides` for new configs — it supports more conditions and attribute testing.

---

### clock

Displays the current time (HH:MM), updated every second. No entity binding needed.

```json
{
  "id": "clock",
  "type": "clock",
  "x": 16, "y": 12, "w": 140, "h": 36,
  "font_size": 26,
  "align": "left",
  "color": "text",
  "background": "surface"
}
```

---

### image

Displays a static image from a URL/local path, or a dynamic image from a HA entity attribute (for example media player album art). Optionally opens fullscreen on tap.

```json
{
  "id": "floorplan",
  "type": "image",
  "x": 0, "y": 0, "w": 1024, "h": 600,
  "url": "images/floorplan.jpg",
  "fit": "contain",
  "fullscreen_on_tap": true
}
```

| Property | Description |
|----------|-------------|
| `url` | Image URL or path relative to haven folder |
| `entity` | Optional HA entity to watch for dynamic image updates |
| `entity_attribute` | Optional attribute key containing image URL/path (e.g. `entity_picture`) |
| `gradient` | Optional linear gradient overlay object `{ from, to, angle, start_pct, end_pct }` |
| `fit` | `cover` (default, may crop) or `contain` (letterbox) |
| `fullscreen_on_tap` | `true` to open fullscreen overlay on tap |
| `radius` | Corner radius in px |

**Image gradient overlay example**
```json
{
  "type": "image",
  "entity": "media_player.living_room",
  "entity_attribute": "entity_picture",
  "gradient": {
    "from": "transparent",
    "to": "surface2",
    "angle": 180,
    "start_pct": 62,
    "end_pct": 100
  }
}
```

**Album art example (`entity_picture`)**
```json
{
  "id": "album_art",
  "type": "image",
  "x": 20, "y": 100, "w": 220, "h": 220,
  "entity": "media_player.living_room",
  "entity_attribute": "entity_picture",
  "fit": "cover",
  "radius": 8
}
```

When `entity` + `entity_attribute` are set, the image widget updates whenever that entity changes. Relative HA paths like `/api/media_player_proxy/...` are resolved automatically.

---

### camera

Displays a camera feed with configurable preview mode. Tapping always opens a fullscreen live HLS stream with audio.

```json
{
  "id": "front_door",
  "type": "camera",
  "x": 16, "y": 84, "w": 460, "h": 300,
  "radius": 10,
  "label": "Front Door",
  "preview": "mjpeg",
  "entity": "camera.front_door",
  "snapshot_entity": "camera.front_door_snapshots",
  "stream_entity": "camera.front_door",
  "fit": "cover"
}
```

| Property | Description |
|----------|-------------|
| `label` | Title shown in the fullscreen overlay header |
| `preview` | Preview mode (see below). Default: `mjpeg` |
| `entity` | HA camera entity (used as fallback if snapshot/stream not specified) |
| `snapshot_entity` | HA entity for snapshot images |
| `stream_entity` | HA entity for HLS stream |
| `refresh_interval` | Seconds between snapshot refreshes (snapshot/poster/url modes). Default: `3` for snapshot, `60` for poster |
| `url` | Direct camera URL for `url` mode |
| `fit` | `cover` (default) or `contain` |
| `radius` | Corner radius in px |

**Preview modes:**

| Mode | Description | Network cost | Best for |
|------|-------------|--------------|----------|
| `mjpeg` | Persistent MJPEG stream via HA proxy (`/api/camera_proxy_stream/`). One connection, browser renders frames continuously. | Ongoing stream bandwidth | Featured single camera |
| `snapshot` | Polls snapshot via HA proxy at `refresh_interval` seconds (default `3`). Uses camera entity `access_token` - no per-request auth overhead. | 1 request per interval | Secondary cameras |
| `poster` | Same as snapshot but defaults to `60` s refresh. Overlays a ▶ play button to make the widget clearly tappable. | Minimal - 1 request/minute | Multi-camera grids |
| `url` | Direct URL, bypasses HA entirely. Optional `refresh_interval` seconds for polling. `&_t={timestamp}` cache buster appended automatically. | Depends on interval | Reolink/ONVIF direct |

**Fullscreen stream:** tapping any camera widget sends a `camera/stream` WebSocket request to HA, which returns an HLS URL. On Safari/iOS HLS plays natively. On Chrome/Firefox, HLS.js is loaded on-demand from a CDN (once per session, then cached).

**Direct Reolink URL example:**
```json
{
  "type": "camera",
  "preview": "url",
  "url": "https://192.168.1.62/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=haven&user=guest&password=yourpassword",
  "refresh_interval": 5,
  "stream_entity": "camera.front_door"
}
```

> **Note:** If your HA runs on HTTP and your camera uses HTTPS with a self-signed certificate, the browser will silently block the request. Fix: visit the camera IP directly in your browser once and accept the certificate.

---

### arc

An SVG-based circular gauge driven by a numeric entity value.

```json
{
  "id": "battery_arc",
  "type": "arc",
  "x": 80, "y": 120, "w": 160, "h": 160,
  "entity": "sensor.battery_state_of_charge",
  "min": 0,
  "max": 100,
  "start_angle": 135,
  "end_angle": 405,
  "line_width": 14,
  "background": "surface2",
  "color": "primary",
  "thresholds": [
    { "below": 20, "color": "danger" },
    { "below": 50, "color": "warning" },
    { "default": true, "color": "primary" }
  ],
  "label": "Battery",
  "label_color": "text_muted",
  "format": "percent"
}
```

| Property | Description |
|----------|-------------|
| `entity` | HA entity providing the numeric value |
| `entity2` | Secondary entity. Enables `state2`/`attribute2` override conditions. Both trigger re-evaluation. |
| `min` | Minimum value (default `0`) |
| `max` | Maximum value (default `100`) |
| `start_angle` | Start angle in degrees (default `135`) |
| `end_angle` | End angle in degrees (default `405`) |
| `line_width` | Arc stroke width in px (default `12`) |
| `background` | Background ring color (token or hex, default `surface2`) |
| `color` | Arc fill color when no thresholds match (token or hex) |
| `thresholds` | Array of color rules; first matching `below` (raw entity value) wins |
| `label` | Optional label shown under the value |
| `label_color` | Label color (token or hex, default `text_muted`) |
| `format` | Value format (same as label widget) |
| `overrides` | Conditional style rules. Supports all `source` values including `state2`, `attribute2`. |

---

### history_chart

Fetches HA long-term statistics and renders a vertical bar chart. Useful for energy totals, power averages, temperature history, and any sensor with long-term statistics enabled.

```json
{
  "id": "energy_week",
  "type": "history_chart",
  "x": 10, "y": 130, "w": 380, "h": 120,
  "entity": "sensor.daily_energy_total",
  "period": "day",
  "count": 7,
  "stat_type": "change",
  "color": "primary",
  "today_color": "warning",
  "background": "surface",
  "radius": 8,
  "show_values": true,
  "show_labels": true,
  "refresh_interval": 3600
}
```

| Property | Description |
|----------|-------------|
| `entity` | HA entity with long-term statistics enabled |
| `period` | Bar period: `day`, `hour`, `month`, or `year` |
| `count` | Number of bars to show |
| `stat_type` | `change` for energy accumulators (kWh totals), `mean` for averaged sensors (power, temperature). Default: `mean` |
| `color` | Bar color - token or hex |
| `today_color` | Color for the current/latest bar (today, this hour, etc.) |
| `background` | Widget background color |
| `radius` | Corner radius of the widget background in px |
| `max` | Fixed y-axis ceiling. Omit to auto-scale from data. |
| `show_values` | `true` to show a numeric value above each bar |
| `show_labels` | `true` to show period labels below each bar (M T W T F S S, J F M... etc.) |
| `refresh_interval` | Seconds between data refreshes. Default: `3600` |

**Which `stat_type` to use:**

| Sensor type | stat_type | Example |
|-------------|-----------|---------|
| Energy accumulator (total_increasing) | `change` | Daily kWh consumed |
| Power / temperature / averaged measurement | `mean` | Average watts over the period |

> **Requirement:** The entity must have long-term statistics enabled in HA (`state_class: total_increasing`, `total`, or `measurement`). Statistics are separate from the standard state history.

> **Initial load:** The chart shows a "loading…" placeholder until the WebSocket connection is established and data is fetched. On slow connections this may take a moment.

---

### agenda

Displays upcoming events from one or more Home Assistant `calendar.*` entities in a compact, scrollable agenda list.

```json
{
  "id": "family_agenda",
  "type": "agenda",
  "x": 20, "y": 80, "w": 760, "h": 360,
  "layout": "list",
  "agenda_scale": 1.0,
  "days_ahead": 14,
  "refresh_interval": 120,
  "today_indicator": true,
  "show_blank_days": false,
  "time_format": "12h",
  "show_month_headers": true,
  "combine_duplicates": true,
  "calendars": [
    { "entity": "calendar.family", "color": "primary", "icon": "mdi:home", "full_day_highlight": true, "show": ["time", "location", "description_icon"] },
    { "entity": "calendar.work",   "color": "warning", "icon": "mdi:briefcase", "show": ["time"] }
  ]
}
```

| Property | Description |
|----------|-------------|
| `layout` | `list` (default) or `columns` |
| `agenda_scale` | Global internal sizing multiplier for agenda content (default `1.0`) |
| `scale` | Backward-compatible alias for `agenda_scale` |
| `days_ahead` | Days forward to request events (default `7`) |
| `refresh_interval` | Seconds between refreshes (default `120`) |
| `today_indicator` | Highlight today's date/day in a rounded primary-color date block |
| `show_blank_days` | Render days with no events in the range (default `false`) |
| `time_format` | `12h` (default) or `24h` |
| `show_month_headers` | Show month separators (default `true`) |
| `combine_duplicates` | Merge same-title events on same day across calendars |
| `calendars` | Array of calendar sources and display options |

Each calendar entry supports:
- `entity` (required)
- `color` (accent color)
- `icon` (optional `mdi:` icon shown before title)
- `full_day_highlight` (optional, when `true`, all-day event cards use the accent color at low opacity)
- `show` array: `time`, `location`, `description_icon` (or `[]` for title-only)

Notes:
- In `layout: "columns"`, `days_ahead` is the exact number of day-columns rendered (one day per column, from today).
- `description_icon` renders a `More information...` link when an event has description text; tapping opens a detail modal.
- When content overflows, the widget fades at the bottom edge and remains touch-scrollable.

---

## Pages & Navigation

Pages are defined in the `pages` array. Navigate between them by swiping left/right or tapping the dot indicators at the bottom of the screen.

```json
"pages": [
  { "id": 1, "label": "Energy",  "widgets": [] },
  { "id": 2, "label": "Lights",  "widgets": [] },
  { "id": 3, "label": "Cameras", "widgets": [] }
]
```

### Page nav styling

Set `device.page_nav` to tune navigation visibility for each device/browser:

```json
"device": {
  "page_nav": {
    "show": true,
    "background_color": "rgba(0,0,0,0.20)",
    "primary_color": "text",
    "secondary_color": "#6f7781",
    "size": "large"
  }
}
```

`size` supports `small`, `medium`, `large` (`medium` default).
Colors accept theme tokens or literal color values.
Set `"show": false` to hide built-in navigation dots when using your own nav controls.

`page_navigation` is also supported as an alias to `page_nav` (same fields).

### Page 0 (persistent overlay)

If you define a page with `"id": 0`, it renders once as a persistent overlay and stays on top of all other pages. It does not appear in the navigation dots and cannot be navigated to directly. Use it for always-on elements like clocks, status bars, or navigation sidebars.

### Return to default

`return_to_default` in the device block sets how many seconds of inactivity before automatically returning to `default_page`. The timer resets on any touch, tap, swipe, or overlay close. Set to `0` or omit to disable.

---

## Credentials & Security

HAven looks for HA credentials in this order:

1. **localStorage** (per device) — set via the setup screen on first run, persists across reloads
2. **Device config file** — `device.ha_token` (and optionally `device.ha_url`) in the device JSON
3. **Setup screen** — shown if no token is found anywhere

**HA URL** defaults to `window.location.origin` — no configuration needed when HAven is hosted inside HA's `www/` folder. Only set `device.ha_url` for non-standard deployments where HAven is served from a different host.

**Config file token** (optional, set via the designer's Device Properties):
```json
{
  "device": {
    "ha_token": "your-long-lived-access-token",
    "ha_url":   "http://192.168.1.100:8123"
  }
}
```

The token can be embedded temporarily so a new tablet auto-connects on first load without a setup screen. Once the device has saved it to localStorage you can remove it from the JSON — it won't be needed again unless the browser storage is cleared. Note that `devices/` JSON files are served without authentication, so anyone on your local network can read them.

**Resetting credentials** - open the browser console on the device and run:
```javascript
localStorage.removeItem('haven_url');
localStorage.removeItem('haven_token');
location.reload();
```

---

## Connection Status

A small dot in the bottom-right corner of the screen shows WebSocket state:

- 🟢 **Green** - connected and receiving live data
- 🟡 **Amber** - connecting or reconnecting
- 🔴 **Red** - disconnected (auto-retries every 5 seconds)

---

## Internal Entities

HAven exposes a few internal entities you can bind to widgets just like HA entities:

- `internal.connectionstatus` - `connected`, `connecting`, `disconnected`
- `internal.currentdtm` - current datetime (ISO string), updates once per minute

Example (icon + time):
```json
{
  "type": "label",
  "entity": "internal.currentdtm",
  "prefix": "[mdi:clock-outline]&nbsp;",
  "format": "time_24"
}
```

---

## HA-triggered Commands (`haven_command`)

HAven listens for a custom HA event called `haven_command`. Fire it from any automation, script, or the developer tools **Events** tab to control HAven panels remotely.

### Navigate to a page

```yaml
action: event
event_type: haven_command
event_data:
  action: navigate
  page: 2
  device: kitchen-lenovo   # optional — omit to broadcast to all panels
```

### Speak a voice announcement

Uses the browser's built-in Web Speech API (no extra dependencies). Works in Chrome, Edge, Safari, Firefox, and most tablet/TV browsers.

```yaml
action: event
event_type: haven_command
event_data:
  action: speak
  text: "Someone is at the front door"
  device: kitchen-lenovo   # optional
  volume: 1.0              # optional, 0.0–1.0 (default: browser default)
  rate: 1.0                # optional, 0.1–10 (default: 1.0)
  pitch: 1.0               # optional, 0–2 (default: 1.0)
```

### Wake or dim the screensaver

```yaml
action: event
event_type: haven_command
event_data:
  action: wake             # dismiss screensaver and reset idle timer
  device: kitchen-lenovo   # optional

action: event
event_type: haven_command
event_data:
  action: dim              # activate screensaver immediately
  device: kitchen-lenovo   # optional
```

Useful automations:
- PIR sensor detects motion → fire `wake` to brighten a TV panel
- "Goodnight" script → fire `dim` to blank all panels immediately

### Device filtering

If `device` is included in the event data, HAven compares it against the `?device=` URL parameter. Panels that don't match silently ignore the command. Omit `device` to broadcast to all open panels.

### Testing from HA Developer Tools

Go to **Developer Tools → Events**, set event type to `haven_command`, paste your event data JSON, and fire it. You'll see the result immediately.

---

## Screensaver

HAven can dim the screen after a period of inactivity. Configure it in the `device` block:

```json
"device": {
  "screensaver": {
    "timeout": 300,
    "opacity": 0.95,
    "text": "HAven Dashboard"
  }
}
```

| Property | Default | Description |
|----------|---------|-------------|
| `timeout` | — | Seconds of inactivity before activating. Required — omit the block entirely to disable. |
| `opacity` | `0.95` | Overlay darkness. `0.0` = transparent, `1.0` = fully black. |
| `text` | _(none)_ | Text to bounce around the screen. Omit for a plain dark overlay with no text. |

**Behaviour:**
- Any touch, click, or keypress dismisses the screensaver and resets the timer
- When text is shown it bounces around the screen DVD-logo style, changing colour on each wall bounce
- `haven_command` with `action: wake` dismisses it remotely (e.g. PIR sensor → HA automation → wake panel)
- `haven_command` with `action: dim` activates it immediately (e.g. "Goodnight" automation)
- If the device wakes from sleep with a broken WebSocket connection, HAven reconnects immediately rather than waiting for the normal retry cycle

---

## Visual Designer

HAven includes a drag-and-drop visual designer at `designer.html` for building device configs without hand-editing JSON.

### Opening a config

Open `designer.html` in your browser. From the welcome screen you can:

- **Open existing file** — pick a `devices/*.json` file from disk using the browser's file picker. The designer opens the directory so it can save changes back to the same file and access the `images/` folder for background uploads.
- **New device** — enter a name and pick a canvas size from presets (1024×768, 1280×800, 1920×1080, 800×480, 480×320) or enter a custom size.

### Toolbar

| Button | Action |
|--------|--------|
| **New…** | Create a new device config |
| **Open** | Open an existing device JSON file |
| **Save** | Save back to disk (File System Access API). Creates a timestamped backup before overwriting. |
| **Download** | Save as a downloaded file (fallback if File System Access is not available) |
| **↩ / ↪** | Undo / Redo (50 levels deep) |
| **Copy / Cut / Paste** | Clipboard actions for selected widgets (also `Ctrl/Cmd + C/X/V`) |
| **Snap** | Toggle grid snap. Active state shown highlighted. |
| **Pan** | Toggle pan mode (right-click to pan is always available). |
| **Preview** | Toggle a live preview iframe showing the dashboard with the current config injected. |
| **Pages…** | Open page management modal |
| **Device…** | Edit device properties (name, canvas size, default page, return timer, file location) |
| **Close** | Close the current device and return to the welcome screen |

### Canvas

Widgets are placed at absolute pixel positions on the canvas — the same coordinate space as the runtime app. You can:

- **Click** to select a widget
- **Shift+click** to add/remove from a multi-selection
- **Drag** to move selected widgets
- **Arrow keys** to nudge by 1px (or 10px with Shift)
- **Right-click drag** to pan the canvas
- **Scroll** to zoom in/out

### Widget tree (left panel)

The left panel lists all widgets on the current page in z-order. Each row shows:
- **Eye button** — toggle widget visibility on canvas (hidden widgets still export to JSON)
- **Lock button** — lock a widget so it can't be accidentally moved or selected on canvas
- **Type badge** — coloured letter indicating widget type
- **Name / ID** — widget name if set, otherwise ID + type

Drag rows to reorder widgets (changes z-order). Use the search box to filter by name, ID, or type. Add widget buttons at the bottom create a new widget of that type at the centre of the canvas.

The left panel is **resizable** — drag the right edge handle to adjust width. Width is saved in localStorage.

### Properties panel (right panel)

Select a widget to edit its properties:
- **Position/size** — X, Y, W, H fields
- **Widget Settings** — all type-specific properties (entity, format, color, background, font_size, etc.)
- **Overrides editor** — add, edit, and remove conditional override rules. **Insert Example** fills a sensible starting rule for the widget type.
- **Theme Colors** — click any swatch to copy its token name. **Edit Theme** opens the theme editor for colors and font size.

The right panel is also **resizable** — drag the left edge handle to adjust. Width is saved in localStorage.

### Entity search

`entity`, `entity2`, `snapshot_entity`, and `stream_entity` fields show a magnifying glass button. Clicking it opens an entity search modal that connects directly to your HA instance. On first use it prompts for a Long-Lived Access Token (stored separately as `haven_designer_token` — distinct from device credentials). The entity list is cached for the session and can be filtered by domain and device class. The `history_chart` entity field pre-filters to sensors with long-term statistics enabled.

### Attribute browse

The `entity_attribute` field shows a magnifying glass button that opens the same modal in attribute mode, listing all attributes of the currently selected entity with their live values. Set `entity` first — the button shows a message if no entity is selected.

### Page management

Click **Pages…** to open the page manager:
- **Left column** — page list with drag-to-reorder, widget count, delete button. Drag rows to change display order — page IDs stay stable so navigation actions are unaffected.
- **Right column** — page properties: label, background image (upload to `images/` folder), opacity, fit mode, default page selector
- **Overlay page** — click **+ Add Overlay Page** at the bottom of the list to create page 0. Its widgets render on top of every other page at runtime. Select it in the page picker to add and position widgets. Background image is not supported for the overlay page.

### Alignment tools

With multiple widgets selected, the toolbar shows alignment buttons: align left/right/top/bottom edges, distribute horizontally/vertically.

### Keyboard shortcuts

- `Ctrl/Cmd + C` — copy selected widget(s)
- `Ctrl/Cmd + X` — cut selected widget(s)
- `Ctrl/Cmd + V` — paste copied widget(s) with a small offset
- `Ctrl/Cmd + Z` — undo
- `Ctrl/Cmd + Shift + Z` — redo

### Preview

Click **Preview** to open a live preview iframe next to the canvas. The preview runs the full runtime app with your current config injected — no save or reload needed. It updates automatically when you make changes.

> **Browser compatibility:** The designer uses the File System Access API for save-to-disk. This requires Chrome or Edge. Firefox can open and download files but cannot save directly back to disk.

---

## Roadmap

**Done**
- [x] Label, rectangle, bar, button, clock widgets
- [x] Image widget with fullscreen tap
- [x] Camera widget - MJPEG, snapshot, poster, and direct URL preview modes
- [x] Fullscreen HLS camera stream with audio
- [x] Swipe gesture navigation
- [x] Material Design Icons (MDI) bundled locally - works offline
- [x] `[mdi:icon-name]` icon syntax - mix icons and text in any label or button
- [x] Conditional overrides for labels and buttons (ordered rules, all/any logic)
- [x] Condition sources: state, attribute, state2, attribute2
- [x] `entity2` secondary entity binding on labels
- [x] `{{ ... }}` template expressions in label text and color
- [x] Typed actions (navigate, automation, service with data payload)
- [x] Visibility conditions (above, below, equals, not_equals)
- [x] Page background images with opacity and fit
- [x] Return-to-default timer
- [x] Version-based cache busting
- [x] Page 0 persistent overlay
- [x] Arc / gauge widget
- [x] History chart widget (long-term statistics bar chart)
- [x] Visual drag-and-drop designer with undo/redo, preview, page management, and image upload

---

## Troubleshooting

### Connection indicator stays red

The connection indicator in the bottom-right corner shows the WebSocket state: green = connected, amber = connecting/retrying, red = failed.

**Check the basics first**
- Open the HA URL directly in the same browser tab — if it doesn't load, the problem is network/URL not HAven
- Confirm the long-lived access token was copied in full with no extra spaces

**HTTP/HTTPS mismatch (most common cause)**
Browsers silently block WebSocket connections from an HTTPS page to an HTTP HA instance. If your dashboard is served over HTTPS (e.g. via Nabu Casa or a reverse proxy) but your HA URL is set to `http://192.168.x.x:8123`, the connection will fail with no visible error message.

Fix: use the same protocol for both, or access the dashboard over HTTP when connecting to a local HTTP HA instance.

**Check the browser console**
Open developer tools (F12) → Console tab. The exact failure reason will be there:
- `ERR_CONNECTION_REFUSED` — wrong IP or port
- `401` — token invalid or expired
- `Mixed Content` — HTTP/HTTPS mismatch (see above)

**Reset credentials**
If the stored URL or token is corrupted, clear localStorage for the page in browser settings and re-enter them on the setup screen.

---

**Coming**
- [x] HA event-triggered commands via `haven_command` event (`navigate`, `speak`, `wake`, `dim`)
- [x] Screensaver / idle screen dimming with bouncing text and `haven_command` integration
- [ ] HACS frontend distribution
- [ ] Flow dots widget for energy/power direction visuals (animated dots along a path, with conservative defaults for low-end devices: capped dot count, throttled FPS, reduced-motion fallback)
