import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './app/services/auth.service';
import { environment } from './environments/environment';
import { demoInterceptor } from './app/demo/demo.interceptor';

const authInterceptor = (req: any, next: any) => {
  const auth = inject(AuthService);
  // An expired/invalid token on an authenticated call means the session is over.
  const handle401 = catchError((err: HttpErrorResponse) => {
    if (err.status === 401 && !req.url.includes('/auth/login')) auth.logout();
    return throwError(() => err);
  });
  try {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.token;
      if (token) {
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(handle401);
      }
    }
  } catch {
    localStorage.removeItem('currentUser');
  }
  return next(req);
};

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(withInterceptors(environment.demo ? [demoInterceptor] : [authInterceptor]))
  ]
}).catch((err) => console.error(err));
