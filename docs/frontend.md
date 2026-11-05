# Frontend

Angular 17 dashboard at `http://localhost:4200`. Built as a single-page application using standalone components — no Angular Router. Navigation is handled entirely through conditional rendering in `app.component.ts`.

## Tech stack

| Package | Purpose |
|---------|---------|
| Angular 17 | Framework (standalone components, no NgModules) |
| Angular Material | UI primitives (icons, spinners, snackbar, tooltip, ripple) |
| ngx-charts | Charts (pie, bar-vertical, line) |
| RxJS | Async data, polling intervals, forkJoin |
| Leaflet + leaflet-draw | Interactive map, polygon drawing/editing |
| leaflet.heat | Heatmap overlay driven by ML anomaly scores |

## Project structure

```
frontend/src/app/
├── app.component.ts          # Shell: sidebar, topbar, auth gate, routing state, notification bell
├── components/
│   ├── login.component.ts    # Auth page
│   ├── dashboard.component.ts
│   ├── devices.component.ts  # CRUD + GPS location picker
│   ├── telemetry.component.ts
│   ├── alerts.component.ts
│   ├── analytics.component.ts
│   ├── ml.component.ts
│   ├── health.component.ts
│   └── map.component.ts      # Leaflet map, area management, heatmap
└── services/
    ├── api.service.ts        # All HTTP calls to gateway (8080) and ML API (8000)
    ├── auth.service.ts       # JWT lifecycle, localStorage, BehaviorSubject
    └── telemetry.service.ts
```

## Design system

Brand assets live in `docs/brand/` (`logo.svg`, `logo-wordmark.svg`, `social-preview.png`); the app serves the mark from `src/assets/logo.svg` (sidebar, login, favicon).

Dark-first "control center" theme (light theme available via the toggle). All colors, radii and shadows are CSS custom properties defined in `src/styles.css` (`--indigo` is the accent token — historical name, now cyan). Fonts: Space Grotesk (headings/numbers), Inter (body), JetBrains Mono (IDs/timestamps). Leaflet tiles are inverted with a CSS filter in dark mode, so no tile-provider API key is needed.

## Demo mode (static build)

`ng build --configuration demo` swaps `environment.ts` for `environment.demo.ts` (`demo: true`). In that mode `main.ts` registers `demoInterceptor` (`src/app/demo/demo.interceptor.ts`) instead of the auth interceptor: every HTTP call is answered from an in-memory dataset (devices around Madrid, alerts, ML stats, areas) and mutations (register device, acknowledge alert, retrain, predict…) update that state. `AuthService` starts signed-in. This is what the GitHub Pages demo serves.

## Navigation model

`AppComponent` maintains an `active: Section` string. Each component is conditionally rendered with `*ngIf="active === 'section'"`. The URL hash mirrors the active section (`#map`, `#ml`, …) so sections can be deep-linked; there is no Angular Router. The 8 sections are:

| Section | Icon |
|---------|------|
| dashboard | dashboard |
| devices | router |
| telemetry | sensors |
| alerts | notifications_active |
| analytics | bar_chart |
| ml | psychology |
| health | monitor_heart |
| map | map |

The sidebar collapses to icon-only mode; state is persisted in `localStorage` (`iot_sidebar_col`). Dark mode is toggled via `document.body.classList.toggle('dark-mode')` and persisted in `localStorage` (`iot_dark`).

The alert badge on the sidebar nav item shows unacknowledged alert count, polled every 30 seconds.

## Topbar — Notification Bell

The topbar includes a notification bell icon with:
- A red badge showing the count of pending (unacknowledged) CRITICAL alerts
- A dropdown panel listing the most recent pending critical alerts (device, message, timestamp)
- Auto-refreshes every 30 seconds alongside the sidebar badge poll

## Services

### AuthService

- `login(username, password)` — posts to `/api/v1/auth/login`, stores JWT in `localStorage`
- `logout()` — clears localStorage, resets BehaviorSubject
- `isAuthenticated()` — checks localStorage for a token
- `getToken()` — returns raw JWT string

### ApiService

All requests include `Authorization: Bearer <token>` from `AuthService`. Base URLs come from `environment.ts`, constructed dynamically from `window.location.hostname`:
- Gateway: `<protocol>//<hostname>:8080/api/v1`
- ML API: `<protocol>//<hostname>:8000`

Key methods:

| Method | Endpoint |
|--------|---------|
| `getDevices()` | GET /devices |
| `createDevice(id, type, simulated, lat?, lng?)` | POST /devices |
| `deleteDevice(id)` | DELETE /devices/{id} |
| `setSimulated(deviceId, simulated)` | PATCH /devices/{deviceId}/simulate |
| `updateDeviceLocation(deviceId, lat, lng)` | PATCH /devices/{deviceId}/location |
| `getDevicesForMap()` | GET /devices/map |
| `sendTelemetry(deviceId, temp, hum, vib)` | POST /telemetry |
| `getAlerts()` | GET /alerts |
| `acknowledgeAlert(id)` | PUT /alerts/{id}/acknowledge |
| `getDeviceStats(deviceId)` | GET /analytics/stats/{deviceId} |
| `getDeviceHistory(deviceId)` | GET /analytics/history/{deviceId} |
| `getTemperatureRule()` | GET /rules/temperature |
| `setTemperatureRule(threshold)` | POST /rules/temperature |
| `getAreas()` | GET /areas |
| `createArea(name, polygon)` | POST /areas |
| `deleteArea(id)` | DELETE /areas/{id} |
| `updateAreaPolygon(id, name, polygon)` | PATCH /areas/{id}/polygon |
| `assignDeviceToArea(areaId, deviceId)` | POST /areas/{areaId}/devices/{deviceId} |
| `getMlStats()` | GET http://…:8000/stats |
| `getMlHealth()` | GET http://…:8000/health |
| `getMlAnomalyStats()` | GET http://…:8000/anomaly-stats |
| `getAutoTrainConfig()` | GET http://…:8000/autotrain |
| `setAutoTrainConfig(enabled, hours)` | POST http://…:8000/autotrain |
| `predict(deviceId, temp, hum, vib)` | POST http://…:8000/predict |
| `trainModel()` | POST http://…:8000/train |
| `getGatewayHealth()` | GET /actuator/health (via gateway) |
| `getDiscoveryHealth()` | GET http://…:8761/actuator/health |

## Components

### LoginComponent

Split-panel layout: dark branding panel on the left (hidden on mobile), login form on the right. Submits to `AuthService.login()`. Shows error inline on failure. The demo-credentials hint is shown only in the static demo build; the real app uses the credentials from `.env`.

### DashboardComponent

Auto-refreshes every 15 seconds via `interval(15000)`. KPIs:
- Device count, total alerts, pending alerts, critical alerts
- ML events processed, ML platform online/offline

Charts:
- ngx-charts pie — alert severity distribution (CRITICAL/HIGH/MEDIUM/LOW)
- ngx-charts bar-vertical — event count per registered device

Recent alerts section: last 8 alerts sorted by timestamp descending.

"Retrain ML" button — calls `POST /train`, shows snackbar on result.

### DevicesComponent

Displays all registered devices in a searchable table (client-side filter by deviceId, type, status). Columns: Device ID, Type, Status, **Online/Offline badge**, Simulated toggle, **GPS**, **Last Seen**, Registered, Actions.

**Online/Offline badge**: derived from `lastSeen` epoch ms returned by `GET /analytics/stats/{deviceId}`. A device is considered online if `lastSeen` is within the last 2 minutes; offline (or never seen) otherwise. Badge updates on each table load.

**Last Seen column**: shows the timestamp of the last received telemetry or "—" if none.

**GPS column**: shows `lat, lng` if set, or a "No GPS" badge. Two action buttons per row:
- `add_location` / `edit_location` — opens the **location picker modal**
- `location_off` — clears GPS with a confirmation dialog

**Location picker modal**: a 320 px mini Leaflet/OpenStreetMap map. Click anywhere to place a pin; the marker is draggable for fine-tuning. Displays picked coordinates below the map. Save calls `PATCH /devices/{id}/location`. "Clear GPS" button appears when editing a device that already has coordinates.

Register form (collapsible): Device ID + Type dropdown (TEMPERATURE / HUMIDITY / VIBRATION / MULTI_SENSOR) + optional **Latitude** / **Longitude** inputs with a "Pick on map" button that opens the same location picker pre-wired to write back to the form fields.

Per-row actions:
- **Send telemetry** — opens a modal with temperature/humidity/vibration inputs. Includes quick presets: Normal (22°C / 55% / 0.01 m/s²), Warning (75°C / 85% / 3.5 m/s²), Critical (115°C / 95% / 8.0 m/s²). Visual feedback when temperature crosses warning (>80°C) or critical (>100°C) thresholds.
- **Delete** — requires confirmation.

### TelemetryComponent

Device selector dropdown (loaded from `getDevices()`). Three sensor controls — each with a slider and a numeric input:
- Temperature: -20 to 150°C
- Humidity: 0 to 100%
- Vibration: 0 to 15 m/s²

Quick presets same as the modal in DevicesComponent. Session history panel on the right: last 20 submissions with success/failure state, device, timestamp, and values sent.

### AlertsComponent

Auto-refreshes every 10 seconds via `interval(10000)`. Filters:
- Severity cards (CRITICAL / HIGH / MEDIUM / LOW) — click to filter, click again to clear
- Status pills: All / Pending / Acknowledged

Acknowledge All button — calls `acknowledgeAlert` for every unacknowledged alert in parallel. Unacknowledged count shown as badge next to the page heading.

**Export CSV** — downloads all currently visible alerts as a CSV file with columns: ID, Device, Severity, Status, Message, Timestamp.

**Alert Rules panel** — a collapsible side panel showing the current temperature threshold. Editable inline: enter a new value and click Save. Calls `POST /rules/temperature`. Changes take effect immediately in the processing pipeline without restarting any service.

### AnalyticsComponent

Loads all registered devices on init, then calls `getDeviceStats()` for each in parallel via `forkJoin`. Displays:
- Bar chart (ngx-charts bar-vertical): event count per device
- Stats table: rank, device ID (clickable to select), total events, share % with a progress bar

**Telemetry History line chart** — clicking a device loads its history via `GET /analytics/history/{deviceId}` and renders a line chart with three tabs: Temperature, Humidity, Vibration. Each tab shows the last 50 readings over time. The chart uses the `ts` epoch ms field as the x-axis.

Clicking a device ID in the table selects it and loads its individual KPI (deviceId + event count).

### MlComponent

**Anomaly Stats KPIs** (from `GET /anomaly-stats`):
- Total predictions processed
- Anomaly count and anomaly rate (%)
- Number of affected devices
- Most anomalous device

**Recent anomalies list** — shows the 10 most recent anomalous predictions from the in-memory history: device ID, timestamp, and anomaly score.

**Prediction panel**: enter device ID + sensor values, choose Normal or Anomalous preset, call `POST /predict`. Result shows `is_anomaly`, `anomaly_score`, and `prediction` label with color-coded styling.

**Training panel**: "Retrain Model" button calls `POST /train`. Shows a 4-step training pipeline description (reads Parquet → fits IsolationForest → saves model → predictions available). Displays training result or error message.

**Auto-retrain toggle** — a slide toggle that enables/disables automatic background retraining. When enabled, an interval input (in hours) sets how often to retrain. Calls `POST /autotrain`. The current config is loaded on component init from `GET /autotrain`.

### HealthComponent

Checks 3 endpoints on init and on each "Refresh All":
- API Gateway: `/actuator/health`
- ML Platform: `/health`
- Discovery Service: `/actuator/health`

Overall status banner (all-up green / partial amber). Service cards show status, URL, last checked time. Gateway card expands to show Spring Boot actuator component breakdown. ML card shows `model_loaded` flag. Architecture flow diagram at the bottom.

### MapComponent

Full-screen interactive map using **Leaflet + OpenStreetMap** (free/OSS, no API key required).

**Device markers** — one circle per device with GPS coordinates:

| Colour | Meaning |
|--------|---------|
| Green | ACTIVE + no anomaly |
| Yellow | ACTIVE + anomaly score > 0.3 |
| Red | ACTIVE + is_anomaly |
| Gray | Offline / INACTIVE |
| Blue | No GPS coordinates |

Devices without GPS are not rendered on the map but counted in the stats chip ("X without GPS").

**Popups** — click a marker to see device ID, status, anomaly badge, area name, anomaly score. Temperature is lazy-loaded on first popup open from `GET /analytics/history/{deviceId}` and cached in-memory for the session.

**Area management** (left panel + map controls):
- Draw new polygons using the Leaflet.draw toolbar → enter a name → Save (`POST /areas`)
- Edit existing polygons with the edit toolbar → auto-saved on confirmation (`PATCH /areas/{id}/polygon`)
- Delete area via the trash icon in the left panel (with confirmation dialog, `DELETE /areas/{id}`)
- Areas containing anomaly devices render in **red** with a "⚠ anomalies detected" tooltip

**Heatmap** — toggle to overlay a temperature heatmap. Intensity is driven by the device's ML anomaly score (0.15 baseline, scales up to 1.0 for full anomalies).

**Filters** — filter visible markers by area membership or severity (normal / anomaly).

**Stats chips** — total devices, anomaly count, area count, no-GPS count (updates with active filters).

**Implementation notes**:
- Leaflet popup CSS lives in global `styles.css` (not the component stylesheet) because Leaflet injects popup HTML outside Angular's view encapsulation
- `draw:edited` event handler identifies each edited polygon via `(layer as any).areaId` set at render time
- Area polygons are stored as JSON text in PostgreSQL via a `PolygonConverter` JPA `AttributeConverter`
- Temperature popup uses an `<span id="pop-temp-{deviceId}">` placeholder updated via `document.getElementById` after async fetch
