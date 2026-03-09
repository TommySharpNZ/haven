# HAven Designer

A visual drag-and-drop editor for HAven device configs. Lives in `designer.html` alongside the main dashboard files — no separate install, no build tools, same static file philosophy as the rest of HAven.

---

## Overview

The designer lets you build and edit HAven device configs visually without hand-editing JSON. You can drag widgets to reposition them, edit all properties through a sidebar panel, manage pages, configure the device and theme, and preview the result in a live runtime iframe — all in the browser.

Open it at: `http://your-ha-ip:8123/local/haven/designer.html`

---

## Getting Started

### Opening a config

From the welcome screen:

- **Open existing file** — pick a `devices/*.json` file using the browser's file picker. On Chrome/Edge the designer opens the directory so it can save changes back to the same file.
- **New device** — enter a name and pick a canvas size from presets (1024×768, 1280×800, 1920×1080, 800×480, 480×320) or enter a custom size.

You can also pass `?device=name` in the URL to load `devices/name.json` directly (same as the runtime app).

---

## Toolbar

| Button | Action |
|--------|--------|
| **New…** | Create a new device config |
| **Open** | Open an existing device JSON file |
| **Save** | Save back to disk (File System Access API). Creates a timestamped backup before overwriting. |
| **Download** | Save as a downloaded file (fallback for Firefox or when File System Access is unavailable) |
| **↩ / ↪** | Undo / Redo (50 levels deep) |
| **Copy / Cut / Paste** | Clipboard actions for selected widgets (also `Ctrl/Cmd + C/X/V`) |
| **Snap** | Toggle grid snap (8px grid). Active state shown highlighted. |
| **Pan** | Toggle pan mode. Right-click drag to pan is always available without enabling this. |
| **Preview** | Toggle a live preview iframe showing the runtime with your current config injected. |
| **Pages…** | Open the page management modal |
| **Device…** | Edit device properties (name, canvas size, default page, return timer, screensaver) |
| **Close** | Close the current device and return to the welcome screen |

---

## Canvas

Widgets are placed at absolute pixel positions matching the runtime coordinate space.

- **Click** — select a widget
- **Shift+click** — add/remove from a multi-selection
- **Drag** — move selected widgets (snaps to grid if Snap is on)
- **Arrow keys** — nudge by 1px (or 10px with Shift)
- **Scroll** — zoom in/out
- **Right-click drag** — pan the canvas (or use Pan mode for left-click drag)

Page 0 widgets (persistent overlay) are rendered on top of the current page, just as they appear at runtime.

---

## Widget Tree (left panel)

Lists all widgets on the current page in z-order (bottom to top). Each row shows:

- **Eye icon** — toggle widget visibility on canvas (hidden widgets still export to JSON)
- **Lock icon** — lock a widget so it can't be accidentally selected or moved on canvas
- **Type badge** — colour-coded letter indicating widget type
- **Name / ID** — widget label if set, otherwise ID + type

**Actions:**
- Drag rows to reorder (changes z-order)
- Use the search box to filter by name, ID, or type
- **Select All / Deselect** buttons for bulk operations
- **Add widget** buttons at the bottom — one button per widget type; they wrap to fill the available width

The left panel is **resizable**: drag the right edge handle to make it wider or narrower. Width is saved in localStorage.

---

## Properties Panel (right panel)

Select a widget to see and edit all its properties. Sections vary by widget type but always include:

- **Position / size** — X, Y, W, H (live-update on canvas as you type)
- **Widget Settings** — all type-specific properties (text, entity, format, color, background, font_size, radius, etc.)
- **Overrides** — conditional override rules. Click **+ Add override** to create a new rule. Each rule has:
  - **Condition group** — logic (all/any), conditions (source, type, value)
  - **Set** — the properties to apply when the condition matches
  - Expand/collapse, duplicate, and delete buttons per rule
  - **Insert Example** button populates a sensible starting rule for that widget type

- **Theme Colors** — click any swatch to copy the token name to clipboard. The **Edit Theme** button opens the theme editor (see below).
- **Raw JSON** — view and directly edit the widget's full JSON. Changes are applied on blur.

The right panel is **resizable**: drag the left edge handle to adjust width. Width is saved in localStorage.

### Entity search

Fields labelled `entity`, `entity2`, `snapshot_entity`, and `stream_entity` show a **magnifying glass button** next to the text input. Clicking it opens the entity search modal:

- Connects to your HA instance using the URL from the browser (`window.location.origin`)
- On first use, prompts for a Long-Lived Access Token (stored separately as `haven_designer_token`)
- Shows all HA entities with their current state
- **Search box** — filter by entity ID or friendly name
- **Domain dropdown** — filter to a single domain (e.g. `sensor`, `light`, `binary_sensor`)
- **Device class dropdown** — filter by device class (e.g. `temperature`, `motion`, `power`)
- Click any entity to insert its ID into the field
- **Refresh button** — re-fetch the entity list from HA (the list is cached for the session)
- A **Change token** link lets you update the stored token without clearing it manually

Some widget types pre-filter the list automatically. The `history_chart` entity field shows only sensors that have a `state_class` attribute (i.e. those with long-term statistics enabled), since other entities will not work with the chart.

### Attribute browse

The `entity_attribute` field shows a magnifying glass button that opens an **attribute browser** for the currently selected entity. The modal title changes to show the entity being inspected and lists all its attributes with their current values. Click any attribute name to insert it into the field. A search box filters the list for entities with many attributes. The domain and device class filters are hidden in this mode as they do not apply.

> **Note:** Set the `entity` field before clicking the attribute browse button. If no entity is selected the button shows a status message instead of opening.

---

## Page Management

Click **Pages…** to open the page manager:

- **Left column** — page list with drag-to-reorder, widget count, delete button. Drag rows to change the display order — page IDs stay stable so navigation actions are unaffected.
- **Right column** — page properties:
  - Label, background image (pick from disk), background opacity, background fit mode
  - Default page selector (which page loads on open / after return timer)

### Overlay page (page 0)

The overlay page is a special page whose widgets render on top of every other page at runtime — useful for persistent headers, clocks, or nav buttons. It always appears first in the page picker dropdown.

To create one, open **Pages…** and click **+ Add Overlay Page** at the bottom of the list. Once created, select it in the page picker or the Pages modal to edit it like any other page. Background image, opacity, and fit are not available for the overlay page (it renders transparently over the current page).

To delete it, click the bin icon next to the Overlay entry in the Pages modal.

---

## Device Properties

Click **Device…** to edit:

- **Name** — display name for this device
- **Canvas size** — width × height in pixels (preset or custom)
- **Default page** — page to show on load and to return to after inactivity
- **Return timer** — seconds of inactivity before returning to default page (0 = disabled)
- **Screensaver** — timeout (seconds), dim opacity (0.0–1.0), and optional overlay text

---

## Theme Editor

Click **Edit Theme** in the Properties panel to open the theme editor:

- **Fixed tokens** — the standard HAven color tokens (`background`, `surface`, `surface2`, `primary`, `warning`, `danger`, `text`, `text_dim`, `text_muted`, `icon_inactive`). Names are locked; only the color value can be changed.
- **Custom tokens** — any additional tokens you've defined. Name and color are both editable; these rows can be deleted.
- **Add color** — append a new custom token row
- **Font size** — base font size for the device (in px)

Changes apply to the config when you click **Save**.

---

## Alignment Tools

With two or more widgets selected the toolbar shows alignment buttons:

- Align left / right / top / bottom edges
- Centre horizontally / vertically
- Distribute evenly horizontally / vertically

---

## Preview

Click **Preview** to open a live preview panel next to the canvas. The preview runs the full HAven runtime with your current config injected — no save or reload required. It updates automatically as you make changes.

The preview uses your saved HA credentials (same localStorage key as the runtime app) to connect and show live entity values.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + C` | Copy selected widget(s) |
| `Ctrl/Cmd + X` | Cut selected widget(s) |
| `Ctrl/Cmd + V` | Paste with a small offset |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete / Backspace` | Delete selected widget(s) |
| Arrow keys | Nudge 1px |
| `Shift + Arrow` | Nudge 10px |
| `Escape` | Deselect all |

---

## File Structure

```
haven/
  designer.html         — Designer shell (all panels, modals, CSS)
  designer/
    app.js              — Main designer logic (canvas, toolbar, modals, entity search)
    render.js           — Widget rendering for the designer canvas
    grid.js             — Grid and guide rendering
    tree.js             — Widget tree panel
    selection.js        — Properties panel, overrides editor, theme palette
    io.js               — Config load/save, undo/redo, File System Access API
  devices/
    test-designer.json  — Sample config for testing the designer
```

---

## Browser Compatibility

The designer targets modern desktop browsers. The **File System Access API** (direct save to disk) requires Chrome or Edge 86+. Firefox can open and download files but cannot save directly back to disk — use **Download** instead.

The designer is a desktop tool. Touch support on the canvas is not a priority — the expectation is that you design on a computer and view on a tablet.

---

## Designer Metadata in Configs

The designer writes a `designer` block into device configs for its own metadata (ignored by the runtime):

```json
"designer": {
  "guides": {
    "1": [
      { "id": "g1", "type": "h", "pos": 120 },
      { "id": "g2", "type": "v", "pos": 320 }
    ]
  }
}
```

Guides are stored per page and persist across sessions.
