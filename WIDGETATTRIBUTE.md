# HAven — Widget Attribute Matrix

Quick reference for which attributes apply to each widget type, and which can be set via **conditional overrides**.

## Legend

| Symbol | Meaning |
|--------|---------|
| `✓` | Supported |
| `★` | Supported **and** settable via conditional overrides (`set: { ... }`) |
| `○` | Legacy support only — prefer `overrides` for new configs |
| `—` | Not applicable / not supported |

## Column Key

| Abbr | Widget type |
|------|-------------|
| **lbl** | label |
| **rct** | rectangle |
| **bar** | bar |
| **btn** | button |
| **clk** | clock |
| **img** | image |
| **cam** | camera |
| **arc** | arc |
| **hch** | history_chart |

---

## Layout & Position

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| `x` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `y` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `w` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `h` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Common Visual

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `background` | ★ | ✓ | ✓ | ★ | ✓ | — | — | ✓ | ✓ | arc: ring background color; bar/hch: widget/track background |
| `gradient` | — | ✓ | — | — | — | ✓ | — | — | — | rectangle/image linear gradient object |
| `opacity` | ★ | ✓ | ✓ | ★ | ✓ | ✓ | ✓ | ✓ | ✓ | base property, applied to all |
| `border_width` | ★ | ✓ | — | ★ | — | — | — | — | — | rct via `states`, btn via `overrides` |
| `border_color` | ★ | ✓ | — | ★ | — | — | — | — | — | rct via `states`, btn via `overrides` |
| `radius` | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | |
| `visible` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | tests entity state only (not attributes) |
| `groupid` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | designer hint only, ignored at runtime |

---

## Entity Binding

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `entity` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | primary HA entity |
| `entity2` | ✓ | — | — | — | — | — | — | — | — | label only; secondary entity subscription |
| `format` | ✓ | — | — | — | — | — | — | ✓ | — | power, kwh, percent, time_24, etc. |
| `prefix` | ✓ | — | — | — | — | — | — | — | — | used with `power_prefix` format |

---

## Conditional Overrides

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `overrides` | ★ | ★ | — | ★ | — | — | — | — | — | ordered rules; later rules win |
| `states` (legacy) | — | ○ | — | ○ | — | — | — | — | — | rect: keyed by raw state string; btn: `on`/`off` only |

**Settable via `overrides set: { ... }`**

| Property | lbl | rct | bar | btn |
|----------|-----|-----|-----|-----|
| `text` | ★ | — | — | — |
| `color` | ★ | — | — | — |
| `background` | ★ | ★ | — | ★ |
| `gradient` | — | ★ | — | — |
| `font_size` | ★ | — | — | — |
| `opacity` | ★ | ★ | — | ★ |
| `border_color` | ★ | ★ | — | ★ |
| `border_width` | ★ | ★ | — | ★ |
| `icon` | — | — | — | ★ |
| `icon_color` | — | — | — | ★ |
| `label` | — | — | — | ★ |
| `label_color` | — | — | — | ★ |

---

## Text & Typography

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `text` | ★ | — | — | — | — | — | — | — | — | supports `[mdi:name]` and `{{ }}` templates |
| `color` | ★ | — | — | — | ✓ | — | — | ✓ | ✓ | |
| `font_size` | ★ | — | — | — | ✓ | — | — | — | — | |
| `align` | ✓ | — | — | — | ✓ | — | — | — | — | left / center / right |
| `valign` | ✓ | — | — | — | — | — | — | — | — | top / center / bottom |
| `letter_spacing` | ✓ | — | — | — | — | — | — | — | — | px |
| `font_weight` | ✓ | — | — | — | — | — | — | — | — | 400, 600, bold, etc. |

---

## Actions

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `action` | — | ✓ | — | ✓ | — | — | — | — | — | navigate / automation / service |
| `fullscreen_on_tap` | — | — | — | — | — | ✓ | — | — | — | image only; camera always opens fullscreen on tap |

---

## Button-Specific

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `label` | — | — | — | ★ | — | — | ✓ | ✓ | — | btn label can be set via overrides |
| `label_color` | — | — | — | ★ | — | — | — | ✓ | — | |
| `label_size` | — | — | — | ✓ | — | — | — | — | — | auto-scales if omitted |
| `icon_on` | — | — | — | ○ | — | — | — | — | — | legacy; use `overrides` with `icon` instead |
| `icon_off` | — | — | — | ✓ | — | — | — | — | — | default icon when no override matches |
| `icon_color` | — | — | — | ★ | — | — | — | — | — | default; overrideable |
| `icon_size` | — | — | — | ✓ | — | — | — | — | — | auto-scales if omitted |
| `gap` | — | — | — | ✓ | — | — | — | — | — | px between icon and label |
| `padding` | — | — | — | ✓ | — | — | — | — | — | inner padding px |

---

## Bar-Specific

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `max` | — | — | ✓ | — | — | — | — | ✓ | ✓ | value = 100% fill |
| `thresholds` | — | — | ✓ | — | — | — | — | ✓ | — | `[{ below: N, color }, { default: true, color }]` |
| `color` | — | — | ✓ | — | — | — | — | ✓ | ✓ | fill/arc/bar color when no threshold matches |

---

## Arc-Specific

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `min` | — | — | — | — | — | — | — | ✓ | — | |
| `start_angle` | — | — | — | — | — | — | — | ✓ | — | degrees |
| `end_angle` | — | — | — | — | — | — | — | ✓ | — | degrees |
| `line_width` | — | — | — | — | — | — | — | ✓ | — | stroke width px |

---

## Camera-Specific

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `preview` | — | — | — | — | — | — | ✓ | — | — | mjpeg / snapshot / poster / url |
| `snapshot_entity` | — | — | — | — | — | — | ✓ | — | — | |
| `stream_entity` | — | — | — | — | — | — | ✓ | — | — | used for fullscreen HLS |
| `refresh_interval` | — | — | — | — | — | — | ✓ | — | ✓ | seconds for camera, history_chart, agenda |
| `fit` | — | — | — | — | — | ✓ | ✓ | — | — | cover / contain |
| `url` | — | — | — | — | — | ✓ | ✓ | — | — | img: static; cam: direct stream URL |

---

## History Chart-Specific

| Property | lbl | rct | bar | btn | clk | img | cam | arc | hch | Notes |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| `period` | — | — | — | — | — | — | — | — | ✓ | day / hour / month / year |
| `count` | — | — | — | — | — | — | — | — | ✓ | number of bars |
| `stat_type` | — | — | — | — | — | — | — | — | ✓ | change / mean |
| `today_color` | — | — | — | — | — | — | — | — | ✓ | color for current/latest bar |
| `show_values` | — | — | — | — | — | — | — | — | ✓ | show numeric value above each bar |
| `show_labels` | — | — | — | — | — | — | — | — | ✓ | show period labels below each bar |

---

## Template Expression Support (`{{ ... }}`)

| Context | lbl | rct | bar | btn | clk | img | cam | arc | hch |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| `text` field | ✓ | — | — | — | — | — | — | — | — |
| `color` field | ✓ | — | — | — | — | — | — | — | — |
| `label` field | — | — | — | ✓ | — | — | — | — | — |
| **Variables** | `state`, `state_str`, `attr.x`, `state2`, `state_str2`, `attr2.x` | — | — | `state`, `state_str`, `attr.x` | — | — | — | — | — |
| **Functions** | `round()`, `min()`, `max()`, `abs()`, `floor()`, `ceil()` | — | — | same | — | — | — | — | — |
