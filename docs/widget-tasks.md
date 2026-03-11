# Widget: tasks

The tasks widget displays items from one or more HA todo list entities. Items are fetched via the HA WebSocket API, sorted by urgency, and rendered as a scrollable list. Each list gets its own accent color. Per-list options control whether items can be marked complete or new items added directly from the dashboard.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Lists Array](#lists-array)
- [Sort Order](#sort-order)
- [Due Dates](#due-dates)
- [Marking Items Complete](#marking-items-complete)
- [Adding Tasks](#adding-tasks)
- [Legend and Filtering](#legend-and-filtering)
- [Completed Items](#completed-items)
- [Optimistic Updates](#optimistic-updates)
- [Refresh Behaviour](#refresh-behaviour)
- [Scaling](#scaling)
- [Appearance](#appearance)
- [Integration Notes](#integration-notes)
- [Examples](#examples)

---

## Minimal Example

A read-only list from a single todo entity:

```json
{
  "id": "tasks",
  "type": "tasks",
  "x": 10, "y": 10, "w": 380, "h": 400,
  "lists": [
    {
      "entity": "todo.shopping",
      "color": "primary"
    }
  ]
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `lists` | Array of todo list source objects. See [Lists Array](#lists-array). **Required.** |
| `refresh_interval` | Seconds between automatic data re-fetches. Default: `120`. Minimum: `15`. |
| `legend` | Set to `false` to hide the per-list color legend when multiple lists are configured. Default: shown automatically when 2 or more lists are present. |
| `tasks_scale` | Uniform scale multiplier applied to all size values. Default: `1`. See [Scaling](#scaling). |
| `background` | Widget background color. Default: `surface`. |
| `radius` | Widget corner radius in pixels. Default: `12`. |
| `padding` | Inner padding between the widget edge and the card list, in pixels. Default: `10`. |
| `event_background` | Background color of individual task cards. Default: `surface2`. |
| `event_radius` | Corner radius of task cards in pixels. Default: `8`. |
| `accent_width` | Width of the per-list color bar on the left edge of each task card, in pixels. Default: `4`. |
| `overdue_color` | Color of the due date label when a task is overdue. Default: `danger`. |
| `title_color` | Task name text color. Default: `text`. |
| `detail_color` | Due date text color. Also used as the legend label color if `legend_color` is not set. Default: `text_muted`. |
| `legend_color` | Legend label text color. Overrides `detail_color` for legend items only. Default: falls back to `detail_color`. |
| `opacity` | Overall widget opacity from `0.0` to `1.0`. |

---

## Lists Array

The `lists` array defines which todo entities to show and how to display and interact with their items. Each entry is an object:

| Field | Description |
|-------|-------------|
| `entity` | HA todo entity ID (e.g. `todo.shopping`). **Required.** |
| `color` | Accent color for this list's items (theme token or hex). Default: `primary`. |
| `name` | Display name shown in the legend. Defaults to the entity ID with `todo.` prefix removed and underscores replaced by spaces. |
| `editable` | Set to `true` to allow marking items as complete from the dashboard. Default: `false`. |
| `allow_add` | Set to `true` to allow adding new items to this list. Default: `false`. |
| `show_completed` | Set to `true` to show completed items at the bottom of the list. Default: `false`. Note: support depends on the HA integration. See [Completed Items](#completed-items). |

```json
"lists": [
  {
    "entity": "todo.family_chores",
    "color": "primary",
    "name": "Chores",
    "editable": true,
    "allow_add": true
  },
  {
    "entity": "todo.shopping",
    "color": "warning",
    "name": "Shopping",
    "editable": false
  }
]
```

---

## Sort Order

Items across all visible lists are merged and sorted into the following buckets, in this order:

1. **Overdue** - items with a due date in the past, sorted oldest first
2. **Today** - items due today
3. **Tomorrow** - items due tomorrow
4. **No due date** - items with no due date set
5. **Future** - items due the day after tomorrow or later, sorted soonest first
6. **Completed** - completed items (shown only if `show_completed: true` on the list)

Within each bucket, items are sorted by time. Overdue items with the oldest due date appear first. Future items with the soonest due date appear first.

---

## Due Dates

When a task has a due date set, it is shown below the task name in `detail_color`. If the due date is in the past (overdue), it is shown in `overdue_color` and prefixed with a warning icon.

Dates display as day and short month name (e.g. `15 Mar`). If the due date is in a different year from today, the year is also shown (e.g. `15 Mar 2027`).

HA may return due dates as full ISO timestamps (`2026-03-15T00:00:00+00:00`) or as date-only strings (`2026-03-15`). Both formats are handled correctly and compared at day precision in local time.

---

## Marking Items Complete

When a list has `editable: true`, each of its pending items shows a circle checkbox icon on the left of the card. Tapping a task card opens a confirmation dialog showing the task name with "Mark as complete?" and Cancel/Done buttons. Tapping the background of the dialog or Cancel dismisses it without changes.

On confirmation:
- The checkbox icon changes to a filled circle in the list's accent color
- The task name gains a strikethrough style
- The card fades to half opacity
- The item is removed from interaction (the click handler is detached)
- A `todo.update_item` service call is sent to HA to persist the change
- A server refresh is scheduled 10 seconds later (see [Optimistic Updates](#optimistic-updates))

---

## Adding Tasks

When one or more lists have `allow_add: true`, a large plus button appears in the bottom-right corner of the widget. Tapping it opens an "Add task" modal with:

- **Task name** - text input, required. Pressing Enter submits the form.
- **Due date** - optional date picker. On supported browsers (Chrome, Firefox, modern Android WebView) this shows a native date picker. On others it accepts a `YYYY-MM-DD` string directly.
- **List picker** - shown only when two or more addable lists are configured. Colored pill buttons let the user choose which list the task is added to.

Tapping Save (or pressing Enter in the name field) adds the task immediately to the display then sends a `todo.add_item` service call to HA. Tapping Cancel or the background dismisses the modal without changes.

---

## Legend and Filtering

When two or more lists are configured, a legend bar appears at the top of the widget showing each list's color swatch and display name. Each legend entry is a tappable button: tapping it filters the task list to show only items from that list. Tapping the same button again clears the filter and shows all lists.

Set `legend: false` to hide the legend even when multiple lists are present.

The list display name in the legend is taken from the `name` field of the list entry. If `name` is not set, it is derived from the entity ID by removing the `todo.` prefix and replacing underscores with spaces.

---

## Completed Items

Set `show_completed: true` on a list entry to show completed items at the bottom of the list. Completed items are rendered with a filled checkbox icon in the list's accent color, a strikethrough task name, and reduced opacity.

Support for returning completed items depends on the HA todo integration:

- **Local todo** - completed items are returned correctly.
- **Google Tasks** - completed items are returned correctly.
- **Microsoft To Do (M365)** - the integration does not return completed items regardless of the status filter. `show_completed: true` has no effect with this integration.

---

## Optimistic Updates

Both task completion and task creation update the widget immediately without waiting for a server response:

- When a task is marked complete, the card updates instantly (checkbox, strikethrough, fade).
- When a new task is added, it appears in the list immediately.

A 10-second debounced server refresh runs after any change. If multiple tasks are completed in quick succession the timer resets on each one, so a full refresh fires 10 seconds after the last completion. This prevents the list from refreshing and jumping position while a user is working through a batch of tasks.

---

## Refresh Behaviour

The widget re-fetches all configured lists every `refresh_interval` seconds (default: 120). All list requests fire in parallel and the display updates once all responses are received.

The widget also subscribes to HA `state_changed` events for each todo entity. When HA reports a change to a todo entity (e.g. from a phone app or another client), the widget triggers an immediate refresh.

Both the periodic timer and any pending debounced refresh are cancelled automatically on page navigation. No ghost network activity occurs from todo entities while they are off-screen.

---

## Scaling

`tasks_scale` applies a uniform multiplier to all internal size values: font sizes, padding, radius, card heights, accent bar width, and icon sizes. Use it to scale the entire widget up or down without adjusting each property individually.

```json
{ "tasks_scale": 0.85 }
```

Values below `1` produce a more compact layout. Values above `1` produce a larger layout suitable for high-resolution screens or widgets with generous dimensions.

---

## Appearance

Key appearance properties and their defaults:

```json
{
  "background": "surface",
  "radius": 12,
  "padding": 10,
  "event_background": "surface2",
  "event_radius": 8,
  "accent_width": 4,
  "overdue_color": "danger",
  "title_color": "text",
  "detail_color": "text_muted",
  "legend_color": "(falls back to detail_color)"
}
```

---

## Integration Notes

The widget uses the HA WebSocket `todo.get_items` service with `return_response: true` and requests both `needs_action` and `completed` status items. The response envelope is `result.response[entity_id].items`.

`todo.update_item` is called with the item's `uid` and `status: "completed"` to mark an item done.

`todo.add_item` is called with `item` (name) and optionally `due_date` (YYYY-MM-DD string) to create a new item.

The widget renders immediately on page load with a "Loading..." placeholder. If the WebSocket is not yet connected, it retries every 2 seconds.

---

## Examples

### Single list, read-only

```json
{
  "id": "shopping",
  "type": "tasks",
  "x": 10, "y": 10, "w": 360, "h": 400,
  "lists": [
    {
      "entity": "todo.shopping",
      "color": "primary",
      "name": "Shopping"
    }
  ]
}
```

### Two editable lists with legend and add support

```json
{
  "id": "household_tasks",
  "type": "tasks",
  "x": 10, "y": 10, "w": 400, "h": 500,
  "legend": true,
  "lists": [
    {
      "entity": "todo.family_chores",
      "color": "primary",
      "name": "Chores",
      "editable": true,
      "allow_add": true
    },
    {
      "entity": "todo.shopping",
      "color": "warning",
      "name": "Shopping",
      "editable": true,
      "allow_add": true
    }
  ]
}
```

### Compact layout with scale

```json
{
  "id": "tasks_compact",
  "type": "tasks",
  "x": 10, "y": 10, "w": 320, "h": 280,
  "tasks_scale": 0.85,
  "lists": [
    {
      "entity": "todo.personal",
      "color": "primary",
      "name": "Personal"
    }
  ]
}
```

### Three lists, show completed where supported

```json
{
  "id": "all_tasks",
  "type": "tasks",
  "x": 10, "y": 10, "w": 420, "h": 520,
  "refresh_interval": 60,
  "lists": [
    {
      "entity": "todo.work",
      "color": "warning",
      "name": "Work",
      "editable": true
    },
    {
      "entity": "todo.personal",
      "color": "primary",
      "name": "Personal",
      "editable": true,
      "allow_add": true,
      "show_completed": true
    },
    {
      "entity": "todo.shopping",
      "color": "#4fc3f7",
      "name": "Shopping",
      "allow_add": true
    }
  ]
}
```
