import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TelemetryComponent } from './telemetry.component';
import { ApiService } from '../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockDevices = [
  { deviceId: 'sensor-01', type: 'TEMPERATURE' },
  { deviceId: 'sensor-02', type: 'HUMIDITY' },
];

describe('TelemetryComponent', () => {
  let component: TelemetryComponent;
  let fixture: ComponentFixture<TelemetryComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let snackSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getDevices', 'sendTelemetry']);
    snackSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    apiSpy.getDevices.and.returnValue(of(mockDevices));

    await TestBed.configureTestingModule({
      imports: [TelemetryComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: MatSnackBar, useValue: snackSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TelemetryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load devices and auto-select first one', () => {
    expect(component.devices.length).toBe(2);
    expect(component.selectedId).toBe('sensor-01');
  });

  it('setPreset() normal should set correct sensor values', () => {
    component.setPreset('normal');
    expect(component.tTemp).toBe(22);
    expect(component.tHum).toBe(55);
    expect(component.tVib).toBe(0.01);
  });

  it('setPreset() warn should set warning values', () => {
    component.setPreset('warn');
    expect(component.tTemp).toBe(75);
    expect(component.tHum).toBe(85);
    expect(component.tVib).toBe(3.5);
  });

  it('setPreset() crit should set critical values', () => {
    component.setPreset('crit');
    expect(component.tTemp).toBe(115);
    expect(component.tHum).toBe(95);
    expect(component.tVib).toBe(8);
  });

  it('send() should do nothing when no device selected', () => {
    component.selectedId = '';
    component.send();
    expect(apiSpy.sendTelemetry).not.toHaveBeenCalled();
  });

  it('send() should call sendTelemetry with current values', () => {
    apiSpy.sendTelemetry.and.returnValue(of({}));
    component.selectedId = 'sensor-01';
    component.tTemp = 30;
    component.tHum = 65;
    component.tVib = 0.5;
    component.send();
    expect(apiSpy.sendTelemetry).toHaveBeenCalledWith('sensor-01', 30, 65, 0.5);
  });

  it('send() should add successful entry to history', () => {
    apiSpy.sendTelemetry.and.returnValue(of({}));
    component.selectedId = 'sensor-01';
    component.send();
    expect(component.history.length).toBe(1);
    expect(component.history[0].ok).toBeTrue();
  });

  it('send() should add failed entry to history on error', () => {
    apiSpy.sendTelemetry.and.returnValue(throwError(() => ({ status: 500 })));
    component.selectedId = 'sensor-01';
    component.send();
    expect(component.history.length).toBe(1);
    expect(component.history[0].ok).toBeFalse();
  });

  it('send() should keep history limited to 20 entries', () => {
    apiSpy.sendTelemetry.and.returnValue(of({}));
    component.selectedId = 'sensor-01';
    for (let i = 0; i < 25; i++) component.send();
    expect(component.history.length).toBe(20);
  });

  it('send() should set sending=false after success', () => {
    apiSpy.sendTelemetry.and.returnValue(of({}));
    component.selectedId = 'sensor-01';
    component.send();
    expect(component.sending).toBeFalse();
  });
});
