import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ApiService } from '../services/api.service';
import { interval, Subscription, catchError, of, forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, NgxChartsModule],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>dashboard</mat-icon> Dashboard</h2>
          <p class="subtitle">Real-time platform overview · Auto-refreshes every 15s</p>
        </div>
        <div class="head-actions">
          <button class="btn-outline" (click)="refreshData()" [disabled]="loading" aria-label="Refresh dashboard">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            Refresh
          </button>
          <button class="btn-primary" (click)="trainModel()" [disabled]="training">
            <mat-icon>{{ training ? 'hourglass_empty' : 'auto_fix_high' }}</mat-icon>
            {{ training ? 'Training…' : 'Retrain ML' }}
          </button>
        </div>
      </div>

      <!-- KPI Skeleton -->
      <div class="kpi-grid" *ngIf="loading && deviceCount === 0">
        <div class="kpi" *ngFor="let i of [1,2,3,4,5,6]">
          <div class="kpi-accent-bar indigo skeleton" style="height:3px;top:0;border-radius:0"></div>
          <div class="skeleton skel-kpi" style="height:44px;width:44px;border-radius:10px;margin-bottom:6px"></div>
          <div class="skeleton skel-text" style="width:60%;margin-bottom:5px"></div>
          <div class="skeleton skel-title" style="width:40%;margin-bottom:4px"></div>
          <div class="skeleton skel-text" style="width:50%"></div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" *ngIf="!loading || deviceCount > 0">
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar indigo"></div>
          <div class="kpi-icon indigo"><mat-icon>router</mat-icon></div>
          <div class="kpi-label">Total Devices</div>
          <div class="kpi-value">{{ deviceCount }}</div>
          <div class="kpi-sub">Registered in system</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar rose"></div>
          <div class="kpi-icon rose"><mat-icon>notifications_active</mat-icon></div>
          <div class="kpi-label">Pending Alerts</div>
          <div class="kpi-value rose">{{ pendingAlerts }}</div>
          <div class="kpi-sub">Unacknowledged</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar amber"></div>
          <div class="kpi-icon amber"><mat-icon>error_outline</mat-icon></div>
          <div class="kpi-label">Critical</div>
          <div class="kpi-value amber">{{ criticalAlerts }}</div>
          <div class="kpi-sub">High severity</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar emerald"></div>
          <div class="kpi-icon emerald"><mat-icon>psychology</mat-icon></div>
          <div class="kpi-label">ML Events</div>
          <div class="kpi-value">{{ mlEvents }}</div>
          <div class="kpi-sub">Processed total</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar" [class.emerald]="mlOnline" [class.rose]="!mlOnline"></div>
          <div class="kpi-icon" [class.emerald]="mlOnline" [class.rose]="!mlOnline">
            <mat-icon>{{ mlOnline ? 'check_circle' : 'cloud_off' }}</mat-icon>
          </div>
          <div class="kpi-label">ML Platform</div>
          <div class="kpi-value" [class.emerald]="mlOnline" [class.rose]="!mlOnline" style="font-size:1.3rem;margin-top:3px">
            {{ mlOnline ? 'Online' : 'Offline' }}
          </div>
          <div class="kpi-sub">API status</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="kpi-accent-bar violet"></div>
          <div class="kpi-icon violet"><mat-icon>checklist</mat-icon></div>
          <div class="kpi-label">Total Alerts</div>
          <div class="kpi-value">{{ totalAlerts }}</div>
          <div class="kpi-sub">All time</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <!-- Severity distribution -->
        <div class="chart-card card">
          <div class="chart-card-header">
            <span class="chart-title">Alert Severity Distribution</span>
            <span class="badge" [ngClass]="totalAlerts > 0 ? 'info' : 'ack'">{{ totalAlerts }} total</span>
          </div>
          <div class="chart-body">
            <div class="chart-empty" *ngIf="severityData.length === 0">
              <mat-icon>pie_chart_outline</mat-icon>
              <p>No alerts yet. Send telemetry to generate alerts.</p>
            </div>
            <ngx-charts-pie-chart *ngIf="severityData.length > 0"
              [results]="severityData"
              [legend]="true" [labels]="true"
              [scheme]="pieScheme" [doughnut]="true"
              style="display:block;height:260px">
            </ngx-charts-pie-chart>
          </div>
        </div>

        <!-- Devices overview -->
        <div class="chart-card card">
          <div class="chart-card-header">
            <span class="chart-title">Alerts by Device</span>
            <span class="badge info">{{ deviceCount }} devices</span>
          </div>
          <div class="chart-body">
            <div class="chart-empty" *ngIf="deviceBarData.length === 0">
              <mat-icon>bar_chart</mat-icon>
              <p>No alerts per device yet.</p>
            </div>
            <ngx-charts-bar-vertical *ngIf="deviceBarData.length > 0"
              [results]="deviceBarData"
              [xAxis]="true" [yAxis]="false"
              [showXAxisLabel]="false"
              [scheme]="barScheme"
              [roundEdges]="true"
              style="display:block;height:260px">
            </ngx-charts-bar-vertical>
          </div>
        </div>
      </div>

      <!-- Recent alerts -->
      <div class="card recent-card" *ngIf="recentAlerts.length > 0" style="margin-top:1.25rem">
        <div class="card-header">
          <div class="card-title-wrap">
            <span class="card-title-text">Recent Alerts</span>
            <span class="badge pending" *ngIf="pendingAlerts > 0">{{ pendingAlerts }} pending</span>
          </div>
          <span class="auto-ref-hint">
            <mat-icon>sync</mat-icon> Auto-refresh 15s
          </span>
        </div>
        <div class="recent-list">
          <div class="recent-row" *ngFor="let a of recentAlerts"
               [class.row-crit-bg]="a.severity === 'HIGH' && !a.acknowledged">
            <span class="sev-dot" [class]="'sev-' + a.severity?.toLowerCase()"></span>
            <span class="badge" [class]="a.severity?.toLowerCase()">{{ a.severity }}</span>
            <span class="mono recent-device">{{ a.deviceId }}</span>
            <span class="recent-msg">{{ a.message }}</span>
            <span class="recent-time">{{ a.timestamp | date:'HH:mm:ss' }}</span>
            <span class="badge" [class]="a.acknowledged ? 'ack' : 'pending'">
              {{ a.acknowledged ? 'ACK' : 'PENDING' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }
    .head-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }

    .chart-card { background: var(--surface); }
    .chart-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-2);
    }
    .chart-title { font-size: .9rem; font-weight: 600; color: var(--text-primary); }
    .chart-body { padding: .75rem 1.25rem 1.25rem; }

    /* Recent alerts */
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: .875rem 1.25rem; border-bottom: 1px solid var(--border-2);
    }
    .card-title-wrap { display: flex; align-items: center; gap: .5rem; }
    .card-title-text { font-size: .9rem; font-weight: 600; color: var(--text-primary); }
    .auto-ref-hint {
      display: flex; align-items: center; gap: 4px;
      font-size: .7rem; color: var(--text-muted);
    }
    .auto-ref-hint mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .recent-list { display: flex; flex-direction: column; }
    .recent-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .75rem 1.25rem; border-bottom: 1px solid var(--border-2);
      font-size: .82rem; transition: background var(--t-fast);
    }
    .recent-row:last-child { border-bottom: none; }
    .recent-row:hover { background: var(--surface-2); }
    .recent-row.row-crit-bg { background: rgba(239,68,68,.025); }
    .sev-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .sev-critical { background: #ef4444; }
    .sev-high     { background: #f97316; }
    .sev-medium   { background: #f59e0b; }
    .sev-low      { background: #8b5cf6; }
    .recent-device { color: var(--indigo); font-weight: 600; white-space: nowrap; font-size: .8rem; }
    .recent-msg  { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recent-time { color: var(--text-muted); white-space: nowrap; font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .75rem; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  deviceCount = 0; pendingAlerts = 0; totalAlerts = 0;
  criticalAlerts = 0; mlEvents = 0; mlOnline = false;
  loading = false; training = false;
  severityData: any[] = [];
  deviceBarData: any[] = [];
  recentAlerts: any[] = [];
  private sub?: Subscription;

  pieScheme: any = { domain: ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#0ea5e9', '#10b981'] };
  barScheme: any = { domain: ['#06b6d4', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899'] };

  constructor(private api: ApiService) {}

  ngOnInit() { this.refreshData(); this.sub = interval(15000).subscribe(() => this.refreshData()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }

  refreshData() {
    this.loading = true;
    forkJoin({
      devices: this.api.getDevices().pipe(catchError(() => of([]))),
      alerts:  this.api.getAlerts().pipe(catchError(() => of([]))),
      ml:      this.api.getMlStats().pipe(catchError(() => of(null))),
      mlH:     this.api.getMlHealth().pipe(catchError(() => of(null)))
    }).subscribe(({ devices, alerts, ml, mlH }) => {
      this.deviceCount    = devices.length;
      this.totalAlerts    = alerts.length;
      this.pendingAlerts  = alerts.filter((a: any) => !a.acknowledged).length;
      this.criticalAlerts = alerts.filter((a: any) => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;
      this.mlEvents       = ml?.total_events ?? 0;
      this.mlOnline       = !!mlH;
      this.recentAlerts   = [...alerts]
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);

      const sev: Record<string, number> = {};
      alerts.forEach((a: any) => { sev[a.severity] = (sev[a.severity] || 0) + 1; });
      this.severityData  = Object.entries(sev).map(([name, value]) => ({ name, value }));
      const perDevice: Record<string, number> = {};
      alerts.forEach((a: any) => { perDevice[a.deviceId] = (perDevice[a.deviceId] || 0) + 1; });
      this.deviceBarData = Object.entries(perDevice)
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([name, value]) => ({ name, value }));
      this.loading = false;
    });
  }

  trainModel() {
    this.training = true;
    this.api.trainModel().subscribe({
      next: () => { this.training = false; this.refreshData(); },
      error: () => { this.training = false; }
    });
  }
}
