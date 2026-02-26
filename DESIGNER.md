# WebHASP Designer

A visual drag-and-drop editor for WebHASP device configs. Lives in `designer.html` alongside the main dashboard files - no separate install, no build tools, same static file philosophy as the rest of WebHASP.

---

## Status

**Not yet implemented.** This document captures the design thinking and planned approach before development begins.

---

## Goals

- Load any device config JSON and render it visually on a to-scale canvas
- Click a widget to select it and view/edit its properties in a sidebar
- Drag widgets to reposition them, with optional grid snapping
- Add new widgets from a palette, delete existing ones
- Output valid JSON that can be dropped straight back into `devices/`
- Work entirely in the browser - no server, no build step

## Non-Goals

- Not a replacement for hand-editing JSON for power users
- Not a cloud service or a hosted tool
- No multi-user collaboration
- No version history or undo beyond basic browser state

---

## Key Considerations Before Building

### Do arc/gauge widgets first
The designer should support all widget types from day one. Adding a new widget type after the designer exists means adding designer support for it too - double the work. The arc/gauge widget is the main missing type. Build it first so the designer can treat the widget set as complete.

### Fix icon spacing first
The `[fa-name]` icon spacing bug (margin-right not applying correctly in button icons and labels) is small but will be very visible in the designer UI where widget labels are front and centre. Worth fixing before building a UI around it.

### Page 0 awareness
The designer needs to understand that page 0 widgets are persistent - they render on every page, not just their own. The canvas viewer should show page 0 widgets composited on top of whichever page is being designed, exactly as they would appear at runtime.

### groupid is already in the schema
The `groupid` field is already supported in the widget schema and ignored by the runtime. The designer uses it to treat widgets with the same groupid as an atomic unit for selection and movement. No schema changes needed.

### Separate file, shared mental model
The designer lives in `designer.html` and has its own JS. It does not modify `app.js`. Both files share the same JSON config schema - the designer reads and writes the same files that the dashboard runtime reads. No separate designer metadata format.

---

## Planned Phases

### Phase 1 - Canvas Viewer (read-only)
*Useful on its own. Gets the scaffolding right before adding complexity.*

- Load a config JSON (file picker or URL parameter `?device=name`)
- Render the canvas at design resolution with all widgets visible
- Page switcher to view each page
- Click a widget to highlight it and show its properties in a read-only sidebar
- No editing, no saving

This phase answers the hardest question: can we render the config accurately enough that what you see in the designer matches what you see in the dashboard? The rendering code will be shared/adapted from `app.js`.

### Phase 2 - Property Editing
*The most valuable phase for day-to-day config work.*

- Click a widget to select it
- Sidebar shows editable fields: text, font_size, colors, entity, format, action, etc.
- Changes reflect live on the canvas
- Save button outputs the updated JSON (browser download)
- Field types inferred from schema: text input, number, color picker, dropdown for enums, entity picker (fetches entity list from HA)

### Phase 3 - Drag and Reposition
- Drag selected widget to new position
- x/y update in real time
- Optional grid snapping (configurable grid size, e.g. 8px)
- Resize handles for w/h
- Arrow key nudging (1px or 8px with shift)
- Group selection: click groupid group moves all widgets together

### Phase 4 - Add and Delete
- Widget palette panel listing all widget types
- Drag from palette onto canvas to create a new widget with sensible defaults
- Delete key removes selected widget
- Duplicate selected widget (cmd/ctrl+D)
- Z-order controls (send to back, bring to front - reorders in the widgets array)

---

## Architecture Notes

**Rendering:** The designer canvas uses the same CSS transform scaling approach as the runtime. Widget rendering functions will be adapted from `app.js` but simplified - no entity subscriptions, no WebSocket, just static rendering from config values. A thin shared rendering layer is the goal rather than duplicating all of `app.js`.

**HA connection (optional):** The designer can optionally connect to HA (using stored localStorage credentials) to:
- Populate entity pickers with real entity IDs
- Show live entity values in the canvas preview
- Validate that referenced entities exist

If not connected, entity fields are plain text inputs and values show as placeholder text.

**Config I/O:**
- Load: file picker (`<input type="file">`) or `?device=name` URL parameter (fetches from `devices/` folder)
- Save: browser download of the modified JSON. No server-side save - the user drops the file back into their `devices/` folder.
- Future: direct save to HA via the REST API (`/api/config/...` or file editor API) if feasible.

**Selection model:**
- Single click: select widget, show in sidebar
- Click on groupid group: select all widgets in group
- Ctrl+click: add to selection
- Escape: deselect
- Selected widgets show a blue outline and resize handles

**Grid:**
- Default 8px grid, toggleable
- Snap to grid on drag and resize
- Grid overlay shown when dragging (subtle dots)

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Load Config]  [Save]   Device: ipad-air    Page: [1▾] [+] │  ← toolbar
├───────────────┬─────────────────────────────┬───────────────┤
│               │                             │               │
│  Widget       │                             │  Properties   │
│  Palette      │      Canvas                 │  Sidebar      │
│               │      (scaled to fit)        │               │
│  label        │                             │  id: clock    │
│  rectangle    │                             │  x: 16        │
│  bar          │                             │  y: 12        │
│  button       │                             │  w: 140       │
│  clock        │                             │  h: 36        │
│  image        │                             │  font_size:26 │
│  camera       │                             │  ...          │
│               │                             │               │
├───────────────┴─────────────────────────────┴───────────────┤
│  Grid: [8px ▾]  [x] Snap    x:16 y:12 w:140 h:36           │  ← status bar
└─────────────────────────────────────────────────────────────┘
```

---

## Open Questions

- **How to handle the entity picker?** A searchable dropdown populated from HA's entity list is ideal but requires a HA connection. Fallback to a plain text field with validation feedback.
- **Color picker UX?** Native `<input type="color">` is fine for hex values but doesn't understand theme tokens. The sidebar probably needs a dual mode: token dropdown + custom hex option.
- **Undo/redo?** Not in initial phases. The config is JSON and users can maintain their own backups. Could be added as a simple history stack later.
- **Mobile/tablet use?** The designer is primarily a desktop tool - designing on the same tablet you're using as a dashboard is an edge case. Touch support for the canvas is a nice-to-have, not a requirement.
