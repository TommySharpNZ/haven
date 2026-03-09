# HAven

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/TommySharpNZ/haven.svg)](https://github.com/TommySharpNZ/haven/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Thanks!-%23FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/tommysharpnz)

### *A lightweight Home Assistant dashboard for screens that Lovelace left behind*

An old iPad gathering dust... That sluggish Android tablet mounted on the kitchen wall... The Fire HD you picked up for $30... HAven gives them a second life as always-on Home Assistant displays. No addons, no server-side code, no install. Just static files dropped into your HA `www/` folder and a browser that can open a URL.

Most dashboards flex and reflow to fit whatever screen they land on. HAven takes the opposite approach: a fixed canvas, absolute widget placement, and every element exactly where you put it. Design once at a specific resolution and HAven scales it to fill any screen. No responsive breakpoints, no layout surprises. Just a purpose-built display that looks exactly how you intended.

---

## Features

- **Zero server-side install:** copy files into HA's `www/` folder, done
- **Fixed canvas, pixel-perfect layouts:** design at any resolution, HAven scales to fit any screen
- **Config-driven:** everything defined in JSON, no code changes needed to build dashboards
- **Live HA data:** WebSocket connection with surgical DOM updates; only widgets bound to a changed entity update
- **13 widget types:** label, button, switch, slider, bar, arc, rectangle, image, camera, clock, scene, history chart, agenda
- **Conditional overrides:** any widget property can change based on entity state, attributes, or page, using ordered rules with AND/OR logic
- **Template expressions:** `{{ ... }}` in label text and color fields for calculated values
- **MDI icons bundled locally:** works fully offline, no CDN required
- **Multi-page with swipe navigation:** dot indicators, swipe gestures, persistent overlay page
- **Camera support:** MJPEG, snapshot, poster, and direct URL preview modes; fullscreen HLS stream on tap
- **Screensaver:** configurable idle timeout with optional bouncing text
- **`haven_command` event bus:** HA automations can trigger navigation, wake, dim, or speech on the device
- **Visual designer:** drag-and-drop editor at `designer.html` with live preview, undo/redo, and entity search

![Preview](images/screenshot.png)

![Preview](images/smartclock.png)

![Preview](images/designer.png)

---

## Installation

### HACS (Recommended)

1. Open **HACS** in Home Assistant
2. Click the three dots (⋮) in the top right → **Custom repositories**
3. Add `https://github.com/TommySharpNZ/haven` and select **Dashboard** as the category
4. Click **Add**
5. Search for **HAven** and click **Download**
6. Hard refresh your browser (Ctrl+Shift+R)

### Manual

1. Download the latest release from the [latest release](https://github.com/TommySharpNZ/haven/releases/latest)
2. Copy the `haven/` folder to your Home Assistant `/config/www/` folder

---

## Quick Start

1. the `haven/` folderOpen `http://your-ha-ip:8123/local/haven/index.html?device=example`
2. Enter a Long-Lived Access Token when prompted
3. Edit `devices/example.json` or create your own device config

A graphical designer is available at `designer.html` on the same path. It requires Chrome or Edge over a HTTPS connection (Nabu Casa works perfectly).

---

## Documentation

| Document | Contents |
|----------|----------|
| [Getting Started](docs/getting-started.md) | Installation, first run, credentials, browser compatibility, troubleshooting |
| [Config Reference](docs/config-reference.md) | Device block, theme, pages, icons, internal entities, performance notes |
| [Widget Reference](docs/widgets.md) | All widget types with links to individual widget pages |
| [Actions](docs/actions.md) | Navigate, service calls, automations, value tokens, `haven_command` |
| [Conditional Overrides](docs/overrides.md) | Override syntax, condition sources, visibility, template expressions |
| [Designer Reference](DESIGNER.md) | Full designer tool documentation |

---

## Widget Types

| Widget | Description |
|--------|-------------|
| `label` | Text display with live entity values, formatting, icons, and template expressions |
| `button` | Tappable button with entity-driven state styling and service actions |
| `switch` | Sliding toggle for any binary entity |
| `slider` | Draggable control for brightness, volume, cover position, and similar |
| `bar` | Horizontal progress bar with threshold-based colors |
| `arc` | Circular gauge with threshold colors and center label |
| `rectangle` | Filled rectangle for card backgrounds, overlays, and gradients |
| `image` | Static or entity-driven image with optional fullscreen tap |
| `camera` | Camera feed (MJPEG / snapshot / poster / direct URL) with fullscreen HLS stream |
| `clock` | Current time display, updates every second |
| `scene` | Option selector rendered as buttons, dropdown, or picker |
| `history_chart` | Bar chart from HA long-term statistics with optional fullscreen modal |
| `agenda` | Scrollable event list from one or more HA calendar entities |

---

## Roadmap

**Planned**
- [ ] HACS frontend distribution
- [ ] Flow dots widget: animated dots along a path for energy/power direction visuals

**Implemented**
- [x] All 13 widget types listed above
- [x] Conditional overrides with ordered rules, all/any logic, attribute and page sources
- [x] Template expressions in label text and color
- [x] `entity2` secondary entity binding
- [x] Multi-page navigation with swipe gestures and dot indicators
- [x] Page 0 persistent overlay
- [x] Screensaver with idle timeout and bouncing text
- [x] `haven_command` event bus (navigate, speak, wake, dim)
- [x] Camera: MJPEG, snapshot, poster, direct URL, fullscreen HLS with audio
- [x] History chart with fullscreen modal and multiple view periods
- [x] Visual drag-and-drop designer with undo/redo, live preview, entity search, and attribute browser
- [x] MDI icons bundled locally
- [x] Page background images
- [x] Version-based cache busting
- [x] Per-device localStorage credentials with setup screen

---

## Compatibility

**Runtime (`index.html`):** any browser that can reach your HA instance. Tested on iPad Safari, budget Android WebViews, and smart TV browsers. Written in vanilla ES5 JavaScript with no framework dependencies.

**Designer (`designer.html`):** Chrome or Edge 86+ required for save-to-disk (File System Access API). Must be opened over HTTPS. Nabu Casa remote access works out of the box.

---

## Licence

MIT. Do whatever you like; attribution appreciated but not required.

---

## Supporting the Project

HAven is a personal project shared freely. If it's running on a screen in your home and you find it useful, the best support is sharing it with other HA users or contributing improvements back via GitHub issues or pull requests.

If you'd like to go further, you can buy me a coffee. HAven will always be free and open source, including the visual designer. Any support goes straight toward HA gadgets and tinkering that feeds future features.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/tommysharpnz)

[![GitHub](https://img.shields.io/badge/GitHub-TommySharpNZ%2Fhaven-181717?style=flat&logo=github)](https://github.com/TommySharpNZ/haven)
