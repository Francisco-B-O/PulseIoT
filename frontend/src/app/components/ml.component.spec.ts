import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MlComponent } from './ml.component';
import { ApiService } from '../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('MlComponent', () => {
  let component: MlComponent;
  let fixture: ComponentFixture<MlComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let snackSpy: jasmine.SpyObj<MatSnackBar>;

  const mockStats      = { total_events: 200, devices: ['sensor-01'] };
  const mockHealth     = { status: 'UP', model_loaded: true };
  const mockAnomaly    = { total_predictions: 50, anomaly_rate: 0.1, anomalies_by_device: { 'sensor-01': 5 } };
  const mockAutoTrain  = { enabled: false, interval_hours: 6 };

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', [
      'getMlStats', 'getMlHealth', 'getMlAnomalyStats', 'getAutoTrainConfig',
      'predict', 'trainModel', 'setAutoTrainConfig'
    ]);
    snackSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    apiSpy.getMlStats.and.returnValue(of(mockStats));
    apiSpy.getMlHealth.and.returnValue(of(mockHealth));
    apiSpy.getMlAnomalyStats.and.returnValue(of(mockAnomaly));
    apiSpy.getAutoTrainConfig.and.returnValue(of(mockAutoTrain));

    await TestBed.configureTestingModule({
      imports: [MlComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: MatSnackBar, useValue: snackSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load ML data on init', () => {
    expect(component.mlStats).toEqual(mockStats);
    expect(component.mlHealth).toBe('ok');
    expect(component.anomalyStats).toEqual(mockAnomaly);
    expect(component.autoTrainConfig).toEqual(mockAutoTrain);
  });

  it('should set mlHealth=error when health call fails', () => {
    apiSpy.getMlHealth.and.returnValue(throwError(() => new Error('health error')));
    component.loadAll();
    expect(component.mlHealth).toBe('error');
  });

  it('anomalyDeviceCount should count devices with anomalies', () => {
    expect(component.anomalyDeviceCount).toBe(1);
  });

  it('anomalyDeviceCount should return 0 when anomalyStats is null', () => {
    component.anomalyStats = null;
    expect(component.anomalyDeviceCount).toBe(0);
  });

  it('setPredPreset() normal should set expected values', () => {
    component.setPredPreset('normal');
    expect(component.predTemp).toBe(22);
    expect(component.predHumidity).toBe(55);
    expect(component.predVibration).toBe(0.01);
  });

  it('setPredPreset() anomaly should set extreme values', () => {
    component.setPredPreset('anomaly');
    expect(component.predTemp).toBe(150);
    expect(component.predHumidity).toBe(99);
    expect(component.predVibration).toBe(12);
  });

  it('predict() should do nothing when no device ID', () => {
    component.predDeviceId = '';
    component.predict();
    expect(apiSpy.predict).not.toHaveBeenCalled();
  });

  it('predict() should call api.predict and set predResult', () => {
    const mockResult = {
      is_anomaly: true, anomaly_score: -0.1, prediction: 'ANOMALY',
      threshold: -0.05, severity: 'HIGH',
      scores: { isolation: -0.1, zscore: 2.5, trend: false },
      reason: 'Isolation Forest score -0.100 below threshold'
    };
    apiSpy.predict.and.returnValue(of(mockResult));
    apiSpy.getMlAnomalyStats.and.returnValue(of(mockAnomaly));
    component.predDeviceId = 'sensor-01';
    component.predict();
    expect(apiSpy.predict).toHaveBeenCalledWith('sensor-01', component.predTemp, component.predHumidity, component.predVibration);
    expect(component.predResult).toEqual(mockResult);
    expect(component.predicting).toBeFalse();
  });

  it('predict() should set predicting=false and predResult=null on error', () => {
    apiSpy.predict.and.returnValue(throwError(() => ({ status: 500 })));
    component.predDeviceId = 'sensor-01';
    component.predict();
    expect(component.predicting).toBeFalse();
    expect(component.predResult).toBeNull();
  });

  it('trainModel() should call api.trainModel and update state', () => {
    apiSpy.trainModel.and.returnValue(of({ message: 'Training completed' }));
    component.trainModel();
    expect(apiSpy.trainModel).toHaveBeenCalled();
    expect(component.trainingStatus).toBe('success');
    expect(component.trainingLog).toBe('Training completed');
    expect(component.training).toBeFalse();
  });

  it('trainModel() should set trainingStatus=error on failure', () => {
    apiSpy.trainModel.and.returnValue(throwError(() => ({ status: 500 })));
    component.trainModel();
    expect(component.trainingStatus).toBe('error');
    expect(component.training).toBeFalse();
  });

  it('toggleAutoTrain() should do nothing when autoTrainConfig is null', () => {
    component.autoTrainConfig = null;
    component.toggleAutoTrain();
    expect(apiSpy.setAutoTrainConfig).not.toHaveBeenCalled();
  });

  it('toggleAutoTrain() should flip enabled state', () => {
    apiSpy.setAutoTrainConfig.and.returnValue(of({ config: { enabled: true, interval_hours: 6 } }));
    component.autoTrainConfig = { enabled: false, interval_hours: 6 };
    component.toggleAutoTrain();
    expect(apiSpy.setAutoTrainConfig).toHaveBeenCalledWith(true, component.autoTrainIntervalHours);
  });

  it('saveAutoTrain() should do nothing when auto-train is disabled', () => {
    component.autoTrainConfig = { enabled: false };
    component.saveAutoTrain();
    expect(apiSpy.setAutoTrainConfig).not.toHaveBeenCalled();
  });
});
