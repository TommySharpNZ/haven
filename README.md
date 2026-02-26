# WebHASP

A lightweight, config-driven Home Assistant dashboard that runs in any browser. Designed as a browser-based equivalent of OpenHASP - pixel-perfect fixed-canvas layouts, driven entirely by JSON config files, with no addons, no HACS, and no server-side code required.

Works on tablets, iPads, old Android devices, smart TVs, or any device with a browser on your local network.

---

## Installation

1. Copy the `webhasp/` folder into your Home Assistant `config/www/` directory
2. Navigate to `http://your-ha-ip:8123/local/webhasp/index.html?device=example`
3. On first load enter your HA URL and a Long-Lived Access Token
4. The token is stored in localStorage on the device - each device authenticates independently

### Getting a Long-Lived Access Token

1. In Home Assistant go to your Profile (bottom left avatar)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**, name it e.g. "Kitchen Tablet"
4. Copy the token immediately - you only see it once

---

## Directory Structure

```
config/
  www/
    webhasp/
      index.html          <- Entry point
      app.js              <- Main engine (config loader, WS, renderer)
      style.css           <- Canvas scaling and widget styles
      README.md
      CLAUDE.md
      devices/
        example.json      <- Example device config (energy dashboard)
```

---

## How It Works

- Each tablet/device has its own JSON config file in `devices/`
- The URL parameter `?device=name` loads `devices/name.json`
- The config defines a fixed canvas size (e.g. 1024x600) and all widgets are placed at absolute pixel positions within that canvas
- The canvas scales uniformly to fill whatever screen it is displayed on (like a retro game emulator)
- On load the app connects to HA via WebSocket, fetches current entity states, then subscribes to state_changed events
- When an entity changes, only the specific DOM elements bound to that entity are updated - no re-rendering

---

## Device Config Structure

```json
{
  "version": "1.0",
  "device": {
    "name": "Kitchen Tablet",
    "canvas": { "width": 1024, "height": 600 },
    "orientation": "landscape",
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
      "label": "Energy",
      "widgets": []
    }
  ]
}
```

### device block

| Field | Description |
|-------|-------------|
| name | Human readable label for this device |
| canvas.width | Design width in pixels |
| canvas.height | Design height in pixels |
| default_page | Page ID to show on load |
| return_to_default | Seconds before returning to default page after interaction |

### theme block

Colors are defined as named tokens. Any widget property that accepts a color can use either a token name (e.g. "primary") or a literal hex value (e.g. "#8ADF45"). Token names are resolved at render time so changing a token updates all widgets using it.

---

## Widget Types

All widgets share these base properties:

| Property | Description |
|----------|-------------|
| id | Unique string identifier |
| type | Widget type (see below) |
| x | Left position in pixels |
| y | Top position in pixels |
| w | Width in pixels |
| h | Height in pixels |

---

### label

Displays text. Optionally bound to a HA entity with automatic updates.

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
  "entity": "sensor.pv_power",
  "format": "power",
  "states": {
    "above_zero": { "color": "primary" }
  },
  "state_condition": { "type": "above", "value": 0, "state_key": "above_zero" }
}
```

**align:** left, center, right

**format values:**

| Format | Output example |
|--------|----------------|
| power | Auto w/kW: 948 w or 1.23 kW |
| power_abs | Same but absolute value (useful for battery) |
| power_prefix | Power with a text prefix, uses "prefix" field |
| kwh | One decimal + kWh: 25.0 kWh |
| percent | Rounded integer + %: 89% |
| (none) | Raw entity state value |

**State-based styling:** Use states + state_condition to change color based on entity value.
Condition types: above, below, equals.

---

### rect

A plain colored rectangle. Used for panel/card backgrounds.

```json
{
  "id": "import_box",
  "type": "rect",
  "x": 0, "y": 48, "w": 390, "h": 130,
  "background": "surface",
  "radius": 10
}
```

---

### bar

A horizontal bar whose fill width is driven by a numeric entity value.
Place a rect widget underneath it for the grey track background.

```json
{
  "id": "phase1_bar",
  "type": "bar",
  "x": 160, "y": 340, "w": 420, "h": 22,
  "entity": "sensor.load_l1",
  "max": 14000,
  "radius": 2,
  "thresholds": [
    { "below": 33, "color": "#008000" },
    { "below": 66, "color": "#cc7a00" },
    { "default": true, "color": "#cc0000" }
  ]
}
```

Threshold percentages are calculated as (value / max) * 100. First matching threshold wins.

---

### button

A tappable button that reflects entity state and calls a HA service on press.

```json
{
  "id": "kitchen_light",
  "type": "button",
  "x": 20, "y": 60, "w": 160, "h": 120,
  "label": "Kitchen",
  "entity": "light.kitchen",
  "icon_on":  "\uf0eb",
  "icon_off": "\uf0eb",
  "states": {
    "on":  { "background": "#493416", "icon_color": "#e88c03", "label_color": "text" },
    "off": { "background": "surface2", "icon_color": "text_muted", "label_color": "text_muted" }
  },
  "action": {
    "service": "homeassistant.toggle",
    "entity_id": "light.kitchen"
  }
}
```

Icon values are Font Awesome 4 unicode codepoints.
Reference: https://fontawesome.com/v4/icons/

---

### clock

Displays current time (HH:MM), updated every second. No entity binding needed.

```json
{
  "id": "clock",
  "type": "clock",
  "x": 0, "y": 0, "w": 120, "h": 44,
  "font_size": 22,
  "color": "text",
  "background": "background"
}
```

---

## Pages

Each config has an array of pages. Navigation is via dot indicators at the bottom of the screen.
The return_to_default timer automatically navigates back to default_page after the specified
number of seconds of inactivity.

```json
"pages": [
  { "id": 1, "label": "Energy",  "widgets": [] },
  { "id": 2, "label": "Lights",  "widgets": [] },
  { "id": 3, "label": "Climate", "widgets": [] }
]
```

---

## Connection Status Dot

A small dot in the bottom-right corner indicates WebSocket connection state:

- Green  - connected and receiving live data
- Amber  - connecting or reconnecting
- Red    - disconnected (auto-retries every 5 seconds)

---

## Resetting Credentials

To re-enter your HA URL or token, open the browser console on the device and run:

```javascript
localStorage.removeItem('webhash_url');
localStorage.removeItem('webhash_token');
location.reload();
```

---

## Known Limitations (v0.1)

- Font Awesome icons not yet bundled locally - button icons need internet or local font file
- No arc/gauge widget yet
- No camera stream widget yet
- No swipe gesture navigation yet
- No HA-triggered page navigation yet
- No screensaver mode yet
- No visual designer yet

---

## Roadmap

- [ ] Bundle Font Awesome locally for offline/TV use
- [ ] Arc / gauge widget
- [ ] Camera stream widget (MJPEG + HLS)
- [ ] Climate control widget (temp up/down, mode buttons)
- [ ] Swipe gesture page navigation
- [ ] HA event-triggered page navigation (fire webhash_command event from automations)
- [ ] Screensaver / clock mode with auto-return
- [ ] QR code token entry for TV screens
- [ ] Visual drag-and-drop designer tool
- [ ] HACS frontend distribution
