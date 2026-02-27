# WebHASP

A lightweight, config-driven Home Assistant dashboard that runs in any browser. Designed as a browser-based equivalent of [OpenHASP](https://openhasp.com) - pixel-perfect fixed-canvas layouts, driven entirely by JSON config files, with no addons, no HACS, and no server-side code required.

Works on tablets, iPads, old Android devices, smart TVs, or any device with a browser on your local network.

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
- [Pages & Navigation](#pages--navigation)
- [Credentials & Security](#credentials--security)
- [Connection Status](#connection-status)
- [Internal Entities](#internal-entities)
- [Roadmap](#roadmap)

---

## Installation

1. Copy the `webhasp/` folder into your Home Assistant `config/www/` directory
2. Navigate to `http://your-ha-ip:8123/local/webhasp/index.html?device=example`
3. On first load, enter your HA URL and a Long-Lived Access Token when prompted
4. Edit `devices/example.json` or create your own device config

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
- `?device=name` in the URL loads `devices/name.json`
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

## Conditional Overrides (Label)

Labels support ordered conditional overrides via `overrides`. Each rule has a `when` block (logic + conditions) and a `set` block (attributes to override). Rules are evaluated in order; later rules win.

```json
"overrides": [
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "state", "type": "above", "value": 0 } ]
    },
    "set": { "text": "[mdi:transmission-tower-import]", "color": "warning" }
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
- `source`: currently only `state` (future: variables, attributes)
- Condition types: `above`, `below`, `equals`, `not_equals`
- Conditions can be nested using groups with their own `logic`/`conditions`

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
| `text` | Static text. Supports `[mdi:icon-name]` icons. Used as placeholder before entity loads. |
| `font_size` | Size in pixels |
| `align` | `left`, `center`, or `right` |
| `valign` | Vertical alignment: `top`, `center` (default), or `bottom` |
| `color` | Text color - token or hex |
| `background` | Background color - token or hex |
| `letter_spacing` | Letter spacing in px |
| `font_weight` | CSS font-weight value (e.g. `400`, `600`, `bold`) |
| `entity` | HA entity ID for live value |
| `format` | How to format the entity value (see below) |
| `prefix` | Text prefix for `power_prefix` format |
| `overrides` | Conditional attribute overrides (ordered) |

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

**Conditional overrides (replaces states/state_condition):**

Use `overrides` to apply ordered attribute overrides when conditions match. Later rules win.

```json
"overrides": [
  {
    "when": {
      "logic": "all",
      "conditions": [ { "source": "state", "type": "above", "value": 0 } ]
    },
    "set": { "text": "[mdi:transmission-tower-export]", "color": "warning" }
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

`logic`: `all` (AND) or `any` (OR).  
`conditions` can include nested groups with their own `logic`/`conditions`.  
`source` is currently only `state` (future: variables, attributes).

---

### Template expressions

Labels can include `{{ ... }}` expressions in their `text` field (and in `states.*.text` or `color`). Expressions are evaluated locally against the bound entity state.

**Variables**
- `state` (numeric if possible, otherwise string)
- `state_str` (always string)
- `attr.<name>` (entity attributes)

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
  "icon_on":  "[mdi:lightbulb]",
  "icon_off": "[mdi:lightbulb-outline]",
  "states": {
    "on":  { "background": "surface2", "icon_color": "primary",      "label_color": "text" },
    "off": { "background": "surface",  "icon_color": "icon_inactive", "label_color": "text_muted" }
  },
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.kitchen" }
}
```

| Property | Description |
|----------|-------------|
| `label` | Text shown below the icon. Supports `[mdi:icon-name]` and `{{ ... }}` templates |
| `entity` | HA entity to watch for on/off state |
| `icon_on` | Icon shown when entity is `on`. Supports `[mdi:icon-name]`. |
| `icon_off` | Icon shown when entity is `off`. Supports `[mdi:icon-name]`. |
| `icon_size` | Icon size in px (optional). If omitted, auto-scales based on button size |
| `label_size` | Label font size in px (optional). If omitted, auto-scales based on button size |
| `radius` | Corner radius in px (optional) |
| `gap` | Space between icon and label in px (optional) |
| `padding` | Padding inside the button in px (optional) |
| `border_width` | Border thickness in px (optional) |
| `border_color` | Border color - token or hex (optional) |
| `states.on` | Style when entity state is `on`: `background`, `icon_color`, `label_color`, `border_width`, `border_color`, `text` |
| `states.off` | Style when entity state is `off` |
| `action` | Action to perform on tap |

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

## Roadmap

**Done**
- [x] Label, rectangle, bar, button, clock widgets
- [x] Image widget with fullscreen tap
- [x] Camera widget - MJPEG, snapshot, poster, and direct URL preview modes
- [x] Fullscreen HLS camera stream with audio
- [x] Swipe gesture navigation
- [x] Material Design Icons (MDI) bundled locally - works offline
- [x] `[mdi:icon-name]` icon syntax - mix icons and text in any label or button
- [x] State-based styling (color, opacity, border, letter-spacing)
- [x] Typed actions (navigate, automation, service with data payload)
- [x] Visibility conditions (above, below, equals, not_equals)
- [x] Page background images with opacity and fit
- [x] Return-to-default timer
- [x] Version-based cache busting
- [x] Page 0 persistent overlay
- [x] Arc / gauge widget

**Coming**
- [ ] HA event-triggered page navigation (fire `webhasp_command` from automations)
- [ ] Screensaver / idle screen dimming
- [ ] Visual drag-and-drop designer
- [ ] HACS frontend distribution
