import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AnalyticsComponent } from './analytics.component';
import { ApiService } from '../services/api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockDevices = [
  { deviceId: 'sensor-01' },
  { deviceId: 'sensor-02' },
];

// API returns newest-first; component reverses to get chronological order
const mockHistory = [
  { ts: 1700000010000, temperature: 30, humidity: 65, vibration: 0.05 },
  { ts: 1700000000000, temperature: 25, humidity: 60, vibration: 0.02 },
];

describe('AnalyticsComponent', () => {
  let component: AnalyticsComponent;
  let fixture: ComponentFixture<AnalyticsComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getDevices', 'getDeviceStats', 'getDeviceHistory']);

    apiSpy.getDevices.and.returnValue(of(mockDevices));
    apiSpy.getDeviceStats.and.returnValue(of({ deviceId: 'sensor-01', eventCount: 10, lastSeen: null }));
    apiSpy.getDeviceHistory.and.returnValue(of(mockHistory));

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent, NoopAnimationsModule],
      providers: [{ provide: ApiService, useValue: apiSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load devices on init and auto-select first', () => {
    expect(component.devices.length).toBe(2);
    expect(component.selectedDeviceId).toBe('sensor-01');
  });

  it('should load history and reverse for chronological order', () => {
    // After reversal: oldest entry (ts=1700000000000) should be first
    expect(component.historyRaw[0].ts).toBeLessThan(component.historyRaw[1].ts);
  });

  it('buildChart() should create series for selected sensor', () => {
    component.chartSensor = 'temperature';
    component.buildChart();
    expect(component.historyData.length).toBe(1);
    expect(component.historyData[0].name).toBe('Temperature');
    expect(component.historyData[0].series.length).toBe(2);
    // After reversal, first entry is the oldest (temperature: 25)
    expect(component.historyData[0].series[0].value).toBe(25);
  });

  it('buildChart() should use humidity values when sensor is humidity', () => {
    component.chartSensor = 'humidity';
    component.buildChart();
    expect(component.historyData[0].name).toBe('Humidity');
    // After reversal, first entry is the oldest (humidity: 60)
    expect(component.historyData[0].series[0].value).toBe(60);
  });

  it('buildChart() should return empty array when no history', () => {
    component.historyRaw = [];
    component.buildChart();
    expect(component.historyData).toEqual([]);
  });

  it('getShare() should calculate percentage correctly', () => {
    component.allStats = [
      { deviceId: 'sensor-01', eventCount: 75 },
      { deviceId: 'sensor-02', eventCount: 25 },
    ];
    expect(component.getShare(75)).toBe(75);
    expect(component.getShare(25)).toBe(25);
  });

  it('getShare() should return 0 when total is 0', () => {
    component.allStats = [];
    expect(component.getShare(0)).toBe(0);
  });

  it('yAxisLabel should return correct unit for each sensor', () => {
    component.chartSensor = 'temperature';
    expect(component.yAxisLabel).toBe('°C');
    component.chartSensor = 'humidity';
    expect(component.yAxisLabel).toBe('%');
    component.chartSensor = 'vibration';
    expect(component.yAxisLabel).toBe('m/s²');
  });

  it('loadAll() should handle API error gracefully', () => {
    apiSpy.getDevices.and.returnValue(throwError(() => new Error('API error')));
    component.loadAll();
    expect(component.devices.length).toBe(0);
    expect(component.loading).toBeFalse();
  });

  it('allStats should be sorted by eventCount descending', () => {
    apiSpy.getDeviceStats.and.callFake((id: string) =>
      of({ deviceId: id, eventCount: id === 'sensor-01' ? 5 : 20 })
    );
    component.loadAllStats();
    expect(component.allStats[0].eventCount).toBeGreaterThanOrEqual(component.allStats[1]?.eventCount ?? 0);
  });
});
