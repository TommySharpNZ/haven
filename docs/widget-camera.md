# Widget: camera

The camera widget displays a live camera feed in a configurable preview mode and opens a fullscreen HLS stream with audio when tapped. Four preview modes cover a range of bandwidth and latency requirements. Authentication is handled automatically using the camera entity's access token from the HA state cache.

---

## Contents

- [Minimal Example](#minimal-example)
- [Properties](#properties)
- [Preview Modes](#preview-modes)
- [Entity Fields](#entity-fields)
- [Fullscreen Stream](#fullscreen-stream)
- [Fit Mode](#fit-mode)
- [Direct URL Mode](#direct-url-mode)
- [Timer Cleanup](#timer-cleanup)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

---

## Minimal Example

An MJPEG preview camera that opens a fullscreen HLS stream on tap:

```json
{
  "id": "front_door",
  "type": "camera",
  "x": 10, "y": 10, "w": 320, "h": 200,
  "label": "Front Door",
  "entity": "camera.front_door",
  "preview": "mjpeg"
}
```

---

## Properties

| Property | Description |
|----------|-------------|
| `entity` | Primary HA camera entity ID. Used as the preview source and the fullscreen stream source when `snapshot_entity` or `stream_entity` are not set. |
| `snapshot_entity` | Camera entity to use for snapshot and poster previews. Defaults to `entity`. |
| `stream_entity` | Camera entity to use for the fullscreen HLS stream. Defaults to `entity`. |
| `preview` | Preview rendering mode: `mjpeg` (default), `snapshot`, `poster`, or `url`. See [Preview Modes](#preview-modes). |
| `refresh_interval` | Polling interval in seconds for `snapshot`, `poster`, and `url` modes. Defaults: `3` (snapshot), `60` (poster). Optional for `url`. |
| `url` | Direct image URL for `url` preview mode. |
| `label` | Text label shown in the fullscreen stream overlay title bar. |
| `fit` | How the preview image fills the widget. Default: `cover`. See [Fit Mode](#fit-mode). |
| `radius` | Corner radius in pixels. Default: `0`. |

---

## Preview Modes

### mjpeg (default)

Opens a persistent MJPEG stream via HA's `/api/camera_proxy_stream/` endpoint. The browser receives a continuous stream of JPEG frames over a single HTTP connection. HAven requests one signed URL per session and keeps the connection open.

```json
{ "preview": "mjpeg" }
```

Best for: cameras where a live continuous feed is important and bandwidth is not constrained. Most efficient for single-camera use.

### snapshot

Polls `/api/camera_proxy/` at `refresh_interval` seconds (default: 3) and swaps the image on each successful load. Authentication uses the entity's `access_token` from the HA state cache directly, avoiding a WebSocket round-trip on every tick.

```json
{ "preview": "snapshot", "refresh_interval": 5 }
```

Best for: multi-camera grids where opening many simultaneous MJPEG connections would be impractical.

### poster

Identical to `snapshot` but overlays a play button icon on the still image. The refresh interval defaults to 60 seconds to minimise bandwidth. Tapping opens the fullscreen HLS stream.

```json
{ "preview": "poster", "refresh_interval": 30 }
```

Best for: camera grids with many cameras where bandwidth is a concern. Provides a visual cue that tapping opens a live stream.

### url

Loads a direct image URL without going through HA authentication. A cache-busting timestamp is appended on every fetch. `refresh_interval` is optional: omit it to load the image once, or set it to poll continuously.

```json
{ "preview": "url", "url": "http://192.168.1.100/snapshot.jpg", "refresh_interval": 5 }
```

Best for: cameras with a direct HTTP snapshot endpoint (such as Reolink or other ONVIF cameras) where bypassing HA proxying is preferred.

> **Note:** If HA is served over HTTP and the camera URL is HTTPS with a self-signed certificate, the browser will silently block the request. Either use HTTP for the camera URL, or visit the camera IP directly in the browser once to accept the certificate.

---

## Entity Fields

Three entity fields control which camera entity is used for each function:

| Field | Purpose | Default |
|-------|---------|---------|
| `entity` | Preview source for `mjpeg` mode; fallback for all other fields | required |
| `snapshot_entity` | Snapshot/poster preview source | falls back to `entity` |
| `stream_entity` | Fullscreen HLS stream source | falls back to `entity` |

Splitting these fields is useful when a camera integration provides separate entities for different quality levels or functions. For example, a Reolink NVR may expose both a fluent (low-bitrate) snapshot entity and a higher-quality stream entity:

```json
{
  "entity": "camera.front_door",
  "snapshot_entity": "camera.front_door_snapshots_fluent",
  "stream_entity": "camera.front_door_fluent"
}
```

HAven subscribes to all three entities on page load so that access tokens are in the state cache before the first snapshot tick fires.

---

## Fullscreen Stream

Tapping any camera widget always opens a fullscreen HLS stream, regardless of the preview mode in use. HAven sends a `camera/stream` WebSocket request to HA to obtain the HLS stream URL, then:

- On Safari and iOS: uses native HLS via the `<video>` element directly.
- On Chrome, Firefox, and other browsers: loads HLS.js on demand and plays the stream through it.

The fullscreen overlay shows the `label` value (if set) in the title bar, a close button, and supports tap-outside-to-close. Audio is enabled when available.

If the stream cannot be started (for example, when the camera integration does not support streaming), an error icon and message are shown in the overlay.

---

## Fit Mode

The `fit` property controls how the preview image fills the widget bounds. Accepts the same values as the image widget:

| Value | Behaviour |
|-------|-----------|
| `cover` (default) | Scales to fill, cropping edges if aspect ratios differ |
| `contain` | Scales to fit entirely within the widget |
| `fill` | Stretches to exactly fill, ignoring aspect ratio |

---

## Timer Cleanup

Snapshot and poster modes use a polling timer. URL mode uses a polling timer when `refresh_interval` is set. These timers are registered in HAven's `activePageTimers` list and are stopped automatically when the user navigates away from the page. There is no ghost network activity from cameras on off-screen pages.

MJPEG mode does not use a timer. The stream connection is maintained by the browser and the `<img>` element is removed from the DOM on page navigation, which closes the connection.

---

## Troubleshooting

**Preview shows a loading spinner indefinitely**

The camera entity's `access_token` may not be in the state cache yet. This can happen if the WebSocket connection to HA has not completed the initial `get_states` call. The widget registers a one-time callback and retries as soon as the state arrives, so the image typically appears within a few seconds of the WS connection completing.

**Snapshot mode shows an error icon**

The signed URL or access token request failed. Check that the camera entity exists and is available in HA. Check the browser console for details.

**Direct URL (url mode) loads once then stops updating**

`refresh_interval` must be set to enable polling. Without it the image is loaded once and not refreshed.

**Fullscreen stream shows "Stream unavailable"**

HA could not produce an HLS stream URL for the entity. Verify the camera integration supports streaming by testing the native camera card in the HA dashboard first. Check HA logs for stream-related errors.

**url mode fails silently with a self-signed HTTPS camera**

Visit the camera's IP address directly in the browser and accept the certificate. After that the browser will allow the image request.

---

## Examples

### MJPEG single camera

```json
{
  "id": "driveway",
  "type": "camera",
  "x": 10, "y": 10, "w": 460, "h": 290,
  "label": "Driveway",
  "entity": "camera.driveway",
  "preview": "mjpeg",
  "fit": "cover",
  "radius": 8
}
```

### Snapshot multi-camera grid

Four cameras in a 2x2 grid using snapshot mode to avoid opening four simultaneous MJPEG streams:

```json
{
  "id": "cam1",
  "type": "camera",
  "x": 0, "y": 0, "w": 230, "h": 144,
  "label": "Front Door",
  "entity": "camera.front_door",
  "preview": "snapshot",
  "refresh_interval": 5
}
```

### Poster grid with separate snapshot and stream entities

```json
{
  "id": "backyard",
  "type": "camera",
  "x": 0, "y": 150, "w": 230, "h": 144,
  "label": "Backyard",
  "entity": "camera.backyard",
  "snapshot_entity": "camera.backyard_snapshots_fluent",
  "stream_entity": "camera.backyard_fluent",
  "preview": "poster",
  "refresh_interval": 30,
  "fit": "cover"
}
```

### Reolink direct URL snapshot

```json
{
  "id": "garage",
  "type": "camera",
  "x": 240, "y": 0, "w": 230, "h": 144,
  "label": "Garage",
  "preview": "url",
  "url": "http://192.168.1.50/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=abc&user=admin&password=password",
  "refresh_interval": 5,
  "entity": "camera.garage",
  "fit": "cover"
}
```
