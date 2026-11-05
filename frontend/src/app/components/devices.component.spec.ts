import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DevicesComponent } from './devices.component';
import { ApiService } from '../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockDevices = [
  { deviceId: 'sensor-01', type: 'TEMPERATURE', status: 'ACTIVE', simulated: false, registeredAt: '2026-01-01' },
  { deviceId: 'sensor-02', type: 'HUMIDITY',    status: 'ACTIVE', simulated: true,  registeredAt: '2026-01-02' },
];

describe('DevicesComponent', () => {
  let component: DevicesComponent;
  let fixture: ComponentFixture<DevicesComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let snackSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', [
      'getDevices', 'createDevice', 'deleteDevice', 'setSimulated',
      'getDeviceStats', 'sendTelemetry', 'getAreas'
    ]);
    snackSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    apiSpy.getDevices.and.returnValue(of(mockDevices));
    apiSpy.getDeviceStats.and.returnValue(of({ deviceId: 'sensor-01', lastSeen: null }));
    apiSpy.getAreas.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DevicesComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: MatSnackBar, useValue: snackSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DevicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // Override the snack bar instance so the spy is used regardless of
    // which injector level MatSnackBarModule registered its own provider.
    (component as any)['snack'] = snackSpy;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load devices on init', () => {
    expect(component.devices.length).toBe(2);
    expect(component.filtered.length).toBe(2);
  });

  it('applySearch() should filter by deviceId', () => {
    component.search = 'sensor-01';
    component.applySearch();
    expect(component.filtered.length).toBe(1);
    expect(component.filtered[0].deviceId).toBe('sensor-01');
  });

  it('applySearch() should filter by type', () => {
    component.search = 'humidity';
    component.applySearch();
    expect(component.filtered.length).toBe(1);
  });

  it('applySearch() with empty string should return all devices', () => {
    component.search = '';
    component.applySearch();
    expect(component.filtered.length).toBe(2);
  });

  it('onlineCount should count devices with isOnline=true', () => {
    component.devices = [
      { ...mockDevices[0], isOnline: true },
      { ...mockDevices[1], isOnline: false },
    ] as any;
    expect(component.onlineCount).toBe(1);
  });

  it('create() should do nothing when newId is empty', () => {
    component.newId = '';
    component.newType = 'TEMPERATURE';
    component.create();
    expect(apiSpy.createDevice).not.toHaveBeenCalled();
  });

  it('create() should call api.createDevice and reset form', () => {
    apiSpy.createDevice.and.returnValue(of({ deviceId: 'sensor-03' }));
    component.newId = 'sensor-03';
    component.newType = 'TEMPERATURE';
    component.create();
    expect(apiSpy.createDevice).toHaveBeenCalledWith('sensor-03', 'TEMPERATURE', false, null, null);
    expect(component.creating).toBeFalse();
    expect(component.showForm).toBeFalse();
    expect(component.newId).toBe('');
  });

  it('create() should set creating=false on failure', () => {
    apiSpy.createDevice.and.returnValue(throwError(() => ({ status: 409, error: { message: 'Conflict' } })));
    component.newId = 'sensor-01';
    component.newType = 'TEMPERATURE';
    component.create();
    expect(component.creating).toBeFalse();
  });

  it('preset() normal should set sensor values', () => {
    component.preset('normal');
    expect(component.tTemp).toBe(22);
    expect(component.tHum).toBe(55);
    expect(component.tVib).toBe(0.01);
  });

  it('preset() warn should set sensor values', () => {
    component.preset('warn');
    expect(component.tTemp).toBe(75);
  });

  it('preset() critical should set sensor values', () => {
    component.preset('critical');
    expect(component.tTemp).toBe(115);
    expect(component.tHum).toBe(95);
    expect(component.tVib).toBe(8);
  });

  it('openTelemetry() should set telDevice and reset sensor defaults', () => {
    component.openTelemetry(mockDevices[0]);
    expect(component.telDevice).toEqual(mockDevices[0] as any);
    expect(component.tTemp).toBe(25);
    expect(component.tHum).toBe(60);
    expect(component.tVib).toBe(0.02);
  });

  it('closeTel() should clear telDevice', () => {
    component.telDevice = mockDevices[0] as any;
    component.closeTel();
    expect(component.telDevice).toBeNull();
  });

  it('sendTel() should call api.sendTelemetry and close modal', () => {
    apiSpy.sendTelemetry.and.returnValue(of({}));
    component.telDevice = mockDevices[0] as any;
    component.tTemp = 30;
    component.sendTel();
    expect(apiSpy.sendTelemetry).toHaveBeenCalledWith('sensor-01', 30, component.tHum, component.tVib);
    expect(component.telDevice).toBeNull();
  });

  it('deviceTooltip() should return no-telemetry message when lastSeen is null', () => {
    const d = { ...mockDevices[0], lastSeen: null } as any;
    expect(component.deviceTooltip(d)).toBe('No telemetry received');
  });

  it('deviceTooltip() should return last seen time when lastSeen is set', () => {
    const d = { ...mockDevices[0], lastSeen: Date.now() } as any;
    expect(component.deviceTooltip(d)).toContain('Last seen:');
  });

  it('toggleSimulated() should call api.setSimulated and update device', () => {
    apiSpy.setSimulated = jasmine.createSpy().and.returnValue(of({ simulated: true }));
    const device = { ...mockDevices[0], simulated: false } as any;
    component.devices = [device];
    component.toggleSimulated(device);
    expect(apiSpy.setSimulated).toHaveBeenCalledWith('sensor-01', true);
    expect(device.simulated).toBeTrue();
  });

  it('toggleSimulated() should show error snack on failure', () => {
    apiSpy.setSimulated = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 500, error: {} })));
    const device = { ...mockDevices[0], simulated: false } as any;
    component.toggleSimulated(device);
    expect(snackSpy.open).toHaveBeenCalled();
  });

  it('remove() should call api.deleteDevice when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    apiSpy.deleteDevice = jasmine.createSpy().and.returnValue(of({}));
    component.remove('uuid-1', 'sensor-01');
    expect(apiSpy.deleteDevice).toHaveBeenCalledWith('sensor-01');
  });

  it('remove() should not call api.deleteDevice when cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    apiSpy.deleteDevice = jasmine.createSpy().and.returnValue(of({}));
    component.remove('uuid-1', 'sensor-01');
    expect(apiSpy.deleteDevice).not.toHaveBeenCalled();
  });

  it('remove() should show error snack on failure', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    apiSpy.deleteDevice = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 404 })));
    component.remove('uuid-1', 'sensor-01');
    expect(snackSpy.open).toHaveBeenCalled();
  });

  it('openLocPicker() should set locDevice and open picker', () => {
    const device = { ...mockDevices[0], latitude: 40.4, longitude: -3.7 } as any;
    component.openLocPicker(device);
    expect(component.locPickerOpen).toBeTrue();
    expect(component.locDevice).toEqual(device);
    expect(component.pickingForNew).toBeFalse();
    expect(component.pickedLat).toBe(40.4);
    expect(component.pickedLng).toBe(-3.7);
  });

  it('openLocPickerForNew() should set pickingForNew and open picker', () => {
    component.newLat = 41.0;
    component.newLng = -4.0;
    component.openLocPickerForNew();
    expect(component.locPickerOpen).toBeTrue();
    expect(component.pickingForNew).toBeTrue();
    expect(component.pickedLat).toBe(41.0);
    expect(component.pickedLng).toBe(-4.0);
  });

  it('closeLocPicker() should reset all location picker state', () => {
    component.locPickerOpen = true;
    component.locDevice = mockDevices[0] as any;
    component.pickingForNew = true;
    component.pickedLat = 40.0;
    component.pickedLng = -3.0;
    component.closeLocPicker();
    expect(component.locPickerOpen).toBeFalse();
    expect(component.locDevice).toBeNull();
    expect(component.pickingForNew).toBeFalse();
    expect(component.pickedLat).toBeNull();
    expect(component.pickedLng).toBeNull();
  });

  it('confirmLocPicker() should do nothing when no coords picked', () => {
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy();
    component.pickedLat = null;
    component.pickedLng = null;
    component.confirmLocPicker();
    expect((apiSpy as any).updateDeviceLocation).not.toHaveBeenCalled();
  });

  it('confirmLocPicker() should set newLat/newLng and close when pickingForNew', () => {
    component.pickingForNew = true;
    component.pickedLat = 40.5;
    component.pickedLng = -3.5;
    component.confirmLocPicker();
    expect(component.newLat).toBe(40.5);
    expect(component.newLng).toBe(-3.5);
    expect(component.locPickerOpen).toBeFalse();
  });

  it('confirmLocPicker() should call updateDeviceLocation for existing device', () => {
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy().and.returnValue(of({ latitude: 40.5, longitude: -3.5 }));
    const device = { ...mockDevices[0], latitude: null, longitude: null } as any;
    component.devices = [device];
    component.locDevice = device;
    component.pickingForNew = false;
    component.pickedLat = 40.5;
    component.pickedLng = -3.5;
    component.confirmLocPicker();
    expect((apiSpy as any).updateDeviceLocation).toHaveBeenCalledWith('sensor-01', 40.5, -3.5);
  });

  it('clearLocation() should call updateDeviceLocation when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy().and.returnValue(of({}));
    const device = { ...mockDevices[0], latitude: 40.4, longitude: -3.7 } as any;
    component.clearLocation(device);
    expect((apiSpy as any).updateDeviceLocation).toHaveBeenCalledWith('sensor-01', null, null);
  });

  it('clearLocation() should not call api when cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy().and.returnValue(of({}));
    const device = { ...mockDevices[0] } as any;
    component.clearLocation(device);
    expect((apiSpy as any).updateDeviceLocation).not.toHaveBeenCalled();
  });

  it('clearLocationFromPicker() should do nothing when no locDevice', () => {
    component.locDevice = null;
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy();
    component.clearLocationFromPicker();
    expect((apiSpy as any).updateDeviceLocation).not.toHaveBeenCalled();
  });

  it('clearLocationFromPicker() should call updateDeviceLocation when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const device = { ...mockDevices[0], latitude: 40.4, longitude: -3.7 } as any;
    component.locDevice = device;
    component.devices = [device];
    (apiSpy as any).updateDeviceLocation = jasmine.createSpy().and.returnValue(of({}));
    component.clearLocationFromPicker();
    expect((apiSpy as any).updateDeviceLocation).toHaveBeenCalledWith('sensor-01', null, null);
  });

  it('sendTel() should show error snack on failure', () => {
    apiSpy.sendTelemetry.and.returnValue(throwError(() => ({ status: 500, error: {} })));
    component.telDevice = mockDevices[0] as any;
    component.sendTel();
    expect(snackSpy.open).toHaveBeenCalled();
    expect(component.sending).toBeFalse();
  });

  it('load() should handle area data and build deviceAreaMap', fakeAsync(() => {
    const areas = [{ name: 'Zone A', deviceIds: ['sensor-01'] }];
    apiSpy.getAreas.and.returnValue(of(areas));
    component.load();
    tick();
    expect(component.deviceAreaMap.get('sensor-01')).toBe('Zone A');
  }));

  it('load() should handle device with multiple areas and concatenate names', fakeAsync(() => {
    const areas = [
      { name: 'Zone A', deviceIds: ['sensor-01'] },
      { name: 'Zone B', deviceIds: ['sensor-01'] },
    ];
    apiSpy.getAreas.and.returnValue(of(areas));
    component.load();
    tick();
    expect(component.deviceAreaMap.get('sensor-01')).toContain('Zone A');
    expect(component.deviceAreaMap.get('sensor-01')).toContain('Zone B');
  }));

  it('load() should set loading false when getDevices errors', fakeAsync(() => {
    apiSpy.getDevices.and.returnValue(throwError(() => new Error('fail')));
    component.load();
    tick();
    expect(component.loading).toBeFalse();
  }));

  it('applySearch() should filter by status', () => {
    component.search = 'active';
    component.applySearch();
    expect(component.filtered.every(d => d.status.toLowerCase().includes('active'))).toBeTrue();
  });

  it('deviceTooltip() should return no-telemetry message when lastSeen is 0', () => {
    const d = { ...mockDevices[0], lastSeen: 0 } as any;
    expect(component.deviceTooltip(d)).toBe('No telemetry received');
  });
});
