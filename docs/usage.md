# Usage

The dashboard runs at `http://localhost:4200` after `docker compose up -d`. All API traffic goes through the gateway at port 8080.

## Login

Credentials: `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env` (copy `.env.example`).

The JWT is stored in `localStorage` and attached to every request. Session persists across page reloads until you log out or clear browser storage.

---

## Dashboard

The landing page. Auto-refreshes every 15 seconds.

**KPIs** — six cards at the top:
- Total registered devices
- Total, pending, and critical alert counts
- ML events processed (from the data lake)
- ML platform status (online / offline)

**Alert severity chart** — pie chart of CRITICAL / HIGH / MEDIUM / LOW distribution.

**Events per device chart** — bar chart showing how many telemetry events each device has generated.

**Recent alerts** — last 8 alerts sorted newest-first, with severity, device, message, and acknowledge status.

**Retrain ML** button — triggers a full model retraining on the current data lake. Takes a few seconds; a snackbar confirms completion.

---

## Devices

Register and manage IoT sensors.

**Register a device** — click "Register Device", enter a Device ID (e.g. `sensor-01`) and choose a type (TEMPERATURE / HUMIDITY / VIBRATION / MULTI_SENSOR). Optionally enter Latitude / Longitude or click **"Pick on map"** to open a mini map and click to place a pin. Click Register.

**Search** — filters the device table by device ID, type, or status in real time.

**Online/Offline badge** — each device row shows a live badge: green "Online" if the device sent telemetry within the last 2 minutes, grey "Offline" otherwise. Derived from the `lastSeen` field returned by the analytics service.

**Last Seen column** — shows the timestamp of the last received telemetry, or "—" if none.

**GPS column** — shows `lat, lng` coordinates if set, or a "No GPS" badge.
- Click the **pin icon** to open the location picker and set / update coordinates
- Click the **location_off icon** (only shown when GPS is set) to clear coordinates

**Location picker** — a mini Leaflet/OpenStreetMap map opens in a dialog. Click anywhere on the map to place a draggable marker. The picked coordinates are shown below the map. Click **Save Location** to persist via `PATCH /devices/{id}/location`. "Clear GPS" removes coordinates from the device.

**Send telemetry** (sensor icon per row) — opens a modal to manually push a reading for that device:
- Adjust temperature, humidity, and vibration values
- Quick presets: **Normal** (22°C / 55% / 0.01 m/s²), **Warning** (75°C / 85% / 3.5 m/s²), **Critical** (115°C / 95% / 8.0 m/s²)
- Temperature >80°C shows a warning indicator; >100°C shows a critical indicator
- Clicking Send pushes the reading to the Kafka ingestion pipeline

**Delete** (trash icon) — confirms and permanently removes the device.

---

## Telemetry

A dedicated page for pushing sensor readings without going through the device table.

Select a registered device from the dropdown. Adjust the three sensor sliders or type values directly. Quick presets work the same as in the Devices modal.

The **Session History** panel on the right records the last 20 submissions for this browser session, showing success/failure, device, timestamp, and values sent.

---

## Alerts

Alerts are generated automatically by the processing pipeline when sensor readings cross configured thresholds.

**Severity filter** — click any of the four severity cards (CRITICAL / HIGH / MEDIUM / LOW) to filter. Click the same card again to clear.

**Status filter** — All / Pending / Acknowledged pills at the top right.

**Acknowledge** — click the check icon on any alert to mark it acknowledged. The badge count in the sidebar nav and the topbar notification bell update automatically.

**Acknowledge All** — acknowledges all currently unacknowledged alerts in one click.

**Export CSV** — downloads all currently visible alerts (respecting active filters) as a CSV file. Columns: ID, Device, Severity, Status, Message, Timestamp.

**Alert Rules panel** — click "Alert Rules" to expand the side panel. Shows the current temperature threshold (default: 100°C). Edit the value and click Save to update the threshold immediately — no service restart needed. Changes apply to the next telemetry event processed:
- Temperature > threshold → CRITICAL → HIGH alert
- Temperature > threshold × 0.8 → WARNING → MEDIUM alert

The page auto-refreshes every 10 seconds. Total and unacknowledged counts are shown in the header.

---

## Analytics

Per-device and comparative event statistics.

On load, the page fetches event counts for all registered devices in parallel. The bar chart and stats table show how events are distributed across devices, including each device's share (%) with a progress bar.

Select a specific device from the dropdown or click its name in the stats table to select it.

**Telemetry History chart** — after selecting a device, click "Load History" to fetch the last 50 telemetry readings. The chart has three tabs:
- **Temperature** — readings in °C over time
- **Humidity** — readings in % over time
- **Vibration** — readings in m/s² over time

The x-axis is the event timestamp. Data comes from the Redis ring-buffer maintained by the analytics service.

---

## ML Platform

Interface for the IsolationForest anomaly detection engine.

**Anomaly Stats KPIs** (from `/anomaly-stats`):
- Total predictions recorded in the session (in-memory, resets on restart)
- Anomaly count and anomaly rate as a percentage
- Number of affected devices

**Recent anomalies list** — the 10 most recent anomalous predictions: device ID, timestamp, and anomaly score. Color-coded by score severity.

**Devices in ML Data Lake** — chip list of device IDs that have data stored in Parquet format.

**Anomaly Prediction** — test the model with a custom input:
1. Enter a Device ID (must have history in the data lake for accurate rolling features)
2. Set temperature, humidity, and vibration values
3. Use **Normal** preset (22°C / 55% / 0.01 m/s²) or **Anomalous** preset (150°C / 99% / 12.0 m/s²) for quick tests
4. Click **Run Prediction** — result shows anomaly score, prediction label, and color-coded outcome

**Model Training** — click **Retrain Model** to trigger a full training run on the Parquet data lake. Training reads up to 10,000 records, fits the Isolation Forest, computes a threshold at the 5th percentile of training scores, and saves the model. The result message confirms completion or reports errors.

**Auto-retrain toggle** — enable automatic periodic retraining:
- Toggle the switch to enable/disable
- Set the interval in hours (e.g. 4 for every 4 hours)
- Click Save — a background daemon thread in the ML service will trigger retraining on the configured schedule
- The current config and last train time are shown below the toggle

---

## Map

Interactive geospatial view of all IoT devices and configured areas.

**Device markers** — one circle per device that has GPS coordinates:
- **Green** — active, no anomaly detected
- **Yellow** — active, anomaly score > 0.3
- **Red** — active, classified as anomaly by ML platform
- **Gray** — offline or inactive
- **Blue** — device has no GPS coordinates (shown as a static chip)

Click any marker to open a popup with device ID, current status, anomaly badge, assigned area, and last temperature reading (loaded on first open, then cached).

**Areas** — coloured polygons drawn on the map. Areas containing anomaly devices turn **red** with a "⚠ anomalies detected" tooltip.
- **Draw** — click "Draw new area" in the top panel, draw a polygon on the map, enter a name, and click Save
- **Edit** — use the pencil toolbar to reshape an existing polygon; changes auto-save when you click the confirm button
- **Delete** — click the trash icon next to an area name in the left panel (with confirmation)

**Heatmap** — toggle "Temperature heatmap" to overlay intensity circles. Intensity is driven by the ML anomaly score (low = 0.15 baseline, high = 1.0 for confirmed anomalies).

**Filters** — filter markers by area or by severity (Normal / Anomaly) using the chips in the top panel.

**Stats chips** — live counts of total devices, anomaly devices, areas, and devices without GPS.

## Notification Bell

The topbar bell icon shows a badge with the count of pending CRITICAL alerts. Clicking it opens a dropdown with the most recent unacknowledged critical alerts (device, message, time). Clicking an alert navigates to the Alerts page. The count auto-refreshes every 30 seconds.

---

## Health

Real-time status of the three health-checked services:
- **API Gateway** (port 8080) — Spring Boot `/actuator/health` with component breakdown
- **ML Platform** (port 8000) — FastAPI `/health` with `model_loaded` flag
- **Discovery Service** (port 8761) — Eureka health endpoint

The top banner shows overall system status. Each service card shows Operational / Unreachable status with a pulsing green dot when healthy, plus the timestamp of the last check.

**Refresh All** re-checks all three simultaneously.

The architecture flow at the bottom shows the high-level data path: Kafka → Gateway → Microservices → ML Platform.

---

## Sidebar

- **Collapse** — click the chevron at the top of the sidebar to switch to icon-only mode. State is saved in `localStorage`.
- **Dark mode** — toggle in the sidebar footer or the topbar icon. Saved in `localStorage`.
- **Logout** — bottom of the sidebar footer. Clears the JWT from `localStorage`.
