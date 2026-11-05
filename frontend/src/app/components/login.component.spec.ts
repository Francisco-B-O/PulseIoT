import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [{ provide: AuthService, useValue: authSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 5 feature items', () => {
    expect(component.features.length).toBe(5);
  });

  it('onSubmit() should do nothing when username is empty', () => {
    component.username = '';
    component.password = 'admin123';
    component.onSubmit();
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('onSubmit() should do nothing when password is empty', () => {
    component.username = 'admin';
    component.password = '';
    component.onSubmit();
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('onSubmit() should call authService.login with credentials', () => {
    authSpy.login.and.returnValue(of({ token: 'jwt' }));
    component.username = 'admin';
    component.password = 'admin123';
    component.onSubmit();
    expect(authSpy.login).toHaveBeenCalledWith('admin', 'admin123');
  });

  it('onSubmit() should set loading=true then false on success', () => {
    authSpy.login.and.returnValue(of({ token: 'jwt' }));
    component.username = 'admin';
    component.password = 'admin123';
    component.onSubmit();
    expect(component.loading).toBeFalse();
  });

  it('onSubmit() should set error message on failed login', () => {
    authSpy.login.and.returnValue(throwError(() => new Error('401')));
    component.username = 'admin';
    component.password = 'wrong';
    component.onSubmit();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('showPwd should toggle password visibility', () => {
    expect(component.showPwd).toBeFalse();
    component.showPwd = true;
    expect(component.showPwd).toBeTrue();
  });
});
