import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private gw = environment.apiGatewayUrl;
  private ml = environment.mlApiUrl;

  constructor(private http: HttpClient) {}

  // ─── Devices ────────────────────────────────────────────────────────────────
  getDevices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.gw}/devices`);
  }

  createDevice(deviceId: string, type: string, simulated = false, latitude?: number | null, longitude?: number | null): Observable<any> {
    return this.http.post(`${this.gw}/devices`, { deviceId, type, simulated, latitude, longitude });
  }

  deleteDevice(id: string): Observable<any> {
    return this.http.delete(`${this.gw}/devices/${id}`);
  }

  setSimulated(deviceId: string, simulated: boolean): Observable<any> {
    return this.http.patch(`${this.gw}/devices/${deviceId}/simulate`, { simulated });
  }

  updateDeviceLocation(deviceId: string, latitude: number | null, longitude: number | null): Observable<any> {
    return this.http.patch(`${this.gw}/devices/${deviceId}/location`, { latitude, longitude });
  }

  // ─── Map ─────────────────────────────────────────────────────────────────────
  getDevicesForMap(): Observable<any[]> {
    return this.http.get<any[]>(`${this.gw}/devices/map`);
  }

  getAreas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.gw}/areas`);
  }

  createArea(name: string, polygon: number[][]): Observable<any> {
    return this.http.post(`${this.gw}/areas`, { name, polygon });
  }

  deleteArea(id: string): Observable<any> {
    return this.http.delete(`${this.gw}/areas/${id}`);
  }

  updateAreaPolygon(id: string, name: string, polygon: number[][]): Observable<any> {
    return this.http.patch(`${this.gw}/areas/${id}/polygon`, { name, polygon });
  }

  assignDeviceToArea(areaId: string, deviceId: string): Observable<any> {
    return this.http.post(`${this.gw}/areas/${areaId}/devices/${deviceId}`, {});
  }

  // ─── Telemetry ───────────────────────────────────────────────────────────────
  sendTelemetry(deviceId: string, temperature: number, humidity: number, vibration: number): Observable<any> {
    return this.http.post(`${this.gw}/telemetry`, {
      deviceId,
      payload: { temperature, humidity, vibration }
    });
  }

  // ─── Alerts ──────────────────────────────────────────────────────────────────
  getAlerts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.gw}/alerts`);
  }

  acknowledgeAlert(id: string): Observable<any> {
    return this.http.put(`${this.gw}/alerts/${id}/acknowledge`, {});
  }

  acknowledgeAllAlerts(): Observable<{ acknowledged: number }> {
    return this.http.put<{ acknowledged: number }>(`${this.gw}/alerts/acknowledge-all`, {});
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────
  getDeviceStats(deviceId: string): Observable<any> {
    return this.http.get(`${this.gw}/analytics/stats/${deviceId}`);
  }

  getDeviceHistory(deviceId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.gw}/analytics/history/${deviceId}`);
  }

  // ─── Rules ───────────────────────────────────────────────────────────────────
  getTemperatureRule(): Observable<any> {
    return this.http.get(`${this.gw}/rules/temperature`);
  }

  setTemperatureRule(threshold: number): Observable<any> {
    return this.http.post(`${this.gw}/rules/temperature`, { threshold });
  }

  // ─── ML Platform ─────────────────────────────────────────────────────────────
  getMlStats(): Observable<any> {
    return this.http.get(`${this.ml}/stats`);
  }

  trainModel(): Observable<any> {
    return this.http.post(`${this.ml}/train`, {});
  }

  predict(deviceId: string, temperature: number, humidity: number, vibration: number): Observable<any> {
    return this.http.post(`${this.ml}/predict`, {
      deviceId,
      timestamp: new Date().toISOString(),
      enrichedData: { temperature, humidity, vibration }
    });
  }

  getMlHealth(): Observable<any> {
    return this.http.get(`${this.ml}/health`);
  }

  getMlAnomalyStats(): Observable<any> {
    return this.http.get(`${this.ml}/anomaly-stats`);
  }

  getAutoTrainConfig(): Observable<any> {
    return this.http.get(`${this.ml}/autotrain`);
  }

  setAutoTrainConfig(enabled: boolean, intervalHours: number): Observable<any> {
    return this.http.post(`${this.ml}/autotrain`, { enabled, interval_hours: intervalHours });
  }

  // ─── Gateway Health ───────────────────────────────────────────────────────────
  getGatewayHealth(): Observable<any> {
    return this.http.get(`${environment.apiGatewayUrl.replace('/api/v1', '')}/actuator/health`);
  }

  getDiscoveryHealth(): Observable<any> {
    return this.http.get(`${environment.apiGatewayUrl}/discovery/health`);
  }
}
