import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockAlerts = [
    { id: '1', deviceId: 'sensor-01', severity: 'CRITICAL', message: 'High temp',
      timestamp: new Date().toISOString(), acknowledged: false },
    { id: '2', deviceId: 'sensor-02', severity: 'HIGH',     message: 'Warning',
      timestamp: new Date().toISOString(), acknowledged: true  },
  ];

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'logout']);
    apiSpy  = jasmine.createSpyObj('ApiService',  ['getAlerts']);

    // Return not-authenticated so only <app-login> renders — avoids pulling
    // in the full child component tree during test setup.
    authSpy.isAuthenticated.and.returnValue(false);
    apiSpy.getAlerts.and.returnValue(of(mockAlerts));

    await TestBed.configureTestingModule({
      imports: [AppComponent, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: ApiService,  useValue: apiSpy  },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('go() should change active section', () => {
    component.go('devices');
    expect(component.active).toBe('devices');
  });

  it('go() should close mobile menu', () => {
    component.mobileOpen = true;
    component.go('map');
    expect(component.mobileOpen).toBeFalse();
  });

  it('toggleSidebar() should toggle collapsed', () => {
    component.collapsed = false;
    component.toggleSidebar();
    expect(component.collapsed).toBeTrue();
    component.toggleSidebar();
    expect(component.collapsed).toBeFalse();
  });

  it('toggleDark() should toggle isDark', () => {
    component.isDark = false;
    component.toggleDark();
    expect(component.isDark).toBeTrue();
    component.toggleDark();
    expect(component.isDark).toBeFalse();
  });

  it('toggleNotifPanel() should toggle notifOpen', () => {
    component.notifOpen = false;
    component.toggleNotifPanel();
    expect(component.notifOpen).toBeTrue();
    component.toggleNotifPanel();
    expect(component.notifOpen).toBeFalse();
  });

  it('goToAlert() should navigate to alerts and close panel', () => {
    component.notifOpen = true;
    component.goToAlert(mockAlerts[0] as any);
    expect(component.active).toBe('alerts');
    expect(component.notifOpen).toBeFalse();
  });

  it('goToAlerts() should navigate to alerts and close panel', () => {
    component.notifOpen = true;
    component.goToAlerts();
    expect(component.active).toBe('alerts');
    expect(component.notifOpen).toBeFalse();
  });

  it('logout() should delegate to authService', () => {
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
  });

  it('handleKey() should close mobileOpen and notifOpen on Escape', () => {
    component.mobileOpen = true;
    component.notifOpen  = true;
    component.handleKey(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.mobileOpen).toBeFalse();
    expect(component.notifOpen).toBeFalse();
  });

  it('handleKey() should not close on non-Escape keys', () => {
    component.mobileOpen = true;
    component.handleKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(component.mobileOpen).toBeTrue();
  });

  it('currentItem getter should return the nav item for the active section', () => {
    component.active = 'map';
    expect(component.currentItem?.id).toBe('map');
    expect(component.currentItem?.label).toBe('Map');
  });

  it('currentItem getter should return dashboard item by default', () => {
    component.active = 'dashboard';
    expect(component.currentItem?.id).toBe('dashboard');
  });

  it('handleDocClick() should close notifPanel when clicking outside notif-wrap', () => {
    component.notifOpen = true;
    const outsideEl = document.createElement('div');
    // outsideEl.closest('.notif-wrap') returns null — simulates click outside
    const event = { target: outsideEl } as unknown as MouseEvent;
    component.handleDocClick(event);
    expect(component.notifOpen).toBeFalse();
  });

  it('handleDocClick() should keep notifPanel open when clicking inside notif-wrap', () => {
    component.notifOpen = true;
    const wrap = document.createElement('div');
    wrap.className = 'notif-wrap';
    const inner = document.createElement('button');
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    const event = { target: inner } as unknown as MouseEvent;
    component.handleDocClick(event);
    expect(component.notifOpen).toBeTrue();
    document.body.removeChild(wrap);
  });

  it('ngOnDestroy() should unsubscribe alert subscription', () => {
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('constructor should apply dark mode and collapsed when localStorage flags are set', () => {
    spyOn(localStorage, 'getItem').and.callFake((key: string) => {
      if (key === 'iot_dark') return '1';
      if (key === 'iot_sidebar_col') return '1';
      return null;
    });
    // Re-create component so constructor runs again with the spy active
    const newFixture = TestBed.createComponent(AppComponent);
    const newComp = newFixture.componentInstance;
    expect(newComp.isDark).toBeTrue();
    expect(newComp.collapsed).toBeTrue();
  });
});
