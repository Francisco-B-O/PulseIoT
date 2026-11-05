import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { DashboardComponent } from './components/dashboard.component';
import { DevicesComponent } from './components/devices.component';
import { TelemetryComponent } from './components/telemetry.component';
import { AlertsComponent } from './components/alerts.component';
import { AnalyticsComponent } from './components/analytics.component';
import { MlComponent } from './components/ml.component';
import { HealthComponent } from './components/health.component';
import { MapComponent } from './components/map.component';
import { LoginComponent } from './components/login.component';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { interval, Subscription, catchError, of } from 'rxjs';

type Section = 'dashboard' | 'devices' | 'telemetry' | 'alerts' | 'analytics' | 'ml' | 'health' | 'map';

interface RecentAlert {
  id: string;
  deviceId: string;
  severity: string;
  message: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatRippleModule,
    DashboardComponent, DevicesComponent, TelemetryComponent,
    AlertsComponent, AnalyticsComponent, MlComponent, HealthComponent, MapComponent, LoginComponent
  ],
  template: `
    <div *ngIf="!authService.isAuthenticated()">
      <app-login></app-login>
    </div>

    <div *ngIf="authService.isAuthenticated()" class="shell">

      <!-- Mobile overlay backdrop -->
      <div class="mobile-backdrop" [class.visible]="mobileOpen" (click)="mobileOpen = false"></div>

      <!-- ── Sidebar ──────────────────────────────────── -->
      <aside class="sidebar" [class.collapsed]="collapsed" [class.mobile-open]="mobileOpen" role="navigation" aria-label="Main navigation">

        <div class="sidebar-top">
          <div class="brand">
            <img class="brand-icon" src="assets/logo.svg" alt="PulseIoT" width="36" height="36">
            <div class="brand-text" *ngIf="!collapsed">
              <span class="brand-name">Pulse<span class="brand-accent">IoT</span></span>
              <span class="brand-ver">STREAMING · ML</span>
            </div>
          </div>
          <button class="collapse-btn" (click)="toggleSidebar()"
                  [matTooltip]="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                  matTooltipPosition="right"
                  [attr.aria-label]="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
            <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </div>

        <div class="nav-group-label" *ngIf="!collapsed">MAIN</div>

        <nav class="nav">
          <a class="nav-item" *ngFor="let item of navItems"
             (click)="go(item.id)"
             [class.active]="active === item.id"
             [matTooltip]="collapsed ? item.label : ''"
             matTooltipPosition="right"
             matRipple matRippleColor="rgba(255,255,255,.06)"
             [attr.aria-current]="active === item.id ? 'page' : null"
             role="button">
            <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
            <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
            <span class="nav-badge" *ngIf="item.id === 'alerts' && alertBadge > 0 && !collapsed">{{ alertBadge }}</span>
            <span class="nav-badge-dot" *ngIf="item.id === 'alerts' && alertBadge > 0 && collapsed"></span>
          </a>
        </nav>

        <div class="sidebar-spacer"></div>

        <!-- User row (expanded) -->
        <div class="sidebar-footer" *ngIf="!collapsed">
          <button class="theme-toggle" (click)="toggleDark()" [matTooltip]="isDark ? 'Light mode' : 'Dark mode'">
            <mat-icon>{{ isDark ? 'light_mode' : 'dark_mode' }}</mat-icon>
            <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>
          <div class="user-row">
            <div class="user-avatar">A</div>
            <div class="user-info">
              <span class="user-name">admin</span>
              <span class="user-role">Administrator</span>
            </div>
            <button class="logout-btn" (click)="logout()" matTooltip="Sign out" aria-label="Sign out">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </div>

        <!-- Collapsed footer -->
        <div class="sidebar-footer-col" *ngIf="collapsed">
          <button class="col-action-btn" (click)="toggleDark()" [matTooltip]="isDark ? 'Light mode' : 'Dark mode'" matTooltipPosition="right">
            <mat-icon>{{ isDark ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button class="col-action-btn" (click)="logout()" matTooltip="Sign out" matTooltipPosition="right" aria-label="Sign out">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </aside>

      <!-- ── Main area ─────────────────────────────────── -->
      <div class="main">

        <!-- Top bar -->
        <header class="topbar" role="banner">
          <button class="hamburger" (click)="mobileOpen = !mobileOpen" aria-label="Toggle navigation">
            <mat-icon>menu</mat-icon>
          </button>

          <div class="topbar-left">
            <div class="breadcrumb">
              <mat-icon class="bc-icon">{{ currentItem?.icon }}</mat-icon>
              <span class="bc-label">{{ currentItem?.label }}</span>
            </div>
          </div>

          <div class="topbar-right">
            <div class="system-pill">
              <span class="status-dot up pulse"></span>
              <span class="pill-label">Live · Streaming</span>
            </div>

            <!-- Notification bell -->
            <div class="notif-wrap" #notifWrap>
              <button class="topbar-icon-btn notif-btn" (click)="toggleNotifPanel()"
                      [attr.aria-label]="'Notifications' + (alertBadge > 0 ? ' — ' + alertBadge + ' pending' : '')"
                      matTooltip="Notifications">
                <mat-icon>notifications</mat-icon>
                <span class="notif-badge" *ngIf="alertBadge > 0">{{ alertBadge > 9 ? '9+' : alertBadge }}</span>
              </button>

              <!-- Notifications dropdown -->
              <div class="notif-panel" *ngIf="notifOpen" role="dialog" aria-label="Notifications panel">
                <div class="notif-header">
                  <span class="notif-title">Notifications</span>
                  <span class="notif-count" *ngIf="recentAlerts.length">{{ alertBadge }} pending</span>
                  <button class="notif-close" (click)="notifOpen = false" aria-label="Close notifications">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <div class="notif-empty" *ngIf="recentAlerts.length === 0">
                  <mat-icon>notifications_none</mat-icon>
                  <p>No pending alerts</p>
                </div>

                <div class="notif-list" *ngIf="recentAlerts.length > 0">
                  <div class="notif-item" *ngFor="let a of recentAlerts"
                       [class.notif-crit]="a.severity === 'CRITICAL'"
                       [class.notif-high]="a.severity === 'HIGH'"
                       (click)="goToAlert(a)">
                    <div class="notif-item-icon">
                      <mat-icon>{{ a.severity === 'CRITICAL' ? 'error' : a.severity === 'HIGH' ? 'warning' : 'info' }}</mat-icon>
                    </div>
                    <div class="notif-item-body">
                      <div class="notif-item-sev">{{ a.severity }}</div>
                      <div class="notif-item-device mono">{{ a.deviceId }}</div>
                      <div class="notif-item-msg">{{ a.message }}</div>
                      <div class="notif-item-ts">{{ a.timestamp | date:'dd/MM HH:mm:ss' }}</div>
                    </div>
                  </div>
                </div>

                <div class="notif-footer" *ngIf="recentAlerts.length > 0">
                  <button class="notif-view-all" (click)="goToAlerts()">
                    View all alerts <mat-icon>chevron_right</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <button class="topbar-icon-btn" (click)="toggleDark()"
                    [matTooltip]="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                    [attr.aria-label]="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
              <mat-icon>{{ isDark ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>
          </div>
        </header>

        <!-- Content -->
        <main class="content" [class.map-active]="active === 'map'" role="main">
          <app-dashboard  *ngIf="active === 'dashboard'"></app-dashboard>
          <app-devices    *ngIf="active === 'devices'"></app-devices>
          <app-telemetry  *ngIf="active === 'telemetry'"></app-telemetry>
          <app-alerts     *ngIf="active === 'alerts'"></app-alerts>
          <app-analytics  *ngIf="active === 'analytics'"></app-analytics>
          <app-ml         *ngIf="active === 'ml'"></app-ml>
          <app-health     *ngIf="active === 'health'"></app-health>
          <app-map        *ngIf="active === 'map'"></app-map>
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* ── Shell ──────────────────────────────────────────────── */
    .shell {
      display: flex; height: 100vh; overflow: hidden;
      background: var(--bg);
      transition: background var(--t-slow);
    }

    /* ── Mobile backdrop ─────────────────────────────────────── */
    .mobile-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.5); z-index: 30;
      backdrop-filter: blur(2px);
      opacity: 0; transition: opacity var(--t-default);
    }
    @media (max-width: 768px) {
      .mobile-backdrop { display: block; }
      .mobile-backdrop.visible { opacity: 1; }
    }

    /* ── Sidebar ─────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w); flex-shrink: 0;
      background: var(--sidebar-bg);
      display: flex; flex-direction: column;
      transition: width var(--t-slow);
      position: relative; z-index: 40;
      border-right: 1px solid rgba(255,255,255,.04);
      overflow: hidden;
    }
    .sidebar.collapsed { width: var(--sidebar-col); }

    @media (max-width: 768px) {
      .sidebar {
        position: fixed; left: 0; top: 0; bottom: 0;
        transform: translateX(-100%); transition: transform var(--t-slow);
        width: var(--sidebar-w) !important;
        box-shadow: var(--shadow-xl);
      }
      .sidebar.mobile-open { transform: translateX(0); }
    }

    .sidebar-top {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,.06);
      flex-shrink: 0;
    }
    .brand { display: flex; align-items: center; gap: 10px; overflow: hidden; }
    .brand-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: block;
      box-shadow: 0 4px 14px rgba(34,211,238,.3);
    }
    .brand-text { display: flex; flex-direction: column; overflow: hidden; }
    .brand-name { font-size: .875rem; font-weight: 700; color: #f1f5f9; letter-spacing: -.01em; white-space: nowrap; }
    .brand-accent { color: #22d3ee; }
    .brand-ver  { font-size: .58rem; letter-spacing: .12em; color: #475569; white-space: nowrap; margin-top: 1px; }
    .collapse-btn {
      background: none; border: none; cursor: pointer; color: #475569;
      padding: 4px; border-radius: 6px; line-height: 1; flex-shrink: 0;
      transition: color var(--t-fast), background var(--t-fast);
    }
    .collapse-btn:hover { color: #94a3b8; background: rgba(255,255,255,.06); }
    .collapse-btn mat-icon { font-size: 18px; width: 18px; height: 18px; display: block; }

    .nav-group-label {
      font-size: .58rem; font-weight: 700; letter-spacing: .12em;
      color: #334155; padding: 14px 16px 4px; text-transform: uppercase; white-space: nowrap;
      flex-shrink: 0;
    }

    .nav {
      flex: 1; padding: 6px 8px;
      display: flex; flex-direction: column; gap: 1px;
      overflow-y: auto; overflow-x: hidden;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 8px; cursor: pointer;
      color: var(--sidebar-text); text-decoration: none;
      transition: background var(--t-fast), color var(--t-fast);
      position: relative; overflow: hidden; white-space: nowrap;
      font-size: .875rem; font-weight: 500; user-select: none;
    }
    .nav-item:hover { background: var(--sidebar-hover); color: #e2e8f0; }
    .nav-item.active { background: linear-gradient(90deg, rgba(34,211,238,.16), rgba(34,211,238,.02)); color: #67e8f9; }
    .nav-item.active::before {
      content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
      width: 3px; background: #22d3ee; box-shadow: 0 0 10px #22d3ee; border-radius: 0 3px 3px 0;
    }
    .nav-icon { font-size: 19px; width: 19px; height: 19px; flex-shrink: 0; }
    .nav-label { flex: 1; }
    .nav-badge {
      background: var(--rose); color: #fff;
      font-size: .62rem; font-weight: 700; padding: 2px 6px;
      border-radius: 10px; min-width: 18px; text-align: center; flex-shrink: 0;
    }
    .nav-badge-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--rose);
      position: absolute; top: 8px; right: 8px; flex-shrink: 0;
      box-shadow: 0 0 0 2px var(--sidebar-bg);
    }

    .sidebar-spacer { flex: 1; }

    .sidebar-footer {
      padding: 10px 12px 14px;
      border-top: 1px solid rgba(255,255,255,.06);
      display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
    }
    .theme-toggle {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px; padding: 7px 10px; cursor: pointer; color: #94a3b8;
      font-family: 'Inter', sans-serif; font-size: .78rem; font-weight: 500;
      width: 100%; transition: background var(--t-fast), color var(--t-fast);
    }
    .theme-toggle:hover { background: rgba(255,255,255,.09); color: #f1f5f9; }
    .theme-toggle mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .user-row { display: flex; align-items: center; gap: 8px; }
    .user-avatar {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--indigo), var(--violet));
      color: #fff; font-size: .8rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .user-info { flex: 1; min-width: 0; }
    .user-name { display: block; font-size: .8rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { display: block; font-size: .625rem; color: #475569; }
    .logout-btn {
      background: none; border: none; cursor: pointer; color: #475569;
      padding: 5px; border-radius: 6px; line-height: 1;
      transition: color var(--t-fast), background var(--t-fast);
    }
    .logout-btn:hover { color: var(--rose); background: rgba(239,68,68,.1); }
    .logout-btn mat-icon { font-size: 17px; width: 17px; height: 17px; display: block; }

    .sidebar-footer-col {
      padding: 10px 8px 14px;
      border-top: 1px solid rgba(255,255,255,.06);
      display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;
    }
    .col-action-btn {
      background: none; border: none; cursor: pointer; color: #475569;
      padding: 8px; border-radius: 8px; line-height: 1;
      transition: color var(--t-fast), background var(--t-fast);
      display: flex; align-items: center; justify-content: center;
    }
    .col-action-btn:hover { color: #94a3b8; background: rgba(255,255,255,.06); }
    .col-action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; display: block; }

    /* ── Main area ───────────────────────────────────────────── */
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

    .topbar {
      height: var(--topbar-h); flex-shrink: 0;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem; gap: 1rem;
      transition: background var(--t-slow), border-color var(--t-slow);
      position: relative; z-index: 1000;
    }
    .hamburger {
      display: none; background: none; border: none; cursor: pointer;
      color: var(--text-secondary); padding: 6px;
      border-radius: var(--radius-sm); line-height: 1;
    }
    @media (max-width: 768px) { .hamburger { display: flex; } }
    .hamburger mat-icon { font-size: 22px; width: 22px; height: 22px; }

    .topbar-left { display: flex; align-items: center; gap: .75rem; }
    .breadcrumb  { display: flex; align-items: center; gap: 8px; }
    .bc-icon  { font-size: 18px; width: 18px; height: 18px; color: var(--indigo); }
    .bc-label { font-size: .9375rem; font-weight: 700; color: var(--text-primary); }

    .topbar-right { display: flex; align-items: center; gap: .75rem; margin-left: auto; }
    .system-pill {
      display: flex; align-items: center; gap: 6px;
      font-size: .75rem; font-weight: 500; color: var(--text-secondary);
      background: var(--surface-2); padding: 5px 12px;
      border-radius: var(--radius-full); border: 1px solid var(--border);
    }
    .pill-label { white-space: nowrap; }
    @media (max-width: 480px) { .pill-label { display: none; } }

    .topbar-icon-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-secondary); padding: 7px;
      border-radius: var(--radius-md); line-height: 1;
      display: flex; align-items: center;
      transition: color var(--t-fast), background var(--t-fast);
    }
    .topbar-icon-btn:hover { color: var(--text-primary); background: var(--surface-2); }
    .topbar-icon-btn mat-icon { font-size: 20px; width: 20px; height: 20px; display: block; }

    @media (min-width: 769px) { .topbar-icon-btn { display: flex; } }

    /* ── Notification bell ──────────────────────────────────── */
    .notif-wrap { position: relative; }
    .notif-btn { position: relative; }
    .notif-badge {
      position: absolute; top: 2px; right: 2px;
      background: var(--rose); color: #fff;
      font-size: .55rem; font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px; padding: 0 3px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--surface);
      line-height: 1;
    }

    /* Notification panel dropdown */
    .notif-panel {
      position: absolute; top: calc(100% + 8px); right: 0;
      width: 340px; max-height: 460px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);
      display: flex; flex-direction: column;
      z-index: 9999; overflow: hidden;
      animation: notifIn .18s ease;
    }
    @keyframes notifIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: none; } }
    @media (max-width: 480px) { .notif-panel { width: calc(100vw - 2rem); right: -1rem; } }

    .notif-header {
      display: flex; align-items: center; gap: .5rem;
      padding: .875rem 1rem; border-bottom: 1px solid var(--border-2);
      flex-shrink: 0;
    }
    .notif-title { font-size: .9rem; font-weight: 700; color: var(--text-primary); flex: 1; }
    .notif-count { font-size: .72rem; font-weight: 600; color: var(--rose); }
    .notif-close {
      background: none; border: none; cursor: pointer; color: var(--text-muted);
      padding: 3px; border-radius: 5px; line-height: 1;
      transition: color var(--t-fast), background var(--t-fast);
    }
    .notif-close:hover { color: var(--text-primary); background: var(--surface-2); }
    .notif-close mat-icon { font-size: 16px; width: 16px; height: 16px; display: block; }

    .notif-empty {
      display: flex; flex-direction: column; align-items: center; gap: .5rem;
      padding: 2rem 1rem; color: var(--text-muted);
    }
    .notif-empty mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .4; }
    .notif-empty p { font-size: .82rem; margin: 0; }

    .notif-list { overflow-y: auto; flex: 1; max-height: 340px; }
    .notif-item {
      display: flex; gap: .75rem; align-items: flex-start;
      padding: .75rem 1rem; border-bottom: 1px solid var(--border-2);
      cursor: pointer; transition: background var(--t-fast);
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: var(--surface-2); }
    .notif-item.notif-crit { border-left: 3px solid #ef4444; }
    .notif-item.notif-high { border-left: 3px solid #f97316; }

    .notif-item-icon mat-icon {
      font-size: 18px; width: 18px; height: 18px; margin-top: 2px;
    }
    .notif-crit .notif-item-icon mat-icon { color: #ef4444; }
    .notif-high .notif-item-icon mat-icon { color: #f97316; }
    .notif-item-icon mat-icon { color: var(--text-muted); }

    .notif-item-body { flex: 1; min-width: 0; }
    .notif-item-sev {
      font-size: .65rem; font-weight: 700; letter-spacing: .06em;
      color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;
    }
    .notif-crit .notif-item-sev { color: #ef4444; }
    .notif-high .notif-item-sev { color: #f97316; }
    .notif-item-device { font-size: .8rem; font-weight: 600; color: var(--indigo); font-family: 'JetBrains Mono', 'Roboto Mono', monospace; }
    .notif-item-msg { font-size: .78rem; color: var(--text-secondary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .notif-item-ts { font-size: .7rem; color: var(--text-muted); margin-top: 3px; }

    .notif-footer {
      padding: .625rem 1rem; border-top: 1px solid var(--border-2); flex-shrink: 0;
    }
    .notif-view-all {
      display: flex; align-items: center; gap: 2px; width: 100%;
      background: none; border: none; cursor: pointer;
      color: var(--indigo); font-size: .8rem; font-weight: 600;
      font-family: 'Inter', sans-serif; padding: 0;
      transition: opacity var(--t-fast);
    }
    .notif-view-all:hover { opacity: .75; }
    .notif-view-all mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Content */
    .content { flex: 1; overflow-y: auto; }
    .content.map-active { overflow: hidden; }
    app-map { display: block; height: 100%; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  collapsed = false;
  mobileOpen = false;
  isDark = false;
  active: Section = 'dashboard';
  alertBadge = 0;
  notifOpen = false;
  recentAlerts: RecentAlert[] = [];
  private alertSub?: Subscription;

  navItems = [
    { id: 'dashboard' as Section, label: 'Dashboard',   icon: 'dashboard' },
    { id: 'devices'   as Section, label: 'Devices',     icon: 'router' },
    { id: 'telemetry' as Section, label: 'Telemetry',   icon: 'sensors' },
    { id: 'alerts'    as Section, label: 'Alerts',      icon: 'notifications_active' },
    { id: 'analytics' as Section, label: 'Analytics',   icon: 'bar_chart' },
    { id: 'ml'        as Section, label: 'ML Platform', icon: 'psychology' },
    { id: 'health'    as Section, label: 'Health',      icon: 'monitor_heart' },
    { id: 'map'       as Section, label: 'Map',         icon: 'map' },
  ];

  get currentItem() { return this.navItems.find(n => n.id === this.active); }

  constructor(public authService: AuthService, private api: ApiService) {
    const dark = localStorage.getItem('iot_dark');
    if (dark !== '0') { this.isDark = true; document.body.classList.add('dark-mode'); }
    const hash = location.hash.replace('#', '') as Section;
    if (this.navItems.some(n => n.id === hash)) this.active = hash;
    const col = localStorage.getItem('iot_sidebar_col');
    if (col === '1') this.collapsed = true;
  }

  ngOnInit() {
    this.pollAlertBadge();
    this.alertSub = interval(30000).subscribe(() => this.pollAlertBadge());
  }

  ngOnDestroy() { this.alertSub?.unsubscribe(); }

  private pollAlertBadge() {
    if (!this.authService.isAuthenticated()) return;
    this.api.getAlerts().pipe(catchError(() => of([]))).subscribe(alerts => {
      const pending = alerts.filter((x: any) => !x.acknowledged);
      this.alertBadge = pending.length;
      // Keep latest 10 unacknowledged sorted by timestamp desc for the panel
      const sorted = [...pending].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.recentAlerts = sorted.slice(0, 10);
    });
  }

  toggleNotifPanel() {
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) this.pollAlertBadge();
  }

  goToAlert(a: RecentAlert) {
    this.notifOpen = false;
    this.active = 'alerts';
  }

  goToAlerts() {
    this.notifOpen = false;
    this.active = 'alerts';
  }

  toggleDark() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark-mode', this.isDark);
    localStorage.setItem('iot_dark', this.isDark ? '1' : '0');
  }

  toggleSidebar() {
    this.collapsed = !this.collapsed;
    localStorage.setItem('iot_sidebar_col', this.collapsed ? '1' : '0');
  }

  go(id: Section) {
    this.active = id;
    history.replaceState(null, '', '#' + id);
    this.mobileOpen = false;
  }

  logout() { this.authService.logout(); }

  @HostListener('window:keydown', ['$event'])
  handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { this.mobileOpen = false; this.notifOpen = false; }
  }

  @HostListener('document:click', ['$event'])
  handleDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (this.notifOpen && !target.closest('.notif-wrap')) {
      this.notifOpen = false;
    }
  }
}
