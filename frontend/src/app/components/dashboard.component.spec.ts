import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../services/api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockDevices = [
  { deviceId: 'sensor-01' },
  { deviceId: 'sensor-02' },
];

const mockAlerts = [
  { id: '1', deviceId: 'sensor-01', severity: 'HIGH',   acknowledged: false, timestamp: '2026-01-01T10:00:00Z' },
  { id: '2', deviceId: 'sensor-01', severity: 'CRITICAL', acknowledged: false, timestamp: '2026-01-01T11:00:00Z' },
  { id: '3', deviceId: 'sensor-02', severity: 'MEDIUM', acknowledged: true,  timestamp: '2026-01-01T09:00:00Z' },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', [
      'getDevices', 'getAlerts', 'getMlStats', 'getMlHealth', 'trainModel'
    ]);
    apiSpy.getDevices.and.returnValue(of(mockDevices));
    apiSpy.getAlerts.and.returnValue(of(mockAlerts));
    apiSpy.getMlStats.and.returnValue(of({ total_events: 100 }));
    apiSpy.getMlHealth.and.returnValue(of({ status: 'UP' }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [{ provide: ApiService, useValue: apiSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load device count on init', () => {
    expect(component.deviceCount).toBe(2);
  });

  it('should calculate pending alerts (unacknowledged)', () => {
    expect(component.pendingAlerts).toBe(2);
  });

  it('should calculate critical alerts (severity HIGH or CRITICAL)', () => {
    expect(component.criticalAlerts).toBe(2);
  });

  it('should set totalAlerts correctly', () => {
    expect(component.totalAlerts).toBe(3);
  });

  it('should set mlEvents from ML stats', () => {
    expect(component.mlEvents).toBe(100);
  });

  it('should set mlOnline=true when health responds', () => {
    expect(component.mlOnline).toBeTrue();
  });

  it('should set mlOnline=false when health fails', () => {
    apiSpy.getMlHealth.and.returnValue(throwError(() => new Error('health check failed')));
    component.refreshData();
    expect(component.mlOnline).toBeFalse();
  });

  it('should sort recentAlerts newest first', () => {
    expect(component.recentAlerts[0].id).toBe('2');
    expect(component.recentAlerts[1].id).toBe('1');
  });

  it('should build severityData from alert counts', () => {
    const high = component.severityData.find(d => d.name === 'HIGH');
    expect(high?.value).toBe(1);
    const medium = component.severityData.find(d => d.name === 'MEDIUM');
    expect(medium?.value).toBe(1);
  });

  it('should build deviceBarData as alerts per device, busiest first', () => {
    expect(component.deviceBarData.length).toBe(2);
    expect(component.deviceBarData[0]).toEqual({ name: 'sensor-01', value: 2 });
  });

  it('trainModel() should call api.trainModel and refresh', () => {
    apiSpy.trainModel.and.returnValue(of({}));
    component.trainModel();
    expect(apiSpy.trainModel).toHaveBeenCalled();
    expect(component.training).toBeFalse();
  });

  it('trainModel() should set training=false on error', () => {
    apiSpy.trainModel.and.returnValue(throwError(() => new Error('train model failed')));
    component.trainModel();
    expect(component.training).toBeFalse();
  });

  it('should gracefully handle API errors with empty fallbacks', () => {
    apiSpy.getDevices.and.returnValue(throwError(() => new Error('devices API error')));
    apiSpy.getAlerts.and.returnValue(throwError(() => new Error('alerts API error')));
    component.refreshData();
    expect(component.deviceCount).toBe(0);
    expect(component.totalAlerts).toBe(0);
  });

  it('should auto-refresh every 15 seconds', fakeAsync(() => {
    // Re-create component inside fakeAsync so the interval timer is tracked by tick()
    fixture.destroy();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const callsBefore = apiSpy.getDevices.calls.count();
    tick(15000);
    expect(apiSpy.getDevices.calls.count()).toBeGreaterThan(callsBefore);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
});
