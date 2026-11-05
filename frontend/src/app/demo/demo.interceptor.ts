import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

/**
 * In-memory fake backend used by the static demo build (GitHub Pages).
 * It mimics the gateway + ML API contracts so the real UI runs with no servers.
 */

const SEV = ['CRITICAL', 'HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
let seed = 7;
const srand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const now = Date.now();
const types = ['TEMPERATURE', 'HUMIDITY', 'VIBRATION', 'MULTI_SENSOR'];
const spots: [string, number, number][] = [
  ['sensor-atocha-01', 40.4066, -3.6892], ['sensor-retiro-02', 40.4153, -3.6844],
  ['sensor-sol-03', 40.4169, -3.7035], ['pump-chamartin-04', 40.4722, -3.6826],
  ['hvac-azca-05', 40.4504, -3.6935], ['turbine-getafe-06', 40.3083, -3.7327],
  ['sensor-vallecas-07', 40.3790, -3.6020], ['boiler-leganes-08', 40.3272, -3.7635],
  ['sensor-alcala-09', 40.4820, -3.3630], ['motor-coslada-10', 40.4237, -3.5613],
  ['sensor-pozuelo-11', 40.4348, -3.8138], ['cooler-mostoles-12', 40.3223, -3.8649],
];

let devices: any[] = spots.map(([deviceId, latitude, longitude], i) => ({
  id: String(i + 1), createdAt: new Date(now - (i + 3) * 86_400_000).toISOString(), deviceId, type: types[i % 4], status: i === 7 ? 'INACTIVE' : 'ACTIVE',
  simulated: i % 3 !== 0, latitude, longitude,
  lastSeen: i === 7 ? now - 3_600_000 : now - Math.floor(rnd(2, 70)) * 1000,
}));

let alerts: any[] = Array.from({ length: 34 }, (_, i) => {
  const dev = devices[Math.floor(srand() * devices.length)];
  const sev = SEV[Math.floor(srand() * SEV.length)];
  const temp = (sev === 'CRITICAL' ? 112 : sev === 'HIGH' ? 96 : 84) + Math.floor(srand() * 14);
  return {
    id: 'a' + i, deviceId: dev.deviceId, severity: sev,
    message: sev === 'CRITICAL' ? `Temperature ${temp}°C exceeds critical threshold`
      : `Temperature ${temp}°C approaching limit - ML ensemble flagged drift`,
    timestamp: new Date(now - i * 4.5 * 60_000 - srand() * 120_000).toISOString(),
    acknowledged: i > 9 && srand() > 0.35,
  };
});

let areas: any[] = [
  { id: 'ar1', name: 'Downtown Core', polygon: [[40.425, -3.715], [40.425, -3.675], [40.400, -3.675], [40.400, -3.715]], deviceIds: [] },
  { id: 'ar2', name: 'Industrial South', polygon: [[40.340, -3.780], [40.340, -3.690], [40.295, -3.690], [40.295, -3.780]], deviceIds: [] },
];

let threshold = 100;
let autoTrain: any = { enabled: true, interval_hours: 6, last_train_time: (now - 95 * 60_000) / 1000 };
let mlAnomalies = Array.from({ length: 8 }, (_, i) => ({
  device_id: devices[[0, 3, 5, 3, 0, 5, 3, 0][i]].deviceId,
  timestamp: new Date(now - i * 7 * 60_000).toISOString(),
  score: +(0.55 + srand() * 0.4).toFixed(3),
}));
let totalPredictions = 2184;

function history(id: string) {
  let t = 40 + (id.length * 3) % 30, h = 55, v = 0.3;
  return Array.from({ length: 50 }, (_, i) => {
    t += rnd(-2.2, 2.4) + (i > 40 ? 1.6 : 0); h += rnd(-1.5, 1.5); v = Math.max(0.02, v + rnd(-0.08, 0.1));
    return { ts: now - (49 - i) * 6000, temperature: +t.toFixed(1), humidity: +Math.min(95, Math.max(20, h)).toFixed(1), vibration: +v.toFixed(3) };
  }).reverse(); // the API returns newest first
}

function predict(body: any) {
  const d = body?.enrichedData ?? {};
  const t = +d.temperature || 0, h = +d.humidity || 0, v = +d.vibration || 0;
  const z = Math.max(Math.abs(t - 35) / 15, Math.abs(h - 55) / 20, Math.abs(v - 0.3) / 1.5);
  const iso = Math.min(0.99, 0.35 + z * 0.12);
  const isAnomaly = iso > 0.58 || z > 3;
  const score = +Math.min(0.99, iso + (isAnomaly ? 0.12 : 0)).toFixed(4);
  totalPredictions++;
  if (isAnomaly) mlAnomalies = [{ device_id: body.deviceId, timestamp: new Date().toISOString(), score }, ...mlAnomalies].slice(0, 10);
  return {
    device_id: body.deviceId, is_anomaly: isAnomaly, anomaly_score: score,
    severity: !isAnomaly ? 'NORMAL' : z > 6 ? 'CRITICAL' : z > 3.5 ? 'HIGH' : 'LOW',
    scores: { isolation: iso, zscore: z, trend: t > 70 },
    reason: isAnomaly ? `Ensemble vote: isolation ${iso.toFixed(2)}, z-score ${z.toFixed(1)} sigma` : 'Within learned operating envelope',
  };
}

function route(req: HttpRequest<any>): { status: number; body: any; slow?: number } {
  const path = req.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const m = req.method;
  let x: RegExpMatchArray | null;

  if (path.endsWith('/auth/login')) return { status: 200, body: { token: 'demo-token', username: 'admin', roles: ['ROLE_ADMIN'] } };
  if (path.endsWith('/actuator/health')) return { status: 200, body: { status: 'UP', components: { diskSpace: { status: 'UP' }, ping: { status: 'UP' }, redis: { status: 'UP' } } } };
  if (path.endsWith('/discovery/health')) return { status: 200, body: { status: 'UP', components: { discoveryComposite: { status: 'UP', components: { discoveryClient: { status: 'UP', details: { services: ['gateway-service', 'auth-service', 'device-service', 'ingestion-service', 'processing-service', 'alert-service', 'analytics-service', 'notification-service'] } } } } } } };
  if (path.endsWith('/ml/health')) return { status: 200, body: { status: 'healthy', model_loaded: true, consumer: 'running' } };

  if (path.endsWith('/devices/map')) return { status: 200, body: devices.map(d => ({ deviceId: d.deviceId, type: d.type, status: d.status, latitude: d.latitude, longitude: d.longitude })) };
  if ((x = path.match(/\/devices\/([^/]+)\/location$/)) && m === 'PATCH') {
    const d = devices.find(v => v.deviceId === x![1]); if (d) { d.latitude = req.body.latitude; d.longitude = req.body.longitude; } return { status: 200, body: d };
  }
  if ((x = path.match(/\/devices\/([^/]+)\/simulate$/)) && m === 'PATCH') {
    const d = devices.find(v => v.deviceId === x![1]); if (d) d.simulated = !!req.body.simulated; return { status: 200, body: d };
  }
  if ((x = path.match(/\/devices\/([^/]+)$/)) && m === 'DELETE') { devices = devices.filter(d => d.deviceId !== x![1]); return { status: 200, body: {} }; }
  if (path.endsWith('/devices') && m === 'POST') {
    const b = req.body;
    const d = { id: String(Date.now()), createdAt: new Date().toISOString(), deviceId: b.deviceId, type: b.type, status: 'ACTIVE', simulated: !!b.simulated, latitude: b.latitude ?? null, longitude: b.longitude ?? null, lastSeen: null };
    devices = [d, ...devices]; return { status: 201, body: d };
  }
  if (path.endsWith('/devices')) {
    devices.filter(d => d.status === 'ACTIVE' && d.simulated).forEach(d => d.lastSeen = Date.now() - Math.floor(rnd(1, 40)) * 1000);
    return { status: 200, body: devices };
  }

  if (path.match(/\/areas\/[^/]+\/devices\/[^/]+$/) && m === 'POST') return { status: 200, body: {} };
  if ((x = path.match(/\/areas\/([^/]+)\/polygon$/)) && m === 'PATCH') { const a = areas.find(v => v.id === x![1]); if (a) { a.name = req.body.name; a.polygon = req.body.polygon; } return { status: 200, body: a }; }
  if ((x = path.match(/\/areas\/([^/]+)$/)) && m === 'DELETE') { areas = areas.filter(a => a.id !== x![1]); return { status: 200, body: {} }; }
  if (path.endsWith('/areas') && m === 'POST') { const a = { id: 'ar' + Date.now(), name: req.body.name, polygon: req.body.polygon, deviceIds: [] }; areas = [...areas, a]; return { status: 201, body: a }; }
  if (path.endsWith('/areas')) return { status: 200, body: areas };

  if (path.endsWith('/telemetry') && m === 'POST') return { status: 202, body: { status: 'accepted' } };

  if (path.endsWith('/alerts/acknowledge-all')) { const n = alerts.filter(a => !a.acknowledged).length; alerts.forEach(a => a.acknowledged = true); return { status: 200, body: { acknowledged: n } }; }
  if ((x = path.match(/\/alerts\/([^/]+)\/acknowledge$/))) { const a = alerts.find(v => v.id === x![1]); if (a) a.acknowledged = true; return { status: 200, body: a }; }
  if (path.endsWith('/alerts')) return { status: 200, body: alerts };

  if ((x = path.match(/\/analytics\/stats\/([^/]+)$/))) return { status: 200, body: { deviceId: x[1], eventCount: 120 + (x[1].length * 137 + x[1].charCodeAt(x[1].length - 1) * 11) % 900, lastSeen: devices.find(d => d.deviceId === x![1])?.lastSeen ?? null } };
  if ((x = path.match(/\/analytics\/history\/([^/]+)$/))) return { status: 200, body: history(x[1]) };

  if (path.endsWith('/rules/temperature')) { if (m === 'POST') threshold = +req.body.threshold; return { status: 200, body: threshold }; }

  if (path.endsWith('/anomaly-stats')) {
    const by: Record<string, number> = {}; mlAnomalies.forEach(a => by[a.device_id] = (by[a.device_id] || 0) + 1);
    return { status: 200, body: { total_predictions: totalPredictions, anomaly_count: 142 + mlAnomalies.length, anomaly_rate: 6.7, recent_anomalies: mlAnomalies, anomalies_by_device: by } };
  }
  if (path.endsWith('/autotrain')) {
    if (m === 'POST') { autoTrain = { ...autoTrain, enabled: req.body.enabled, interval_hours: req.body.interval_hours }; return { status: 200, body: { config: autoTrain } }; }
    return { status: 200, body: autoTrain };
  }
  if (path.endsWith('/train')) { autoTrain.last_train_time = Date.now() / 1000; return { status: 200, body: { status: 'success', message: 'Model retrained successfully (demo).', threshold: 0.5871, model_version: 'v' + Date.now() }, slow: 1600 }; }
  if (path.endsWith('/predict')) return { status: 200, body: predict(req.body), slow: 450 };
  if (path.endsWith('/stats')) return { status: 200, body: { total_events: 1000, devices: devices.map(d => d.deviceId), latest_timestamp: Date.now() / 1000 } };

  return { status: 404, body: { message: 'Not found (demo)' } };
}

export const demoInterceptor = (req: HttpRequest<any>, _next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const r = route(req);
  if (r.status >= 400) {
    return new Observable<HttpEvent<any>>(sub => { setTimeout(() => sub.error({ status: r.status, error: r.body }), 120); });
  }
  return of(new HttpResponse({ status: r.status, body: r.body })).pipe(delay(r.slow ?? 120 + Math.random() * 180));
};
