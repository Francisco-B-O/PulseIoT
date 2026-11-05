import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HealthComponent } from './health.component';
import { ApiService } from '../services/api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('HealthComponent', () => {
  let component: HealthComponent;
  let fixture: ComponentFixture<HealthComponent>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getGatewayHealth', 'getMlHealth', 'getDiscoveryHealth']);

    apiSpy.getGatewayHealth.and.returnValue(of({ status: 'UP' }));
    apiSpy.getMlHealth.and.returnValue(of({ status: 'UP' }));
    apiSpy.getDiscoveryHealth.and.returnValue(of({ components: { discoveryComposite: { status: 'UP' } } }));

    await TestBed.configureTestingModule({
      imports: [HealthComponent, NoopAnimationsModule],
      providers: [{ provide: ApiService, useValue: apiSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(HealthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should check all services on init', () => {
    expect(apiSpy.getGatewayHealth).toHaveBeenCalled();
    expect(apiSpy.getMlHealth).toHaveBeenCalled();
    expect(apiSpy.getDiscoveryHealth).toHaveBeenCalled();
  });

  it('allUp should be true when all services respond', () => {
    expect(component.allUp).toBeTrue();
  });

  it('upCount should equal number of healthy services', () => {
    expect(component.upCount).toBe(3);
  });

  it('should mark gateway as down when call fails', () => {
    apiSpy.getGatewayHealth.and.returnValue(throwError(() => new Error('gateway error')));
    component.checkAll();
    expect(component.services[0].status).toBe('down');
  });

  it('should mark ML as down when call fails', () => {
    apiSpy.getMlHealth.and.returnValue(throwError(() => new Error('ml error')));
    component.checkAll();
    expect(component.services[1].status).toBe('down');
  });

  it('should mark Discovery as down when discoveryComposite is not UP', () => {
    apiSpy.getDiscoveryHealth.and.returnValue(of({ components: { discoveryComposite: { status: 'DOWN' } } }));
    component.checkAll();
    expect(component.services[2].status).toBe('down');
  });

  it('allUp should be false when any service is down', () => {
    apiSpy.getGatewayHealth.and.returnValue(throwError(() => new Error('gateway error')));
    component.checkAll();
    expect(component.allUp).toBeFalse();
  });

  it('should set lastCheck date after all checks complete', () => {
    expect(component.lastCheck).toBeDefined();
  });

  it('checking should be false after all services respond', () => {
    expect(component.checking).toBeFalse();
  });

  it('should have 9 known service names', () => {
    expect(component.allServiceNames.length).toBe(9);
  });
});
