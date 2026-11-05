# Changelog

## 1.0.0 — 2026-11-05

First stable release.

### Added
- **Interactive demo**: backend-less build (`npm run build:demo`) driven by an in-browser mock API, published on GitHub Pages together with a project landing page.
- **Dark-first redesign** of the dashboard (new design tokens, Space Grotesk / JetBrains Mono, glass cards, animated login), light theme still available.
- Dark-mode map (inverted OSM tiles, no API key) and automatic zoom-to-devices on load.
- Deep links to dashboard sections via URL hash (`#map`, `#ml`, …).
- Gateway authorization: rule updates and device/area deletion require `ROLE_ADMIN`.
- ML service: training lock (HTTP 409 on concurrent training) and self-restarting Kafka consumer with backoff.

- **PulseIoT logo** (pulse line with an anomaly marker): app sidebar, login, favicon, landing page, README and a social-preview image. Sources in `docs/brand/`.

### Security
- Secrets moved out of `docker-compose.yml` into `.env` (see `.env.example`); compose fails fast when missing.
- Bootstrap admin credentials configurable (`ADMIN_USERNAME` / `ADMIN_PASSWORD`); login page only shows demo credentials in demo mode.
- ML API now validates the gateway's JWT (`/predict*` any user, `/train` and `POST /autotrain` admin) and CORS is restricted.
- alert-service is idempotent: redelivered Kafka events no longer create duplicate alerts (alert + idempotency record in one transaction).

### Reliability
- device-service and alert-service Flyway baseline at version 0, so their V1 migrations are not skipped when another service created tables in the shared schema first.
- processing-service claims the event in `idempotency_records` *before* publishing and handles concurrent-redelivery collisions.
- ML prediction history, auto-retrain config and last train time are persisted to `ml/models/state.json` and restored on restart.

### Data integrity
- `PATCH /devices/{id}/location` now validates input (both coordinates or neither, latitude -90..90, longitude -180..180) and returns HTTP 400 instead of storing a half-null or impossible location.
- Analytics history only records sensors that were actually reported; the dashboard no longer plots a missing reading as 0.
- Spark streaming fails the micro-batch (so it is retried from the checkpoint) when Kafka delivery fails, instead of silently dropping events; the checkpoint now lives on a named volume so it survives container recreation.

### Performance
- ML `/predict` went from ~3 s to ~25 ms (first call per device after a restart ~1 s): the data lake keeps the last rows per device in memory, lists Parquet files without `stat`-ing all of them and reads them concurrently. `/stats` cold: 6 s to 2 s.

### Fixed
- "Acknowledge all" on the Alerts page fired one request per alert and tripped the gateway rate limiter (HTTP 429, most alerts stayed pending). It now calls a single `PUT /api/v1/alerts/acknowledge-all`.
- Expired/invalid JWT (HTTP 401) now signs the user out instead of leaving a broken dashboard.
- "Critical" KPI now counts `CRITICAL` as well as `HIGH` alerts.
- Dashboard "devices" chart showed a constant value per device; it now shows alerts per device.
- Missing `favicon.ico` caused a 404 on every page load; the app now ships an inline SVG icon.
- Devices table no longer clips the Actions column on narrower screens.

### Changed
- All Maven modules, the frontend and docs are versioned `1.0.0`.
- Repository history squashed to a single clean release commit; only `main`, `develop` and `gh-pages` branches remain.
