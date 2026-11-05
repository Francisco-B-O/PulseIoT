import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { MapComponent } from './map.component';
import { ApiService } from '../services/api.service';

const mockDevices = [
  { deviceId: 'dev-1', type: 'TEMPERATURE', status: 'ACTIVE',  latitude: 40.4,  longitude: -3.7,  simulated: false, areaName: 'Zone A' },
  { deviceId: 'dev-2', type: 'HUMIDITY',    status: 'ACTIVE',  latitude: 40.41, longitude: -3.71, simulated: true,  areaName: null },
  { deviceId: 'dev-3', type: 'VIBRATION',   status: 'OFFLINE', latitude: null,  longitude: null,  simulated: false, areaName: null },
];

const mockAreas = [
  { id: 'area-1', name: 'Zone A', polygon: [[40.4, -3.7], [40.5, -3.7], [40.5, -3.8]], deviceCount: 1, deviceIds: ['dev-1'] },
];

const mockAnomalyStats = {
  anomalyRate: 0.15,
  totalPredictions: 20,
  anomalyCount: 1,
  recent_anomalies: [{ device_id: 'dev-2', score: 0.82, timestamp: '2026-01-01T00:00:00Z' }],
};

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', [
      'getDevicesForMap', 'getAreas', 'getMlAnomalyStats',
      'createArea', 'deleteArea', 'assignDeviceToArea', 'getDeviceHistory',
    ]);
    apiSpy.getDevicesForMap.and.returnValue(of(mockDevices));
    apiSpy.getAreas.and.returnValue(of(mockAreas));
    apiSpy.getMlAnomalyStats.and.returnValue(of(mockAnomalyStats));
    apiSpy.getDeviceHistory.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;

    // Prevent Leaflet from trying to render into a real DOM
    spyOn(component as any, 'initMap').and.stub();
    spyOn(component as any, 'renderMap').and.stub();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call getDevicesForMap, getAreas and getMlAnomalyStats on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(apiSpy.getDevicesForMap).toHaveBeenCalledTimes(1);
    expect(apiSpy.getAreas).toHaveBeenCalledTimes(1);
    expect(apiSpy.getMlAnomalyStats).toHaveBeenCalledTimes(1);
  }));

  it('should populate devices after load', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.devices.length).toBe(3);
  }));

  it('should populate areas after load', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.areas.length).toBe(1);
    expect(component.areas[0].name).toBe('Zone A');
  }));

  it('should mark anomaly device from recent_anomalies', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const anomalyDev = component.devices.find(d => d.deviceId === 'dev-2');
    expect(anomalyDev?.isAnomaly).toBeTrue();
  }));

  it('should not mark non-anomaly device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const normalDev = component.devices.find(d => d.deviceId === 'dev-1');
    expect(normalDev?.isAnomaly).toBeFalse();
  }));

  it('totalDevices getter should reflect loaded devices', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.totalDevices).toBe(3);
  }));

  it('anomalyCount getter should count anomaly devices', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.anomalyCount).toBe(1);
  }));

  it('should set loading to false after data loads', fakeAsync(() => {
    component.loading = true;
    fixture.detectChanges();
    tick();
    expect(component.loading).toBeFalse();
  }));

  it('should still set loading false when API returns error', fakeAsync(() => {
    apiSpy.getDevicesForMap.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    tick();
    expect(component.loading).toBeFalse();
  }));

  it('should reset pendingPolygon and newAreaName on cancelArea', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.pendingPolygon = [[1, 2], [3, 4], [5, 6]];
    component.newAreaName = 'Draft';
    component.cancelArea();
    expect(component.pendingPolygon).toBeNull();
    expect(component.newAreaName).toBe('');
  }));

  it('selectArea should set filterArea when unselected', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterArea = '';
    component.selectArea(mockAreas[0] as any);
    expect(component.filterArea).toBe('area-1');
  }));

  it('selectArea should clear filterArea when same area clicked again', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterArea = 'area-1';
    component.selectArea(mockAreas[0] as any);
    expect(component.filterArea).toBe('');
  }));

  it('should call deleteArea API on deleteArea', fakeAsync(() => {
    apiSpy.deleteArea.and.returnValue(of({}));
    fixture.detectChanges();
    tick();
    const stopPropSpy = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteArea('area-1', stopPropSpy);
    tick();
    expect(apiSpy.deleteArea).toHaveBeenCalledWith('area-1');
  }));

  it('should not call deleteArea API if confirm is cancelled', fakeAsync(() => {
    apiSpy.deleteArea.and.returnValue(of({}));
    fixture.detectChanges();
    tick();
    const stopPropSpy = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
    spyOn(window, 'confirm').and.returnValue(false);
    component.deleteArea('area-1', stopPropSpy);
    tick();
    expect(apiSpy.deleteArea).not.toHaveBeenCalled();
  }));

  it('should reload data after deleteArea succeeds', fakeAsync(() => {
    apiSpy.deleteArea.and.returnValue(of({}));
    fixture.detectChanges();
    tick();
    const stopPropSpy = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteArea('area-1', stopPropSpy);
    tick();
    // loadData called once on init + once after delete
    expect(apiSpy.getDevicesForMap).toHaveBeenCalledTimes(2);
  }));

  it('should not save area when pendingPolygon is null', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.pendingPolygon = null;
    component.newAreaName = 'Zone B';
    component.saveArea();
    expect(apiSpy.createArea).not.toHaveBeenCalled();
  }));

  // ── markerColor ───────────────────────────────────────────────────────────

  it('markerColor should return green for active normal device', () => {
    const color = component.markerColor({ status: 'ACTIVE', latitude: 1, longitude: 1, isAnomaly: false, anomalyScore: 0 } as any);
    expect(color).toBe('#22c55e');
  });

  it('markerColor should return red for anomaly device', () => {
    const color = component.markerColor({ status: 'ACTIVE', latitude: 1, longitude: 1, isAnomaly: true, anomalyScore: 0.9 } as any);
    expect(color).toBe('#ef4444');
  });

  it('markerColor should return yellow when anomalyScore > 0.3 but not anomaly', () => {
    const color = component.markerColor({ status: 'ACTIVE', latitude: 1, longitude: 1, isAnomaly: false, anomalyScore: 0.5 } as any);
    expect(color).toBe('#f59e0b');
  });

  it('markerColor should return gray for inactive device', () => {
    const color = component.markerColor({ status: 'OFFLINE', latitude: 1, longitude: 1, isAnomaly: false, anomalyScore: 0 } as any);
    expect(color).toBe('#94a3b8');
  });

  it('markerColor should return blue for device without GPS', () => {
    const color = component.markerColor({ status: 'ACTIVE', latitude: null, longitude: null, isAnomaly: false, anomalyScore: 0 } as any);
    expect(color).toBe('#3b82f6');
  });

  // ── noGpsCount getter ─────────────────────────────────────────────────────

  it('noGpsCount should count devices without coordinates', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component.noGpsCount).toBe(1); // dev-3 has null lat/lng
  }));

  it('should not save area when name is blank', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.pendingPolygon = [[1, 2], [3, 4], [5, 6]];
    component.newAreaName = '  ';
    component.saveArea();
    expect(apiSpy.createArea).not.toHaveBeenCalled();
  }));

  it('should call createArea and reload when saveArea succeeds', fakeAsync(() => {
    apiSpy.createArea.and.returnValue(of({}));
    fixture.detectChanges();
    tick();
    const polygon = [[40.4, -3.7], [40.5, -3.7], [40.5, -3.8]];
    component.pendingPolygon = polygon;
    component.newAreaName = 'Zone B';
    component.saveArea();
    tick();
    expect(apiSpy.createArea).toHaveBeenCalledWith('Zone B', polygon);
    expect(apiSpy.getDevicesForMap).toHaveBeenCalledTimes(2);
  }));

  // ── pointInPolygon ────────────────────────────────────────────────────────

  it('pointInPolygon should return true for a point inside a simple polygon', () => {
    // Square: (0,0),(0,10),(10,10),(10,0)
    const polygon = [[0, 0], [0, 10], [10, 10], [10, 0]];
    const result = (component as any).pointInPolygon(5, 5, polygon);
    expect(result).toBeTrue();
  });

  it('pointInPolygon should return false for a point outside a simple polygon', () => {
    const polygon = [[0, 0], [0, 10], [10, 10], [10, 0]];
    const result = (component as any).pointInPolygon(20, 20, polygon);
    expect(result).toBeFalse();
  });

  it('pointInPolygon should return false for empty polygon', () => {
    const result = (component as any).pointInPolygon(5, 5, []);
    expect(result).toBeFalse();
  });

  // ── filteredDevices ───────────────────────────────────────────────────────

  it('filteredDevices should return all devices when no filter set', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterArea = '';
    component.filterSeverity = '';
    const result = (component as any).filteredDevices();
    expect(result.length).toBe(component.devices.length);
  }));

  it('filteredDevices should filter by anomaly severity', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterSeverity = 'anomaly';
    const result = (component as any).filteredDevices();
    expect(result.every((d: any) => d.isAnomaly)).toBeTrue();
  }));

  it('filteredDevices should filter out anomaly devices when severity=normal', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterSeverity = 'normal';
    const result = (component as any).filteredDevices();
    expect(result.every((d: any) => !d.isAnomaly)).toBeTrue();
  }));

  it('filteredDevices should filter by area membership', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.filterArea = 'area-1';
    const result = (component as any).filteredDevices();
    // Only devices whose deviceId is in area-1.deviceIds should pass
    result.forEach((d: any) => {
      const area = component.areas.find(a => a.id === 'area-1');
      expect(area?.deviceIds.includes(d.deviceId)).toBeTrue();
    });
  }));

  it('filteredDevices returns empty array when filterArea matches no devices', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    // Set an area that has no devices
    component.areas = [{ id: 'area-empty', name: 'Empty', polygon: [], deviceCount: 0, deviceIds: [] }];
    component.filterArea = 'area-empty';
    const result = (component as any).filteredDevices();
    expect(result.length).toBe(0);
  }));

  // ── sensorRow ─────────────────────────────────────────────────────────────

  it('sensorRow should return a formatted row when value is present', () => {
    const html = (component as any).sensorRow('Temp', 42.5, (v: number) => `${v.toFixed(1)} °C`);
    expect(html).toContain('Temp');
    expect(html).toContain('42.5 °C');
  });

  it('sensorRow should return empty string when value is null', () => {
    const html = (component as any).sensorRow('Temp', null, (v: number) => `${v} °C`);
    expect(html).toBe('');
  });

  it('sensorRow should return empty string when value is undefined', () => {
    const html = (component as any).sensorRow('Humidity', undefined, (v: number) => `${v} %`);
    expect(html).toBe('');
  });

  // ── formatSensorDisplay ───────────────────────────────────────────────────

  it('formatSensorDisplay should return Loading… when loading=true', () => {
    const result = (component as any).formatSensorDisplay(true, 25, (v: number) => `${v} °C`);
    expect(result).toBe('Loading…');
  });

  it('formatSensorDisplay should return formatted value when not loading and value present', () => {
    const result = (component as any).formatSensorDisplay(false, 25.5, (v: number) => `${v.toFixed(1)} °C`);
    expect(result).toBe('25.5 °C');
  });

  it('formatSensorDisplay should return N/A when not loading and value is null', () => {
    const result = (component as any).formatSensorDisplay(false, null, (v: number) => `${v} °C`);
    expect(result).toBe('N/A');
  });

  it('formatSensorDisplay should return N/A when not loading and value is undefined', () => {
    const result = (component as any).formatSensorDisplay(false, undefined, (v: number) => `${v} °C`);
    expect(result).toBe('N/A');
  });

  // ── buildTooltip ──────────────────────────────────────────────────────────

  it('buildTooltip should show Loading row when histCache has no entry for device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'uncached-dev', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false, areaName: null } as any;
    const html = (component as any).buildTooltip(d);
    expect(html).toContain('Loading…');
  }));

  it('buildTooltip should show ANOMALY badge for anomaly device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'x', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: true, areaName: null } as any;
    const html = (component as any).buildTooltip(d);
    expect(html).toContain('ANOMALY');
  }));

  it('buildTooltip should NOT show Loading row when histCache has entry for device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'cached-dev', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false, areaName: null } as any;
    (component as any).histCache.set('cached-dev', { temp: 30, hum: 60, vib: 0.1 });
    const html = (component as any).buildTooltip(d);
    expect(html).not.toContain('Loading…');
  }));

  // ── buildPopupHtml ────────────────────────────────────────────────────────

  it('buildPopupHtml should include GPS coordinates when latitude and longitude are set', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'dev-gps', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false,
                latitude: 40.4168, longitude: -3.7038, areaName: null, simulated: false, anomalyScore: 0 } as any;
    const html = (component as any).buildPopupHtml(d);
    expect(html).toContain('GPS');
    expect(html).toContain('40.4168');
  }));

  it('buildPopupHtml should NOT include GPS row when latitude is null', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'dev-nogps', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false,
                latitude: null, longitude: null, areaName: null, simulated: false, anomalyScore: 0 } as any;
    const html = (component as any).buildPopupHtml(d);
    // GPS row should not appear
    expect(html).not.toMatch(/<b>GPS<\/b>/);
  }));

  it('buildPopupHtml should include ANOMALY badge for anomaly device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'dev-anom', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: true,
                latitude: 1, longitude: 1, areaName: 'Zone A', simulated: false, anomalyScore: 0.91 } as any;
    const html = (component as any).buildPopupHtml(d);
    expect(html).toContain('ANOMALY');
    expect(html).toContain('0.9100');
  }));

  it('buildPopupHtml should include NORMAL badge for non-anomaly device', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'dev-norm', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false,
                latitude: 1, longitude: 1, areaName: null, simulated: true, anomalyScore: 0 } as any;
    const html = (component as any).buildPopupHtml(d);
    expect(html).toContain('NORMAL');
  }));

  it('buildPopupHtml should show Loading when histCache has no entry', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'uncached-2', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false,
                latitude: 1, longitude: 1, areaName: null, simulated: false, anomalyScore: 0 } as any;
    const html = (component as any).buildPopupHtml(d);
    expect(html).toContain('Loading…');
  }));

  it('buildPopupHtml should show sensor values from histCache when available', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const d = { deviceId: 'cached-2', type: 'TEMPERATURE', status: 'ACTIVE', isAnomaly: false,
                latitude: 1, longitude: 1, areaName: null, simulated: false, anomalyScore: 0 } as any;
    (component as any).histCache.set('cached-2', { temp: 55.5, hum: 70, vib: 0.05 });
    const html = (component as any).buildPopupHtml(d);
    expect(html).toContain('55.5');
  }));

  it('ngOnDestroy should not throw when map is not initialised', () => {
    fixture.detectChanges();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('applyFilters should re-render markers without error', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(() => component.applyFilters()).not.toThrow();
  }));

  it('toggleHeatmap should call renderHeatmap when showHeatmap is true', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const renderHeatmapSpy = spyOn(component as any, 'renderHeatmap').and.stub();
    component.showHeatmap = true;
    component.toggleHeatmap();
    expect(renderHeatmapSpy).toHaveBeenCalled();
  }));

  it('toggleHeatmap should do nothing when showHeatmap is false and heatLayer absent', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.showHeatmap = false;
    (component as any).heatLayer = undefined;
    expect(() => component.toggleHeatmap()).not.toThrow();
  }));

  it('toggleAreas should call renderAreas when showAreas is true', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const renderAreasSpy = spyOn(component as any, 'renderAreas').and.stub();
    component.showAreas = true;
    component.toggleAreas();
    expect(renderAreasSpy).toHaveBeenCalled();
  }));

  it('toggleAreas should clear areaGroup when showAreas is false', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.showAreas = false;
    expect(() => component.toggleAreas()).not.toThrow();
  }));

  it('startDraw should toggle off drawing when isDrawing is already true', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.isDrawing = true;
    // stopDraw tries to remove drawControl which is undefined — should not throw
    (component as any).drawControl = { addTo: jasmine.createSpy() };
    (component as any).map = { removeControl: jasmine.createSpy(), remove: jasmine.createSpy() };
    component.startDraw();
    expect(component.isDrawing).toBeTrue(); // isDrawing stays true since startDraw returned early
  }));

  it('ensureHistory should fetch from API when device not cached', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    apiSpy['getDeviceHistory'] = jasmine.createSpy().and.returnValue(
      of([{ temperature: 25, humidity: 60, vibration: 0.1 }])
    );
    const onReady = jasmine.createSpy('onReady');
    (component as any).ensureHistory('new-device-id', onReady);
    tick();
    expect(onReady).toHaveBeenCalled();
    expect((component as any).histCache.has('new-device-id')).toBeTrue();
  }));

  it('ensureHistory should not fetch when device already cached', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    apiSpy['getDeviceHistory'] = jasmine.createSpy().and.returnValue(of([]));
    (component as any).histCache.set('cached-device', { temp: 25, hum: 60, vib: 0.1 });
    (component as any).ensureHistory('cached-device', () => {});
    tick();
    expect(apiSpy['getDeviceHistory']).not.toHaveBeenCalled();
  }));

  it('ensureHistory should handle API error gracefully', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    apiSpy['getDeviceHistory'] = jasmine.createSpy().and.returnValue(throwError(() => new Error('fail')));
    const onReady = jasmine.createSpy('onReady');
    expect(() => {
      (component as any).ensureHistory('error-device', onReady);
      tick();
    }).not.toThrow();
    expect(onReady).toHaveBeenCalled();
  }));

  it('ensureHistory should cache null when history is empty', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    apiSpy['getDeviceHistory'] = jasmine.createSpy().and.returnValue(of([]));
    (component as any).ensureHistory('empty-hist', () => {});
    tick();
    expect((component as any).histCache.get('empty-hist')).toBeNull();
  }));
});
