import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="login-shell">

      <!-- Left branding panel -->
      <div class="login-left" role="complementary" aria-label="Platform information">
        <div class="brand">
          <img class="brand-icon" src="assets/logo.svg" alt="PulseIoT" width="40" height="40">
          <span class="brand-name">Pulse<span style="color:#22d3ee">IoT</span></span>
        </div>

        <div class="tagline">
          <h1>Real-time IoT<br><span class="grad">anomaly detection</span></h1>
          <p>An event-driven platform: telemetry flows through Kafka and Spark, an ML ensemble flags anomalies, and this dashboard shows it all live.</p>
        </div>

        <div class="feature-list">
          <div class="feature" *ngFor="let f of features">
            <div class="feature-icon">
              <mat-icon>{{ f.icon }}</mat-icon>
            </div>
            <div class="feature-text">
              <span class="feature-title">{{ f.title }}</span>
              <span class="feature-sub">{{ f.sub }}</span>
            </div>
          </div>
        </div>

        <div class="left-footer">
          <span class="left-footer-text">Kafka · Spring Boot · PySpark · FastAPI · Angular</span>
        </div>
      </div>

      <!-- Right login panel -->
      <div class="login-right">
        <div class="login-card" role="main">
          
          <div class="login-header">
            <h2>Sign in</h2>
            <p>Access the control center</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="login-form" aria-label="Sign in form">

            <div class="field-group" [class.has-error]="!!error">
              <label for="username">Username</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">person_outline</mat-icon>
                <input id="username" [(ngModel)]="username" name="username" type="text"
                       placeholder="admin" autocomplete="username" required
                       [attr.aria-invalid]="!!error" />
              </div>
            </div>

            <div class="field-group" [class.has-error]="!!error">
              <label for="password">Password</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input id="password" [(ngModel)]="password" name="password"
                       [type]="showPwd ? 'text' : 'password'"
                       placeholder="••••••••" autocomplete="current-password" required
                       [attr.aria-invalid]="!!error" />
                <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd"
                        [attr.aria-label]="showPwd ? 'Hide password' : 'Show password'">
                  <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>

            <div class="error-msg" *ngIf="error" role="alert" aria-live="polite">
              <mat-icon>error_outline</mat-icon> {{ error }}
            </div>

            <button type="submit" class="submit-btn"
                    [disabled]="loading || !username || !password"
                    [attr.aria-busy]="loading">
              <mat-spinner *ngIf="loading" diameter="18" class="btn-spinner"></mat-spinner>
              <mat-icon *ngIf="!loading">login</mat-icon>
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>

          <div class="hint-box" *ngIf="demo">
            <mat-icon>info_outline</mat-icon>
            <span>Demo access: <code>admin / admin123</code></span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh; display: flex;
      font-family: 'Inter', sans-serif;
      background: #070b14;
    }

    /* ── Left panel ─────────────────────────────────────────── */
    .login-left {
      flex: 1; min-width: 0;
      background: #060a13;
      padding: 3rem; display: flex; flex-direction: column; justify-content: space-between;
      position: relative; overflow: hidden;
    }
    .login-left::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 30% 50%, rgba(34,211,238,.14) 0%, transparent 60%),
                  radial-gradient(ellipse at 80% 20%, rgba(139,92,246,.12) 0%, transparent 50%),
                  linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 44px 44px,
                  linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 44px 44px;
      -webkit-mask-image: linear-gradient(180deg, #000 55%, rgba(0,0,0,.55));
    }
    @media (max-width: 768px) { .login-left { display: none; } }

    .brand { display: flex; align-items: center; gap: .75rem; z-index: 1; }
    .brand-icon {
      width: 40px; height: 40px; border-radius: 11px;
      display: block;
      box-shadow: 0 4px 18px rgba(34,211,238,.3);
    }
    .brand-name { font-size: 1rem; font-weight: 700; color: #f1f5f9; }

    .tagline { z-index: 1; }
    .tagline h1 {
      font-size: 2.75rem; font-weight: 800; color: #f8fafc;
      line-height: 1.15; letter-spacing: -.035em; margin: 0 0 1rem;
    }
    .tagline .grad { background: linear-gradient(90deg, #22d3ee, #a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .tagline h1, .brand-name, .login-header h2 { font-family: 'Space Grotesk', 'Inter', sans-serif; }
    .tagline p { color: #94a3b8; font-size: .9375rem; line-height: 1.7; margin: 0; max-width: 380px; }

    .feature-list { display: flex; flex-direction: column; gap: 1rem; z-index: 1; }
    .feature { display: flex; align-items: center; gap: .875rem; }
    .feature-icon {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      background: rgba(34,211,238,.1); border: 1px solid rgba(34,211,238,.25);
      display: flex; align-items: center; justify-content: center;
    }
    .feature-icon mat-icon { font-size: 17px; width: 17px; height: 17px; color: #22d3ee; }
    .feature-text { display: flex; flex-direction: column; gap: 1px; }
    .feature-title { font-size: .875rem; font-weight: 600; color: #e2e8f0; }
    .feature-sub   { font-size: .75rem; color: #64748b; }

    .left-footer { z-index: 1; }
    .left-footer-text { font-size: .72rem; color: #334155; }

    /* ── Right panel ────────────────────────────────────────── */
    .login-right {
      width: 460px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #0d1424; padding: 2rem;
      border-left: 1px solid #1c2740;
    }
    @media (max-width: 768px) { .login-right { width: 100%; box-shadow: none; } }
    @media (min-width: 769px) and (max-width: 1024px) { .login-right { width: 400px; } }

    .login-card { width: 100%; max-width: 380px; }

    .login-logo {
      display: flex; justify-content: center; margin-bottom: 1.5rem;
    }
    .logo-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, #22d3ee, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px rgba(8,145,178,.35);
    }
    .logo-icon mat-icon { font-size: 28px; width: 28px; height: 28px; color: #fff; }

    .login-header { text-align: center; margin-bottom: 2rem; }
    .login-header h2 { font-size: 1.75rem; font-weight: 700; color: #e8eefc; margin: 0 0 .375rem; letter-spacing: -.03em; }
    .login-header p  { color: #9fb0cf; font-size: .875rem; margin: 0; }

    /* Form */
    .login-form { display: flex; flex-direction: column; gap: 1.125rem; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-group label { font-size: .8rem; font-weight: 600; color: #9fb0cf; }
    .field-group.has-error .input-wrap { border-color: #ef4444; }

    .input-wrap {
      display: flex; align-items: center; gap: 8px;
      background: #070b14; border: 1.5px solid #1c2740; border-radius: 10px;
      padding: 0 14px; transition: border-color .15s, box-shadow .15s;
    }
    .input-wrap:focus-within {
      border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,.15);
    }
    .input-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
    .input-wrap input {
      flex: 1; border: none; outline: none; padding: 13px 0;
      font-family: 'Inter', sans-serif; font-size: .9rem; color: #e8eefc;
      background: transparent;
    }
    .input-wrap input::placeholder { color: #3d4a66; }

    .pwd-toggle {
      background: none; border: none; cursor: pointer;
      color: #94a3b8; padding: 0; line-height: 1; transition: color .15s;
    }
    .pwd-toggle:hover { color: #22d3ee; }
    .pwd-toggle mat-icon { font-size: 18px; width: 18px; height: 18px; display: block; }

    .error-msg {
      display: flex; align-items: center; gap: 6px;
      background: rgba(239,68,68,.14); color: #fca5a5;
      padding: 10px 14px; border-radius: 8px; font-size: .8rem; font-weight: 500;
      animation: fadeUp .2s ease;
    }
    .error-msg mat-icon { font-size: 16px; width: 16px; height: 16px; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .submit-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      background: linear-gradient(135deg, #22d3ee, #0891b2); color: #04202a;
      border: none; border-radius: 10px; padding: 14px;
      font-size: .9375rem; font-weight: 600; font-family: 'Inter', sans-serif;
      cursor: pointer; transition: opacity .15s, box-shadow .15s, transform .15s;
      box-shadow: 0 6px 22px rgba(34,211,238,.28); margin-top: 4px;
      width: 100%;
    }
    .submit-btn:hover:not(:disabled) {
      opacity: .92; transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(8,145,178,.5);
    }
    .submit-btn:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; transform: none; }
    .submit-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .btn-spinner { margin: 0 !important; }
    ::ng-deep .btn-spinner circle { stroke: #fff !important; }

    .hint-box {
      display: flex; align-items: center; gap: 6px; justify-content: center;
      margin-top: 1.25rem; padding: .625rem 1rem;
      background: #0a101d; border: 1px solid #1c2740; border-radius: 8px;
      font-size: .75rem; color: #9fb0cf;
    }
    .hint-box mat-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; flex-shrink: 0; }
    .hint-box code {
      background: #1c2740; padding: 2px 6px; border-radius: 4px;
      color: #67e8f9; font-size: .8em; font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
    }
  `]
})
export class LoginComponent {
  demo = environment.demo;
  username = ''; password = ''; error = ''; loading = false; showPwd = false;

  features = [
    { icon: 'router',        title: 'Device Management',      sub: 'Register & monitor IoT sensors' },
    { icon: 'sensors',       title: 'Telemetry Ingestion',    sub: 'Kafka + PySpark rolling-window features' },
    { icon: 'psychology',    title: 'ML Anomaly Detection',   sub: 'IsolationForest + Z-score + trend ensemble' },
    { icon: 'notifications', title: 'Intelligent Alerting',   sub: 'Threshold-based alert rules' },
    { icon: 'bar_chart',     title: 'Analytics',              sub: 'Redis-backed event counters' },
  ];

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.username || !this.password) return;
    this.loading = true; this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: () => { this.loading = false; },
      error: () => {
        this.error = this.demo ? 'Invalid credentials. Try admin / admin123' : 'Invalid username or password';
        this.loading = false;
      }
    });
  }
}
