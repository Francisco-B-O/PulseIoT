import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start unauthenticated when localStorage is empty', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeNull();
  });

  it('should restore session from localStorage on init', () => {
    localStorage.setItem('currentUser', JSON.stringify({ token: 'saved-token', username: 'admin' }));
    // Re-create the service so the constructor re-reads localStorage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [AuthService] });
    const freshService = TestBed.inject(AuthService);
    TestBed.inject(HttpTestingController);

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(freshService.getToken()).toBe('saved-token');
  });

  it('login() should POST credentials and store user in localStorage', () => {
    const mockUser = { token: 'jwt-abc', username: 'admin' };

    service.login('admin', 'admin123').subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = http.expectOne(r => r.url.includes('/auth/login'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'admin', password: 'admin123' });
    req.flush(mockUser);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.getToken()).toBe('jwt-abc');
    expect(JSON.parse(localStorage.getItem('currentUser')!).token).toBe('jwt-abc');
  });

  it('login() should update currentUser$ observable', (done) => {
    const mockUser = { token: 'jwt-xyz', username: 'admin' };

    service.currentUser$.subscribe(user => {
      if (user) {
        expect(user.token).toBe('jwt-xyz');
        done();
      }
    });

    service.login('admin', 'admin123').subscribe();
    http.expectOne(r => r.url.includes('/auth/login')).flush(mockUser);
  });

  it('logout() should clear localStorage and unauthenticate', () => {
    localStorage.setItem('currentUser', JSON.stringify({ token: 'tok', username: 'admin' }));
    // Manually set the subject state
    service.login('admin', 'x').subscribe();
    http.expectOne(r => r.url.includes('/auth/login')).flush({ token: 'tok' });

    service.logout();

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('currentUser', 'not-valid-json');
    // Re-create so constructor handles the bad data
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [AuthService] });
    const freshService = TestBed.inject(AuthService);
    TestBed.inject(HttpTestingController);

    expect(freshService.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });
});
