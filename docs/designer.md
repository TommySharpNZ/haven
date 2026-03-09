# Designer Reference

The HAven Designer is a visual drag-and-drop editor for building device configs without hand-editing JSON. It runs entirely in the browser as a static file alongside the main dashboard.

Open it at: `http://your-ha-ip:8123/local/haven/designer.html`

---

## Contents

- [Browser Requirements](#browser-requirements)
- [Getting Started](#getting-started)
- [Toolbar](#toolbar)
- [Canvas](#canvas)
- [Widget Tree](#widget-tree)
- [Properties Panel](#properties-panel)
- [Entity Search](#entity-search)
- [Pages](#pages)
- [Device Properties](#device-properties)
- [Theme Editor](#theme-editor)
- [Alignment Tools](#alignment-tools)
- [Preview](#preview)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Browser Requirements

The designer requires **Chrome or Edge 86+** and must be opened over **HTTPS**. The File System Access API, which allows saving directly back to the config file on disk, is not available in Firefox or over plain HTTP.

[Nabu Casa](https://www.nabucasa.com) remote access satisfies the HTTPS requirement out of the box and is the easiest way to use the designer. A self-signed local SSL certificate also works if you prefer to stay local.

Firefox can open and edit configs but uses a Download button instead of direct save.

---

## Getting Started

From the welcome screen, choose one of two options:

- **Open File:** pick an existing `devices/*.json` file from disk. Chrome and Edge open the folder so they can save changes back to the same file without prompting again.
- **New Device:** enter a name and pick a canvas size from presets or enter a custom width and height.

You can also open a specific config by passing `?device=name` in the URL, the same as the runtime app.

---

## Toolbar

| Button | Action |
|--------|--------|
| Open | Open an existing device JSON file |
| New | Create a new device config |
| Close | Close the current device and return to the welcome screen |
| Device | Edit device properties: name, canvas size, page timer, screensaver |
| Pages | Manage pages: add, rename, reorder, set background images |
| Save | Save directly to disk (Chrome/Edge only) |
| Undo / Redo | 50 levels of history |
| Copy / Cut / Paste | Clipboard actions for selected widgets |
| Preview | Toggle a live preview iframe |
| Snap | Toggle grid snapping |
| Pan | Toggle canvas pan mode (right-click drag always pans) |

---

## Canvas

Widgets are placed at absolute pixel coordinates matching the runtime layout exactly.

- **Click** to select a widget
- **Shift+click** to add or remove from a multi-selection
- **Drag** to move selected widgets (snaps to grid when Snap is enabled)
- **Scroll** to zoom in and out
- **Right-click drag** to pan (or enable Pan mode for left-click drag)
- **Arrow keys** to nudge by 1px, or 10px with Shift held

Page 0 (persistent overlay) widgets are always rendered on top of the current page, matching the runtime behaviour.

---

## Widget Tree

The left panel lists all widgets on the current page in z-order (bottom to top).

- Click a row to select a widget on canvas
- **Eye icon:** toggle canvas visibility (hidden widgets still export to JSON)
- **Lock icon:** lock a widget so it cannot be accidentally selected or moved
- **Type badge:** colour-coded letter showing widget type
- **Drag rows** to reorder (changes z-order)
- **Search box** to filter by name, ID, or type
- **Add widget buttons** at the top: one per widget type

The left panel width is resizable by dragging its right edge. The width is saved per session.

---

## Properties Panel

Select a widget to edit all its properties in the right panel. Every widget type shows:

- **Position and size:** X, Y, W, H fields with live canvas update as you type
- **Widget settings:** all type-specific properties (text, entity, format, color, font size, radius, etc.)
- **Overrides:** add and manage conditional override rules. Each rule has a condition group (logic: all/any, one or more conditions) and a set of properties to apply when matched. An **Insert Example** button populates a sensible starting rule for that widget type.
- **Theme Colors:** swatches for all tokens in the current theme. Click any swatch to copy its token name. The Edit Theme button opens the theme editor.
- **Raw JSON:** view and directly edit the widget's full JSON. Applied on blur.

The right panel width is resizable by dragging its left edge.

---

## Entity Search

Fields for `entity`, `entity2`, `snapshot_entity`, and `stream_entity` show a magnifying glass button. Clicking it opens the entity search modal, which connects to your HA instance and lists all entities with their current states.

- **Search box:** filter by entity ID or friendly name
- **Domain filter:** limit to a single domain (sensor, light, binary_sensor, etc.)
- **Device class filter:** limit by device class (temperature, motion, power, etc.)
- Click any row to insert the entity ID into the field
- **Refresh button:** re-fetches the entity list from HA

On first use the designer prompts for a Long-Lived Access Token, stored separately as `haven_designer_token`. A Change Token link lets you update it later.

The `history_chart` entity field automatically pre-filters to sensors with `state_class` set, since only those have long-term statistics.

The `entity_attribute` field has its own magnifying glass that opens an **attribute browser** for the currently selected entity, listing all attributes with their current values. Set `entity` before clicking this button.

---

## Pages

Click **Pages** to open the page manager. The left column lists all pages with their widget counts. Drag rows to reorder pages (IDs stay stable so navigation actions are not affected).

Select a page on the left to edit its properties on the right: label, background image, background opacity, and background fit mode (cover or contain).

The **overlay page** (page 0) renders its widgets on top of every other page at runtime. Create one via **+ Add Overlay Page**. Background images do not apply to the overlay page.

---

## Device Properties

Click **Device** to edit:

- Device name
- Canvas width and height (preset or custom)
- Default page (loaded on startup and returned to after inactivity)
- Return timer in seconds (0 to disable)
- Screensaver timeout, dim opacity, and optional bouncing text
- Page navigation dot settings (show/hide, colors, size)
- Optional embedded HA token and URL (for provisioning new tablets)

---

## Theme Editor

Click **Edit Theme** in the Properties panel to open the theme editor.

Fixed tokens (`background`, `surface`, `surface2`, `primary`, `warning`, `danger`, `text`, `text_dim`, `text_muted`, `icon_inactive`) have locked names but editable color values. Custom tokens can be added, renamed, and deleted. Changes apply to the config on Save.

See [Config Reference: theme block](config-reference.md#theme-block) for the full token list and how tokens are used in widget properties.

---

## Alignment Tools

With two or more widgets selected, alignment buttons appear in the toolbar:

- Align left, right, top, or bottom edges
- Centre horizontally or vertically
- Distribute evenly horizontally or vertically (Not Working!)

---

## Preview

Click **Preview** to open a live preview panel alongside the canvas. The preview runs the full HAven runtime with your current config injected and updates automatically as you make changes. It connects to HA using the same stored credentials as the runtime app, so live entity values are visible. While it does it's best the render the true front end not every widget will render faithfully. But it should be useful to move things around as the arrow keys still move selected widgets while in preview mode.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected widget(s) |
| `Ctrl/Cmd + X` | Cut selected widget(s) |
| `Ctrl/Cmd + V` | Paste with a small offset |
| `Delete / Backspace` | Delete selected widget(s) |
| Arrow keys | Nudge 1px |
| `Shift + Arrow` | Nudge 10px |
| `Escape` | Deselect all |
