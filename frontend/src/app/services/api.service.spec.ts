import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Devices ────────────────────────────────────────────────────────────────

  it('getDevices() should GET /devices', () => {
    service.getDevices().subscribe(devices => expect(devices.length).toBe(1));
    const req = http.expectOne(r => r.url.includes('/devices') && r.method === 'GET');
    req.flush([{ deviceId: 'sensor-01' }]);
  });

  it('createDevice() should POST /devices', () => {
    service.createDevice('sensor-01', 'TEMPERATURE', true).subscribe();
    const req = http.expectOne(r => r.url.includes('/devices') && r.method === 'POST');
    expect(req.request.body).toEqual({ deviceId: 'sensor-01', type: 'TEMPERATURE', simulated: true, latitude: undefined, longitude: undefined });
    req.flush({ deviceId: 'sensor-01' });
  });

  it('deleteDevice() should DELETE /devices/:id', () => {
    service.deleteDevice('sensor-01').subscribe();
    const req = http.expectOne(r => r.url.includes('/devices/sensor-01') && r.method === 'DELETE');
    req.flush({});
  });

  it('setSimulated() should PATCH /devices/:id/simulate', () => {
    service.setSimulated('sensor-01', true).subscribe();
    const req = http.expectOne(r => r.url.includes('/simulate') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ simulated: true });
    req.flush({ simulated: true });
  });

  // ── Telemetry ───────────────────────────────────────────────────────────────

  it('sendTelemetry() should POST /telemetry with correct payload', () => {
    service.sendTelemetry('sensor-01', 25.5, 60, 0.02).subscribe();
    const req = http.expectOne(r => r.url.includes('/telemetry') && r.method === 'POST');
    expect(req.request.body).toEqual({
      deviceId: 'sensor-01',
      payload: { temperature: 25.5, humidity: 60, vibration: 0.02 }
    });
    req.flush({});
  });

  // ── Alerts ──────────────────────────────────────────────────────────────────

  it('getAlerts() should GET /alerts', () => {
    service.getAlerts().subscribe(alerts => expect(Array.isArray(alerts)).toBeTrue());
    http.expectOne(r => r.url.includes('/alerts') && r.method === 'GET').flush([]);
  });

  it('acknowledgeAlert() should PUT /alerts/:id/acknowledge', () => {
    service.acknowledgeAlert('alert-42').subscribe();
    const req = http.expectOne(r => r.url.includes('/alerts/alert-42/acknowledge') && r.method === 'PUT');
    req.flush({});
  });

  // ── Analytics ───────────────────────────────────────────────────────────────

  it('getDeviceStats() should GET /analytics/stats/:id', () => {
    service.getDeviceStats('sensor-01').subscribe();
    http.expectOne(r => r.url.includes('/analytics/stats/sensor-01') && r.method === 'GET').flush({});
  });

  it('getDeviceHistory() should GET /analytics/history/:id', () => {
    service.getDeviceHistory('sensor-01').subscribe();
    http.expectOne(r => r.url.includes('/analytics/history/sensor-01') && r.method === 'GET').flush([]);
  });

  // ── Rules ────────────────────────────────────────────────────────────────────

  it('getTemperatureRule() should GET /rules/temperature', () => {
    service.getTemperatureRule().subscribe();
    http.expectOne(r => r.url.includes('/rules/temperature') && r.method === 'GET').flush(100);
  });

  it('setTemperatureRule() should POST /rules/temperature with threshold', () => {
    service.setTemperatureRule(90).subscribe();
    const req = http.expectOne(r => r.url.includes('/rules/temperature') && r.method === 'POST');
    expect(req.request.body).toEqual({ threshold: 90 });
    req.flush({});
  });

  // ── ML ───────────────────────────────────────────────────────────────────────

  it('getMlStats() should GET /stats', () => {
    service.getMlStats().subscribe();
    http.expectOne(r => r.url.includes('/stats') && r.method === 'GET').flush({});
  });

  it('trainModel() should POST /train', () => {
    service.trainModel().subscribe();
    http.expectOne(r => r.url.includes('/train') && r.method === 'POST').flush({});
  });

  it('predict() should POST /predict with enrichedData', () => {
    service.predict('sensor-01', 95, 10, 8).subscribe();
    const req = http.expectOne(r => r.url.includes('/predict') && r.method === 'POST');
    expect(req.request.body.deviceId).toBe('sensor-01');
    expect(req.request.body.enrichedData).toEqual({ temperature: 95, humidity: 10, vibration: 8 });
    req.flush({ is_anomaly: true });
  });

  it('getMlHealth() should GET /health', () => {
    service.getMlHealth().subscribe();
    http.expectOne(r => r.url.includes('/health') && r.method === 'GET').flush({ status: 'UP' });
  });

  it('getMlAnomalyStats() should GET /anomaly-stats', () => {
    service.getMlAnomalyStats().subscribe();
    http.expectOne(r => r.url.includes('/anomaly-stats') && r.method === 'GET').flush({});
  });

  it('getAutoTrainConfig() should GET /autotrain', () => {
    service.getAutoTrainConfig().subscribe();
    http.expectOne(r => r.url.includes('/autotrain') && r.method === 'GET').flush({});
  });

  it('setAutoTrainConfig() should POST /autotrain', () => {
    service.setAutoTrainConfig(true, 4).subscribe();
    const req = http.expectOne(r => r.url.includes('/autotrain') && r.method === 'POST');
    expect(req.request.body).toEqual({ enabled: true, interval_hours: 4 });
    req.flush({});
  });

  // ── Map ───────────────────────────────────────────────────────────────────────

  it('getDevicesForMap() should GET /devices/map', () => {
    service.getDevicesForMap().subscribe();
    http.expectOne(r => r.url.includes('/devices/map') && r.method === 'GET').flush([]);
  });

  it('getAreas() should GET /areas', () => {
    service.getAreas().subscribe();
    http.expectOne(r => r.url.includes('/areas') && r.method === 'GET').flush([]);
  });

  it('createArea() should POST /areas', () => {
    service.createArea('Zone A', [[40.0, -3.0]]).subscribe();
    const req = http.expectOne(r => r.url.includes('/areas') && r.method === 'POST');
    expect(req.request.body).toEqual({ name: 'Zone A', polygon: [[40.0, -3.0]] });
    req.flush({});
  });

  it('deleteArea() should DELETE /areas/:id', () => {
    service.deleteArea('area-1').subscribe();
    http.expectOne(r => r.url.includes('/areas/area-1') && r.method === 'DELETE').flush({});
  });

  it('updateAreaPolygon() should PATCH /areas/:id/polygon', () => {
    service.updateAreaPolygon('area-1', 'Zone A', [[40.0, -3.0]]).subscribe();
    const req = http.expectOne(r => r.url.includes('/areas/area-1/polygon') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ name: 'Zone A', polygon: [[40.0, -3.0]] });
    req.flush({});
  });

  it('assignDeviceToArea() should POST /areas/:areaId/devices/:deviceId', () => {
    service.assignDeviceToArea('area-1', 'sensor-01').subscribe();
    http.expectOne(r => r.url.includes('/areas/area-1/devices/sensor-01') && r.method === 'POST').flush({});
  });

  it('updateDeviceLocation() should PATCH /devices/:id/location', () => {
    service.updateDeviceLocation('sensor-01', 40.4, -3.7).subscribe();
    const req = http.expectOne(r => r.url.includes('/devices/sensor-01/location') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ latitude: 40.4, longitude: -3.7 });
    req.flush({});
  });

  // ── Health ────────────────────────────────────────────────────────────────────

  it('getGatewayHealth() should GET /actuator/health', () => {
    service.getGatewayHealth().subscribe();
    http.expectOne(r => r.url.includes('/actuator/health') && r.method === 'GET').flush({ status: 'UP' });
  });

  it('getDiscoveryHealth() should GET discovery /actuator/health', () => {
    service.getDiscoveryHealth().subscribe();
    http.expectOne(r => r.url.includes('/discovery/health') && r.method === 'GET').flush({ status: 'UP' });
  });
});
