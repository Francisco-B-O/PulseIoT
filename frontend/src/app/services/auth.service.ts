import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private gatewayUrl = `${environment.apiGatewayUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    try {
      const user = localStorage.getItem('currentUser');
      if (user) {
        this.currentUserSubject.next(JSON.parse(user));
      }
    } catch {
      localStorage.removeItem('currentUser');
    }
    // Static demo: start signed-in so visitors land straight on the dashboard.
    if (environment.demo && !this.currentUserSubject.value) {
      this.currentUserSubject.next({ token: 'demo-token', username: 'admin', roles: ['ROLE_ADMIN'] });
    }
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.gatewayUrl}/login`, { username, password })
      .pipe(tap(user => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }));
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    const user = this.currentUserSubject.value;
    return user ? user.token : null;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }
}
