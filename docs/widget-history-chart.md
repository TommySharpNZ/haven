# Widget: history_chart

The history_chart widget fetches HA long-term statistics and renders a vertical bar chart. Each bar represents one period (hour, day, month, or year), with the current period always shown last and highlighted in a distinct color. Tapping the widget can open a fullscreen modal with switchable time range views.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Entity Requirements](#entity-requirements)
- [Period and Count](#period-and-count)
- [stat\_type: mean vs change](#stat_type-mean-vs-change)
- [Bar Labels and Values](#bar-labels-and-values)
- [Y-axis Scaling](#y-axis-scaling)
- [Fullscreen Modal](#fullscreen-modal)
- [Fullscreen Views](#fullscreen-views)
- [Refresh Interval](#refresh-interval)
- [Loading Behaviour](#loading-behaviour)
- [Examples](#examples)

---

## Minimal Example

Seven days of daily energy consumption:

```json
{
  "id": "daily_energy",
  "type": "history_chart",
  "x": 10, "y": 10, "w": 380, "h": 120,
  "entity": "sensor.daily_energy_total",
  "period": "day",
  "count": 7,
  "stat_type": "change",
  "color": "primary",
  "today_color": "warning"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | HA entity ID. Must have long-term statistics enabled. See [Entity Requirements](#entity-requirements). |
| `period` | Bar period: `hour`, `day` (default), `month`, or `year`. |
| `count` | Number of bars to display. Default: `7`. |
| `stat_type` | Statistic to fetch: `mean` (default) or `change`. See [stat\_type](#stat_type-mean-vs-change). |
| `max` | Fixed y-axis ceiling. Omit to auto-scale from the data. |
| `color` | Bar fill color for all bars except the current period. Default: `primary`. |
| `today_color` | Bar fill color for the current period (rightmost bar). Default: `warning`. |
| `label_color` | Color for period labels below each bar. Default: `text_muted`. |
| `background` | Widget background color. Default: `surface`. |
| `radius` | Corner radius of each bar in pixels. Default: `2`. |
| `show_values` | Show numeric value labels above each bar. Default: `true`. |
| `show_labels` | Show period labels below each bar. Default: `true`. |
| `label` | Title shown in the fullscreen modal title bar. Defaults to the entity ID. |
| `refresh_interval` | Seconds between automatic data re-fetches. Defaults: `3600` (day/month/year), `300` (hour). |
| `fullscreen_on_tap` | Set to `true` to open an enlarged modal on tap. Default: `false`. |
| `fullscreen_views` | Array of view definitions shown as selectable buttons in the fullscreen modal. See [Fullscreen Views](#fullscreen-views). |

---

## Entity Requirements

The entity must have long-term statistics enabled in the HA recorder. This is determined by the sensor's `state_class`:

| `state_class` | Typical sensor types | Recommended `stat_type` |
|---------------|---------------------|------------------------|
| `measurement` | Power (W), temperature, humidity | `mean` |
| `total_increasing` | Energy meters (kWh), gas, water | `change` |
| `total` | Net energy, signed totals | `change` |

Sensors without a `state_class` do not have long-term statistics and will not work with this widget. Check the sensor's attributes in HA Developer Tools to confirm.

> **Tip:** When configuring the widget in the designer, the entity search pre-filters to sensors that have a `state_class` set.

---

## Period and Count

`period` sets the duration each bar represents. `count` sets how many bars are shown, working backwards from the current period.

| `period` | Each bar covers | Bar labels |
|----------|----------------|------------|
| `hour` | One hour | Day-of-week letter (S M T W T F S) |
| `day` | One day | Day-of-week letter (S M T W T F S) |
| `month` | One calendar month | Month initial (J F M A M J J A S O N D) |
| `year` | One calendar year | 2-digit year (e.g. 24, 25) |

The rightmost bar always represents the current period (today, this hour, this month, or this year) and is rendered in `today_color`.

```json
{ "period": "month", "count": 12 }
```

---

## stat_type: mean vs change

`stat_type` controls which statistic is fetched from the HA recorder for each period:

**`mean`** - The average value over the period. Use for sensors that measure an instantaneous reading such as power in watts, temperature, or humidity. Each bar height represents the average reading for that period.

```json
{ "stat_type": "mean", "entity": "sensor.house_power" }
```

**`change`** - The net increase over the period. Use for accumulating sensors such as energy meters measured in kWh. Each bar height represents how much the total increased during that period.

```json
{ "stat_type": "change", "entity": "sensor.daily_energy_total" }
```

Using the wrong `stat_type` for the sensor class will result in all bars showing zero or unexpected values.

---

## Bar Labels and Values

### Period labels

`show_labels: true` (default) renders a single letter below each bar identifying the period:

- `day` and `hour` periods: S M T W T F S (Sunday through Saturday)
- `month` period: J F M A M J J A S O N D
- `year` period: last two digits of the year

The current period label is rendered in `today_color` to match its bar.

### Value labels

`show_values: true` (default) renders a numeric label above each bar showing the period value. Values of 10 or above are shown as integers; values below 10 are shown to one decimal place.

To produce a more compact chart, disable either or both:

```json
{ "show_labels": false, "show_values": false }
```

---

## Y-axis Scaling

By default the y-axis scales automatically to the tallest bar in the current data set. Set `max` to fix the ceiling and keep the scale consistent across refreshes:

```json
{ "max": 30 }
```

A fixed `max` is useful when comparing charts side-by-side or when you want to prevent a spike from compressing all other bars.

---

## Fullscreen Modal

Set `fullscreen_on_tap: true` to open an enlarged chart modal when the widget is tapped. The modal:

- Re-fetches the data at the available screen dimensions
- Preserves the same `period`, `count`, `stat_type`, and visual settings as the inline widget unless overridden by `fullscreen_views`
- Shows the `label` value in the title bar (falls back to the entity ID)
- Closes via the close button or by tapping outside the chart area

```json
{
  "fullscreen_on_tap": true,
  "label": "Solar Generation"
}
```

---

## Fullscreen Views

`fullscreen_views` is an optional array of view definitions shown as pill buttons inside the fullscreen modal. When two or more views are defined, buttons appear at the top of the modal and the first view loads automatically on open.

Each view can override `period`, `count`, and `stat_type` independently. The widget's base settings are used for any field not specified in the view.

```json
"fullscreen_on_tap": true,
"fullscreen_views": [
  { "label": "24h",  "period": "hour",  "count": 24, "stat_type": "mean" },
  { "label": "7d",   "period": "day",   "count": 7,  "stat_type": "change" },
  { "label": "30d",  "period": "day",   "count": 30, "stat_type": "change" },
  { "label": "12m",  "period": "month", "count": 12, "stat_type": "change" },
  { "label": "3y",   "period": "year",  "count": 3,  "stat_type": "change" }
]
```

Each entry in `fullscreen_views`:

| Field | Description |
|-------|-------------|
| `label` | Button label shown in the modal. |
| `period` | Period to use for this view. |
| `count` | Number of bars for this view. |
| `stat_type` | Statistic type for this view. |

---

## Refresh Interval

The chart re-fetches data automatically at `refresh_interval` seconds. Defaults:

- `hour` period: every 300 seconds (5 minutes)
- All other periods: every 3600 seconds (1 hour)

Set a custom interval if your data changes more or less frequently:

```json
{ "refresh_interval": 1800 }
```

The refresh timer is registered in HAven's `activePageTimers` list and is cancelled automatically when the user navigates away from the page.

---

## Loading Behaviour

The chart renders a "loading..." placeholder when the page first draws, because the page renders before the WebSocket connection to HA completes. HAven retries the data request every 2 seconds up to 20 times until the WS connection is ready. Once data arrives the chart renders immediately with no user action required.

---

## Examples

### Daily energy consumption, 7 days

```json
{
  "id": "energy_chart",
  "type": "history_chart",
  "x": 10, "y": 130, "w": 380, "h": 120,
  "entity": "sensor.daily_energy_total",
  "period": "day",
  "count": 7,
  "stat_type": "change",
  "color": "primary",
  "today_color": "warning",
  "background": "surface",
  "radius": 2
}
```

### Average house power, last 24 hours

```json
{
  "id": "power_chart",
  "type": "history_chart",
  "x": 10, "y": 270, "w": 380, "h": 100,
  "entity": "sensor.house_power",
  "period": "hour",
  "count": 24,
  "stat_type": "mean",
  "color": "primary",
  "today_color": "warning",
  "max": 5000,
  "show_values": false
}
```

### Monthly energy with fullscreen multi-view

```json
{
  "id": "monthly_energy",
  "type": "history_chart",
  "x": 10, "y": 10, "w": 380, "h": 140,
  "entity": "sensor.energy_meter",
  "period": "month",
  "count": 12,
  "stat_type": "change",
  "color": "primary",
  "today_color": "warning",
  "label": "Energy",
  "fullscreen_on_tap": true,
  "fullscreen_views": [
    { "label": "7d",  "period": "day",   "count": 7,  "stat_type": "change" },
    { "label": "30d", "period": "day",   "count": 30, "stat_type": "change" },
    { "label": "12m", "period": "month", "count": 12, "stat_type": "change" },
    { "label": "3y",  "period": "year",  "count": 3,  "stat_type": "change" }
  ]
}
```

### Compact temperature chart, no labels or values

```json
{
  "id": "temp_chart",
  "type": "history_chart",
  "x": 10, "y": 380, "w": 200, "h": 60,
  "entity": "sensor.outdoor_temperature",
  "period": "day",
  "count": 14,
  "stat_type": "mean",
  "color": "primary",
  "today_color": "warning",
  "show_labels": false,
  "show_values": false,
  "radius": 2
}
```
