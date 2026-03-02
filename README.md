# WebHASP

A lightweight, config-driven Home Assistant dashboard that runs in any browser. Designed as a browser-based equivalent of [OpenHASP](https://openhasp.com) - pixel-perfect fixed-canvas layouts, driven entirely by JSON config files, with no addons, and no server-side code required.

Aims really hard to work on tablets, iPads, old Android devices, smart TVs, or any device with a browser on your local network.

---

## Contents

- [Installation](#installation)
- [How It Works](#how-it-works)
- [Device Config Structure](#device-config-structure)
- [Theming](#theming)
- [Icons](#icons)
- [Actions](#actions)
- [Visibility Conditions](#visibility-conditions)
- [Widget Types](#widget-types)
  - [label](#label)
  - [rectangle](#rectangle)
  - [bar](#bar)
  - [button](#button)
  - [clock](#clock)
  - [image](#image)
  - [camera](#camera)
  - [arc](#arc)
  - [history\_chart](#history_chart)
- [Pages & Navigation](#pages--navigation)
- [Credentials & Security](#credentials--security)
- [Connection Status](#connection-status)
- [Internal Entities](#internal-entities)
- [Visual Designer](#visual-designer)
- [Roadmap](#roadmap)

---

## Installation

1. Copy the `webhasp/` folder into your Home Assistant `config/www/` directory
2. Navigate to `http://your-ha-ip:8123/local/webhasp/index.html?device=example`
3. On first load, enter your HA URL and a Long-Lived Access Token when prompted
4. Edit `devices/example.json` or create your own device config files

```
config/
  www/
    webhasp/
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
    "orientation": "portrait",    
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
| `orientation` | portrait or landscape |
| `default_page` | Page ID to show on load and return to after inactivity |
| `return_to_default` | Seconds of inactivity before returning to default page |

---

## Theming

Colors are defined as named tokens in the `theme.colors` block. Any widget property that accepts a color can use either a token name (`"primary"`) or a literal hex value (`"#8ADF45"`). Tokens are resolved at render time.

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

You can add your own tokens and reference them in widget configs.

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
| `background_image` | path or URL | Relative paths resolve from the webhasp folder |
| `background_image_opacity` | 0.0–1.0 | 1.0 = full brightness, 0.1 = very subtle |
| `background_image_fit` | `cover` (default), `contain` | How the image fills the canvas |

---

## Icons

WebHASP uses [Material Design Icons](https://pictogrammers.com/library/mdi/) (MDI), bundled locally - no internet required. MDI is the same icon set used by Home Assistant's own UI, so names are already familiar if you've written HA config YAML.

Use `[mdi:icon-name]` syntax anywhere in label `text` or button `icon_on`/`icon_off` fields:

```json
"text":     "[mdi:fire] Heating"
"text":     "[mdi:lightbulb-outline] Living Room  •  3 lights on"
"text":     "[mdi:solar-panel] 1.4 kW"
"icon_off": "[mdi:lightbulb-outline]"
"icon_on":  "[mdi:lightbulb]"
```

Icons and text can be freely mixed in a single string. The icon name matches the MDI name exactly - the same name you'd use in a HA entity `icon:` field.

**Common home automation icons:**

| Name | Use |
|------|-----|
| `mdi:lightbulb` / `mdi:lightbulb-outline` | Light on / off |
| `mdi:lightning-bolt` | Power / electricity |
| `mdi:solar-panel` / `mdi:solar-power` | Solar |
| `mdi:home-battery` | Battery storage |
| `mdi:battery` / `mdi:battery-outline` | Battery level |
| `mdi:thermometer` | Temperature |
| `mdi:fire` / `mdi:fireplace` | Heating |
| `mdi:heat-pump` | Heat pump |
| `mdi:snowflake` / `mdi:air-conditioner` | Cooling |
| `mdi:fan` / `mdi:fan-off` | Fan |
| `mdi:water-percent` | Humidity |
| `mdi:weather-sunny` / `mdi:weather-night` | Sun / moon |
| `mdi:transmission-tower` | Grid import/export |
| `mdi:power-plug` / `mdi:power-plug-off` | Smart plug |
| `mdi:cctv` | Camera |
| `mdi:motion-sensor` | Motion sensor |
| `mdi:door-open` / `mdi:door-closed` | Door sensor |
| `mdi:lock` / `mdi:lock-open` | Lock |
| `mdi:garage` / `mdi:garage-open` | Garage door |
| `mdi:car-electric` / `mdi:ev-station` | EV / charger |
| `mdi:robot-vacuum` | Robot vacuum |
| `mdi:smoke-detector` | Smoke detector |
| `mdi:bell` / `mdi:bell-off` | Notifications |
| `mdi:power` | Power toggle |
| `mdi:cog` / `mdi:tune` | Settings |

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

## Actions

Any tappable widget can have an `action` property. Three types are supported:

### Navigate to a page
```json
"action": { "type": "navigate", "page": 2 }
```

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

---

## Visibility Conditions

Any widget can be shown or hidden based on an entity's state:

```json
"visible": { "entity": "sensor.solar_power", "type": "above", "value": 0 }
```

| Type | Behaviour |
|------|-----------|
| `above` | Show when entity state > value |
| `below` | Show when entity state < value |
| `equals` | Show when entity state == value |
| `not_equals` | Show when entity state != value |

The widget updates live as the entity state changes.

---

## Conditional Overrides

Labels and buttons support ordered conditional overrides via an `overrides` array. Each rule has a `when` block (logic + conditions) and a `set` block (attributes to override). Rules are evaluated in order and all matching rules are applied — later rules win.

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

```json
{ "source": "state",      "type": "equals", "value": "on" }
{ "source": "attribute",  "attribute": "hvac_action",   "type": "equals", "value": "heating" }
{ "source": "attribute",  "attribute": "brightness",    "type": "above",  "value": 128 }
{ "source": "state2",     "type": "above",  "value": 0 }
{ "source": "attribute2", "attribute": "battery_level", "type": "below",  "value": 20 }
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
| `visible` | Visibility condition, optional |
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
| `entity` | Primary HA entity ID for live value |
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

`text`, `color`, `background`, `font_size`, `opacity`, `border_color`, `border_width`.

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

A plain colored rectangle. Used for panel/card backgrounds and decorative elements.

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

| Property | Description |
|----------|-------------|
| `background` | Fill color - token or hex |
| `radius` | Corner radius in px |
| `border_width` | Border thickness in px |
| `border_color` | Border color - token or hex |
| `action` | Optional action to perform on tap |
| `entity` | Optional HA entity to drive state-based styling |
| `states` | Optional map of state → style overrides (`background`, `opacity`, `border_width`, `border_color`) |

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
| `max` | Value that represents 100% fill |
| `radius` | Corner radius in px |
| `track_color` | Background track color (token or hex, default `surface2`) |
| `thresholds` | Array of color rules. First matching `below` (as % of max) wins. `default` applies when no `below` matches. |

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
  "icon_off": "[mdi:lightbulb-outline]",
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
| `icon_off` | Default icon (used when no override matches). Supports `[mdi:icon-name]`. |
| `icon_on` | Legacy: icon shown when entity is `on` (use `overrides` instead) |
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

Displays a static image from a URL or local path. Optionally opens fullscreen on tap.

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
| `url` | Image URL or path relative to webhasp folder |
| `fit` | `cover` (default, may crop) or `contain` (letterbox) |
| `fullscreen_on_tap` | `true` to open fullscreen overlay on tap |
| `radius` | Corner radius in px |

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
| `refresh_interval` | Milliseconds between snapshot refreshes (snapshot/poster modes) |
| `url` | Direct camera URL for `url` mode |
| `fit` | `cover` (default) or `contain` |
| `radius` | Corner radius in px |

**Preview modes:**

| Mode | Description | Network cost | Best for |
|------|-------------|--------------|----------|
| `mjpeg` | Persistent MJPEG stream via HA proxy (`/api/camera_proxy_stream/`). One connection, browser renders frames continuously. | Ongoing stream bandwidth | Featured single camera |
| `snapshot` | Polls snapshot via HA proxy at `refresh_interval` (default 3s). Uses camera entity `access_token` - no per-request auth overhead. | 1 request per interval | Secondary cameras |
| `poster` | Same as snapshot but defaults to 60s refresh. Overlays a ▶ play button to make the widget clearly tappable. | Minimal - 1 request/minute | Multi-camera grids |
| `url` | Direct URL, bypasses HA entirely. Optional `refresh_interval` for polling. Add `&_t={timestamp}` is handled automatically as a cache buster. | Depends on interval | Reolink/ONVIF direct |

**Fullscreen stream:** tapping any camera widget sends a `camera/stream` WebSocket request to HA, which returns an HLS URL. On Safari/iOS HLS plays natively. On Chrome/Firefox, HLS.js is loaded on-demand from a CDN (once per session, then cached).

**Direct Reolink URL example:**
```json
{
  "type": "camera",
  "preview": "url",
  "url": "https://192.168.1.62/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=webhasp&user=guest&password=yourpassword",
  "refresh_interval": 5000,
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
  "track_color": "surface2",
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
| `min` | Minimum value (default `0`) |
| `max` | Maximum value (default `100`) |
| `start_angle` | Start angle in degrees (default `135`) |
| `end_angle` | End angle in degrees (default `405`) |
| `line_width` | Arc stroke width in px (default `12`) |
| `track_color` | Background arc color (token or hex, default `surface2`) |
| `color` | Arc color when no thresholds match (token or hex) |
| `thresholds` | Array of color rules; first matching `below` (as % of range) wins |
| `label` | Optional label shown under the value |
| `label_color` | Label color (token or hex, default `text_muted`) |
| `format` | Value format (same as label widget) |

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
  "track_color": "surface2",
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
| `track_color` | Background bar track color |
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

## Pages & Navigation

Pages are defined in the `pages` array. Navigate between them by swiping left/right or tapping the dot indicators at the bottom of the screen.

```json
"pages": [
  { "id": 1, "label": "Energy",  "widgets": [] },
  { "id": 2, "label": "Lights",  "widgets": [] },
  { "id": 3, "label": "Cameras", "widgets": [] }
]
```

### Page 0 (persistent overlay)

If you define a page with `"id": 0`, it renders once as a persistent overlay and stays on top of all other pages. It does not appear in the navigation dots and cannot be navigated to directly. Use it for always-on elements like clocks, status bars, or navigation sidebars.

### Return to default

`return_to_default` in the device block sets how many seconds of inactivity before automatically returning to `default_page`. The timer resets on any touch, tap, swipe, or overlay close. Set to `0` or omit to disable.

---

## Credentials & Security

WebHASP looks for HA credentials in this order:

1. **localStorage** (per device) - set via the setup screen on first run, persists across reloads
2. **Device config file** - `ha.url` and `ha.token` in the device JSON (convenient for initial setup)
3. **Setup screen** - shown if neither are found

**Config file credentials** (less secure - visible to anyone on your network):
```json
{
  "version": "1.0",
  "ha": {
    "url":   "http://192.168.1.100:8123",
    "token": "your-long-lived-access-token"
  },
  "device": { ... }
}
```

**Resetting credentials** - open the browser console on the device and run:
```javascript
localStorage.removeItem('webhasp_url');
localStorage.removeItem('webhasp_token');
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

WebHASP exposes a few internal entities you can bind to widgets just like HA entities:

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

## Visual Designer

WebHASP includes a drag-and-drop visual designer at `designer.html` for building device configs without hand-editing JSON.

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

### Widget tree (left sidebar)

The sidebar lists all widgets on the current page in z-order. Each row shows:
- **Eye button** — toggle widget visibility on canvas (hidden widgets still export to JSON)
- **Lock button** — lock a widget so it can't be accidentally moved or selected on canvas
- **Type badge** — coloured letter indicating widget type
- **Name / ID** — widget name if set, otherwise ID + type
- **Z-index** — position in the stacking order

Drag rows to reorder widgets (changes z-order). Use the search box to filter by name, ID, or type.

### Properties panel (right sidebar)

Select a widget to edit its properties:
- **Position/size** — X, Y, W, H fields
- **Common properties** — label text, entity, format, color, background, etc. (fields vary by widget type)
- **Overrides editor** — add, edit, and remove conditional override rules visually

### Page management

Click **Pages…** to open the page manager:
- **Left column** — page list with drag-to-reorder, widget count, delete button
- **Right column** — page properties: label, background image (upload to `images/` folder), opacity, fit mode, default page selector

### Alignment tools

With multiple widgets selected, the toolbar shows alignment buttons: align left/right/top/bottom edges, distribute horizontally/vertically.

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

**Coming**
- [ ] HA event-triggered page navigation (fire `webhasp_command` from automations)
- [ ] Screensaver / idle screen dimming
- [ ] HACS frontend distribution
