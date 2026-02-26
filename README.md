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
- [Pages & Navigation](#pages--navigation)
- [Credentials & Security](#credentials--security)
- [Connection Status](#connection-status)
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
- Omit `?device=` to load `devices/default.json`
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

WebHASP uses [Font Awesome 4](https://fontawesome.com/v4/icons/) icons, bundled locally - no internet required.

Use `[fa-name]` syntax anywhere in label `text` or button `icon_on`/`icon_off` fields:

```json
"text":     "[fa-fire] Heating"
"text":     "[fa-lightbulb-o] Living Room  •  3 lights on"
"icon_off": "[fa-lightbulb-o]"
"icon_on":  "[fa-lightbulb-o]"
```

Icons and text can be freely mixed in a single string. The icon name matches the FA4 class name exactly.

**Common home automation icons:**

| Icon | Name | Use |
|------|------|-----|
| 💡 | `fa-lightbulb-o` | Lights |
| ⚡ | `fa-bolt` | Power / electricity |
| 🔥 | `fa-fire` | Heating |
| ❄️ | `fa-snowflake-o` | Cooling |
| ☀️ | `fa-sun-o` | Solar |
| 🌙 | `fa-moon-o` | Night mode |
| 🌡️ | `fa-thermometer` | Temperature |
| 💧 | `fa-tint` | Humidity / water |
| 🔋 | `fa-battery-full` | Battery |
| 📷 | `fa-camera` | Camera |
| 🔔 | `fa-bell` | Notifications |
| 🏠 | `fa-home` | Home |
| ⚙️ | `fa-cog` | Settings |
| ⏻ | `fa-power-off` | Power toggle |
| ▶️ | `fa-play-circle` | Play / stream |
| 🚗 | `fa-car` | Vehicle |
| ☁️ | `fa-cloud` | Weather |
| 📶 | `fa-wifi` | Network |
| ↑ | `fa-arrow-circle-up` | Import / up |
| ↓ | `fa-arrow-circle-down` | Export / down |

Full icon reference: https://fontawesome.com/v4/icons/

---

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
  "states": {
    "above_zero": { "color": "primary" }
  },
  "state_condition": { "type": "above", "value": 0, "state_key": "above_zero" }
}
```

| Property | Description |
|----------|-------------|
| `text` | Static text. Supports `[fa-name]` icons. Used as placeholder before entity loads. |
| `font_size` | Size in pixels |
| `align` | `left`, `center`, or `right` |
| `color` | Text color - token or hex |
| `background` | Background color - token or hex |
| `letter_spacing` | Letter spacing in px |
| `entity` | HA entity ID for live value |
| `format` | How to format the entity value (see below) |
| `prefix` | Text prefix for `power_prefix` format |
| `states` | Map of state name → style overrides |
| `state_condition` | Condition that activates a named state |

**Format values:**

| Format | Example output |
|--------|----------------|
| `power` | `948 w` or `1.23 kW` (auto-scales) |
| `power_abs` | Same but absolute value (useful for bidirectional sensors) |
| `power_prefix` | Power value with a text prefix from the `prefix` field |
| `kwh` | `25.0 kWh` |
| `percent` | `89%` |
| *(none)* | Raw entity state string |

**State-based styling:**

```json
"states": {
  "above_zero": { "color": "primary", "opacity": 1.0 },
  "default":    { "color": "icon_inactive", "opacity": 0.5 }
},
"state_condition": { "type": "above", "value": 0, "state_key": "above_zero" }
```

State style properties: `color`, `background`, `opacity`, `letter_spacing`.

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
  "icon_on":  "[fa-lightbulb-o]",
  "icon_off": "[fa-lightbulb-o]",
  "states": {
    "on":  { "background": "surface2", "icon_color": "primary",      "label_color": "text" },
    "off": { "background": "surface",  "icon_color": "icon_inactive", "label_color": "text_muted" }
  },
  "action": { "type": "service", "service": "light.toggle", "entity_id": "light.kitchen" }
}
```

| Property | Description |
|----------|-------------|
| `label` | Text shown below the icon |
| `entity` | HA entity to watch for on/off state |
| `icon_on` | Icon shown when entity is `on`. Supports `[fa-name]`. |
| `icon_off` | Icon shown when entity is `off`. Supports `[fa-name]`. |
| `states.on` | Style when entity state is `on`: `background`, `icon_color`, `label_color` |
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

## Pages & Navigation

Pages are defined in the `pages` array. Navigate between them by swiping left/right or tapping the dot indicators at the bottom of the screen.

```json
"pages": [
  { "id": 1, "label": "Energy",  "widgets": [] },
  { "id": 2, "label": "Lights",  "widgets": [] },
  { "id": 3, "label": "Cameras", "widgets": [] }
]
```

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

## Roadmap

**Done**
- [x] Label, rectangle, bar, button, clock widgets
- [x] Image widget with fullscreen tap
- [x] Camera widget - MJPEG, snapshot, poster, and direct URL preview modes
- [x] Fullscreen HLS camera stream with audio
- [x] Swipe gesture navigation
- [x] Font Awesome 4 icons bundled locally - works offline
- [x] `[fa-name]` icon syntax - mix icons and text in any label or button
- [x] State-based styling (color, opacity, border, letter-spacing)
- [x] Typed actions (navigate, automation, service with data payload)
- [x] Visibility conditions (above, below, equals, not_equals)
- [x] Page background images with opacity and fit
- [x] Return-to-default timer
- [x] Version-based cache busting

**Coming**
- [ ] Arc / gauge widget
- [ ] Page 0 - persistent overlay for clock, sidebar, status bar
- [ ] HA event-triggered page navigation (fire `webhasp_command` from automations)
- [ ] Screensaver / idle screen dimming
- [ ] Visual drag-and-drop designer
- [ ] HACS frontend distribution
