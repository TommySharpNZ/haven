# Widget: agenda

The agenda widget displays upcoming calendar events from one or more HA calendar entities. Events are fetched from the HA REST API, grouped by day, and rendered as a scrollable list or a side-by-side column view. Each calendar gets its own color, and per-calendar event fields like time, location, and description can be shown or hidden independently.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Calendars Array](#calendars-array)
- [Layouts](#layouts)
- [Event Card Fields](#event-card-fields)
- [Date Range](#date-range)
- [Multi-day Events](#multi-day-events)
- [Today Indicator](#today-indicator)
- [Month Headers](#month-headers)
- [Legend and Filtering](#legend-and-filtering)
- [Blank Days](#blank-days)
- [Duplicate Merging](#duplicate-merging)
- [Scaling](#scaling)
- [Refresh Interval](#refresh-interval)
- [Appearance](#appearance)
- [Examples](#examples)

---

## Minimal Example

A 7-day agenda from a single calendar:

```json
{
  "id": "family_agenda",
  "type": "agenda",
  "x": 10, "y": 10, "w": 380, "h": 480,
  "days_ahead": 7,
  "calendars": [
    {
      "entity": "calendar.family",
      "color": "primary",
      "show": ["time"]
    }
  ]
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `calendars` | Array of calendar source objects. See [Calendars Array](#calendars-array). **Required.** |
| `days_ahead` | Number of days to fetch events for, starting from today. Default: `7`. |
| `layout` | Display layout: `list` (default) or `columns`. See [Layouts](#layouts). |
| `time_format` | Clock format for event times: `12h` (default) or `24h`. |
| `today_indicator` | Set to `true` to visually highlight today's date column/row. Default: `false`. |
| `show_blank_days` | Set to `true` to show days with no events. Default: `false`. |
| `show_month_headers` | Set to `false` to hide the month name header rows. Default: `true`. |
| `legend` | Set to `true` to show a per-calendar color legend with tap-to-filter. Default: `false`. |
| `combine_duplicates` | Set to `true` to merge events with the same title on the same day from different calendars. Default: `false`. |
| `refresh_interval` | Seconds between automatic data re-fetches. Default: `120`. |
| `agenda_scale` | Uniform scale multiplier applied to all size values. Default: `1`. See [Scaling](#scaling). |
| `background` | Widget background color. Default: `surface`. |
| `radius` | Widget corner radius in pixels. Default: `12`. |
| `padding` | Inner padding in pixels. Default: `10`. |
| `opacity` | Overall opacity from `0.0` to `1.0`. |
| `event_background` | Background color of event cards. Default: `surface2`. |
| `event_radius` | Corner radius of event cards in pixels. Default: `8`. |
| `accent_width` | Width of the per-calendar color bar on the left of each event card in pixels. Default: `4`. |
| `title_color` | Event title text color. Default: `text`. |
| `title_size` | Event title font size in pixels. Default: `16`. |
| `detail_color` | Time, location, and description detail text color. Default: `text_muted`. |
| `detail_size` | Detail text font size in pixels. Default: `13`. |
| `link_color` | Color of the "More information..." link for events with descriptions. Default: `primary`. |
| `date_color` | Date number and weekday label color. Default: `text`. |
| `day_size` | Day number font size in pixels (list layout). Default: `36`. |
| `weekday_size` | Weekday label font size in pixels. Default: `14` (list), `21` (columns). |
| `date_col_width` | Width of the date column in pixels (list layout). Default: `52`. |
| `month_color` | Month header text color. Default: `primary`. |
| `month_size` | Month header font size in pixels. Default: `13` (list), `11` (columns). |
| `muted_color` | Color of the empty-state message. Default: `text_muted`. |
| `today_text_color` | Text color inside the today indicator highlight (list layout). Default: `background`. |
| `column_min_width` | Minimum column width in pixels before the columns layout scrolls horizontally. Default: `170`. |
| `column_gap` | Gap between columns in pixels (columns layout). Default: `8`. |

---

## Calendars Array

The `calendars` array defines which calendar entities to fetch and how to display their events. Each entry is an object:

| Field | Description |
|-------|-------------|
| `entity` | HA calendar entity ID (e.g. `calendar.family`). **Required.** |
| `color` | Accent color for this calendar's events (theme token or hex). Default: `primary`. |
| `name` | Display name shown in the legend. Defaults to the entity ID with underscores replaced by spaces. |
| `icon` | MDI icon name (without `mdi:` prefix) prepended to every event title from this calendar. |
| `show` | Array of optional fields to display on each event card. See [Event Card Fields](#event-card-fields). |
| `full_day_highlight` | Set to `true` to give all-day events from this calendar a colored card background instead of the default `event_background`. Default: `false`. |

```json
"calendars": [
  {
    "entity": "calendar.family",
    "color": "primary",
    "name": "Family",
    "show": ["time", "location"]
  },
  {
    "entity": "calendar.work",
    "color": "warning",
    "name": "Work",
    "icon": "briefcase",
    "show": ["time"]
  }
]
```

---

## Layouts

### list (default)

A vertical scrollable list grouped by day. Each day has a date column on the left (day number + weekday abbreviation) and event cards stacked on the right. Days with no events are hidden by default.

```json
{ "layout": "list" }
```

### columns

A side-by-side column view where each day gets its own scrollable column. Each column header shows the day number and full weekday name. Columns scroll independently within the widget. When the columns are too wide to fit, the widget scrolls horizontally.

```json
{ "layout": "columns" }
```

Use columns layout when showing a few days of a busy calendar where seeing events side-by-side is more useful than a long vertical list.

---

## Event Card Fields

The `show` array on each calendar entry controls which optional fields appear on event cards. Fields not in the array are not shown. All fields are opt-in.

| Value | Shows |
|-------|-------|
| `time` | Start and end time, or "All day" for all-day events |
| `location` | Event location, truncated with ellipsis if too long |
| `description_icon` | An icon and a "More information..." link that opens the full description in a modal overlay |

```json
"show": ["time", "location", "description_icon"]
```

The event title is always shown. The per-calendar color bar (`accent_width`) is always shown on the left edge of the card.

---

## Date Range

`days_ahead` sets how many days forward to fetch events from today. Today is always included. A value of `7` returns events for today through six days ahead.

```json
{ "days_ahead": 14 }
```

---

## Multi-day Events

Events that span multiple days are automatically expanded and shown on each day they cover. The title includes "(cont.)" on continuation days. For timed multi-day events:

- The start day shows "From HH:MM"
- Middle days show "All day"
- The end day shows "Until HH:MM"

All-day multi-day events show "All day" on every day they span.

---

## Today Indicator

Set `today_indicator: true` to visually highlight the current day.

In **list layout**: today's date column gets a colored pill background (using the `primary` theme color) with the date number and weekday shown in `today_text_color`.

In **columns layout**: today's column header gets a subtle colored underline and a light background tint.

```json
{ "today_indicator": true }
```

---

## Month Headers

When events span multiple months, a month name header (JANUARY, FEBRUARY, etc.) is inserted automatically between day groups. Set `show_month_headers: false` to suppress these headers:

```json
{ "show_month_headers": false }
```

---

## Legend and Filtering

Set `legend: true` to show a row of per-calendar color swatches at the top of the widget. Each swatch is a tappable button: tapping one filters the event list to show only events from that calendar. Tapping it again clears the filter. The legend appears alongside the first month header.

```json
{ "legend": true }
```

The calendar display name in the legend is taken from the `name` field of the calendar entry. If `name` is not set, it is derived from the entity ID by removing the `calendar.` prefix and replacing underscores with spaces.

---

## Blank Days

By default, days with no events are hidden from the list. Set `show_blank_days: true` to always show all days in the `days_ahead` range, even if they have no events:

```json
{ "show_blank_days": true }
```

In columns layout, `show_blank_days` shows an empty column for each day with no events.

---

## Duplicate Merging

When multiple calendars are configured and the same event appears in more than one (for example, a shared family calendar and a personal calendar), set `combine_duplicates: true` to show it only once. Events are considered duplicates when they fall on the same day and have exactly the same title:

```json
{ "combine_duplicates": true }
```

---

## Scaling

`agenda_scale` applies a uniform multiplier to all internal size values: font sizes, padding, radius, card heights, and column widths. Use it to scale the entire widget up or down without adjusting each property individually.

```json
{ "agenda_scale": 0.85 }
```

Values below `1` produce a more compact layout. Values above `1` produce a larger layout suitable for high-resolution screens or widgets with generous dimensions.

---

## Refresh Interval

The agenda re-fetches all calendars every `refresh_interval` seconds. The default is 120 seconds (2 minutes). All calendar requests fire in parallel and the list re-renders once all responses are received.

The refresh timer is registered in HAven's `activePageTimers` list and cancelled automatically on page navigation.

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
  "title_color": "text",
  "title_size": 16,
  "detail_color": "text_muted",
  "detail_size": 13,
  "date_color": "text",
  "month_color": "primary"
}
```

---

## Examples

### Single calendar, list layout

```json
{
  "id": "agenda",
  "type": "agenda",
  "x": 10, "y": 10, "w": 380, "h": 500,
  "days_ahead": 7,
  "today_indicator": true,
  "time_format": "12h",
  "calendars": [
    {
      "entity": "calendar.family",
      "color": "primary",
      "show": ["time", "location"]
    }
  ]
}
```

### Two calendars with legend and filter

```json
{
  "id": "agenda_multi",
  "type": "agenda",
  "x": 10, "y": 10, "w": 400, "h": 520,
  "days_ahead": 14,
  "legend": true,
  "today_indicator": true,
  "time_format": "24h",
  "calendars": [
    {
      "entity": "calendar.family",
      "color": "primary",
      "name": "Family",
      "show": ["time"]
    },
    {
      "entity": "calendar.work",
      "color": "warning",
      "name": "Work",
      "icon": "briefcase",
      "full_day_highlight": true,
      "show": ["time", "location"]
    }
  ]
}
```

### Columns layout for a busy week

```json
{
  "id": "week_view",
  "type": "agenda",
  "x": 10, "y": 10, "w": 700, "h": 400,
  "layout": "columns",
  "days_ahead": 5,
  "show_blank_days": true,
  "today_indicator": true,
  "time_format": "24h",
  "calendars": [
    {
      "entity": "calendar.family",
      "color": "primary",
      "show": ["time"]
    }
  ]
}
```

### Compact agenda with scale

```json
{
  "id": "compact_agenda",
  "type": "agenda",
  "x": 10, "y": 10, "w": 320, "h": 300,
  "days_ahead": 5,
  "agenda_scale": 0.8,
  "show_month_headers": false,
  "calendars": [
    {
      "entity": "calendar.family",
      "color": "primary",
      "show": ["time"]
    }
  ]
}
```
