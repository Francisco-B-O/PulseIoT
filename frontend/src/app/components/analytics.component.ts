import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ApiService } from '../services/api.service';
import { catchError, forkJoin, of, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, NgxChartsModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>bar_chart</mat-icon> Analytics</h2>
          <p class="subtitle">Device event statistics and telemetry history</p>
        </div>
        <button class="icon-btn" (click)="loadAll()" [disabled]="loading"
                matTooltip="Refresh data" aria-label="Refresh analytics data">
          <mat-icon [class.spin]="loading">refresh</mat-icon>
        </button>
      </div>

      <!-- Device selector -->
      <div class="selector-card card">
        <div class="selector-inner">
          <div class="field" style="flex:1;min-width:240px">
            <label for="device-select">Analyze Device</label>
            <select id="device-select" [(ngModel)]="selectedDeviceId"
                    (ngModelChange)="onDeviceChange()" class="select-input"
                    [disabled]="devices.length === 0">
              <option value="" disabled>Select a device…</option>
              <option *ngFor="let d of devices" [value]="d.deviceId">
                {{ d.deviceId }} · {{ d.type }}
              </option>
            </select>
          </div>
          <button class="btn-primary" (click)="onDeviceChange()"
                  [disabled]="!selectedDeviceId || loadingStats">
            <mat-icon>{{ loadingStats ? 'hourglass_empty' : 'search' }}</mat-icon>
            {{ loadingStats ? 'Loading…' : 'Load Stats' }}
          </button>
        </div>
      </div>

      <!-- Device stats KPIs -->
      <div class="kpi-grid two-col" *ngIf="deviceStats && !loadingStats">
        <div class="kpi">
          <div class="kpi-accent-bar indigo"></div>
          <div class="kpi-icon indigo"><mat-icon>memory</mat-icon></div>
          <div class="kpi-label">Device ID</div>
          <div class="kpi-value mono" style="font-size:1rem;margin-top:4px">{{ deviceStats.deviceId }}</div>
          <div class="kpi-sub">Selected device</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar emerald"></div>
          <div class="kpi-icon emerald"><mat-icon>event_note</mat-icon></div>
          <div class="kpi-label">Total Events</div>
          <div class="kpi-value">{{ deviceStats.eventCount | number }}</div>
          <div class="kpi-sub">All-time telemetry events</div>
        </div>
      </div>

      <div class="loading-center" *ngIf="loadingStats" style="padding:2rem">
        <mat-spinner diameter="32"></mat-spinner>
      </div>

      <!-- ── Telemetry History Chart ─────────────────────────── -->
      <div class="card history-card" *ngIf="selectedDeviceId">
        <div class="section-header">
          <span class="section-title">
            <mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle;margin-right:4px">timeline</mat-icon>
            Telemetry History
          </span>
          <span class="count-pill" *ngIf="historyRaw.length">Last {{ historyRaw.length }} readings</span>
          <button class="icon-btn-sm" (click)="loadHistory()" [disabled]="loadingHistory"
                  matTooltip="Refresh history">
            <mat-icon [class.spin]="loadingHistory">refresh</mat-icon>
          </button>
        </div>

        <div class="loading-center" *ngIf="loadingHistory" style="padding:1.5rem">
          <mat-spinner diameter="28"></mat-spinner>
        </div>

        <div class="empty" *ngIf="!loadingHistory && historyRaw.length === 0">
          <mat-icon>show_chart</mat-icon>
          <p>No history yet. Send some telemetry to start recording.</p>
        </div>

        <div class="chart-tabs" *ngIf="historyRaw.length > 0 && !loadingHistory">
          <button class="chart-tab" [class.active]="chartSensor === 'temperature'" (click)="chartSensor='temperature'; buildChart()">
            <span class="dot temp-dot"></span> Temperature
          </button>
          <button class="chart-tab" [class.active]="chartSensor === 'humidity'" (click)="chartSensor='humidity'; buildChart()">
            <span class="dot hum-dot"></span> Humidity
          </button>
          <button class="chart-tab" [class.active]="chartSensor === 'vibration'" (click)="chartSensor='vibration'; buildChart()">
            <span class="dot vib-dot"></span> Vibration
          </button>
        </div>

        <div class="chart-wrap" *ngIf="historyData.length > 0 && !loadingHistory">
          <ngx-charts-line-chart
            [results]="historyData"
            [xAxis]="true" [yAxis]="true"
            [showXAxisLabel]="false" [showYAxisLabel]="true"
            [yAxisLabel]="yAxisLabel"
            [scheme]="chartScheme"
            [animations]="true"
            style="display:block;height:220px">
          </ngx-charts-line-chart>
        </div>
      </div>

      <!-- All devices summary -->
      <div class="card" *ngIf="allStats.length > 0">
        <div class="section-header">
          <span class="section-title">All Devices — Event Summary</span>
          <span class="count-pill">{{ allStats.length }} devices</span>
        </div>

        <div class="chart-area" *ngIf="barData.length > 0">
          <ngx-charts-bar-vertical
            [results]="barData"
            [xAxis]="true" [yAxis]="true"
            [showXAxisLabel]="true" [showYAxisLabel]="true"
            xAxisLabel="Device" yAxisLabel="Events"
            [scheme]="barScheme" [roundEdges]="true"
            style="display:block;height:220px">
          </ngx-charts-bar-vertical>
        </div>

        <div class="stats-table-wrap">
          <table class="stats-table" aria-label="Device event statistics">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Device ID</th>
                <th scope="col">Total Events</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of allStats; let i = index"
                  [class.selected-row]="s.deviceId === selectedDeviceId">
                <td class="rank-cell">{{ i + 1 }}</td>
                <td>
                  <span class="mono device-link" (click)="selectedDeviceId = s.deviceId; onDeviceChange()">
                    {{ s.deviceId }}
                  </span>
                </td>
                <td>
                  <strong>{{ s.eventCount | number }}</strong>
                </td>
                <td>
                  <div class="progress-wrap">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="getShare(s.eventCount)"
                           [attr.aria-valuenow]="getShare(s.eventCount)"
                           aria-valuemin="0" aria-valuemax="100" role="progressbar"></div>
                    </div>
                    <span class="progress-label">{{ getShare(s.eventCount).toFixed(1) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty" *ngIf="!loading && allStats.length === 0 && devices.length > 0">
        <mat-icon>insights</mat-icon>
        <p>Select a device above and load its stats. Send some telemetry first to generate events.</p>
      </div>
      <div class="empty" *ngIf="!loading && devices.length === 0">
        <mat-icon>router</mat-icon>
        <p>No devices registered. Go to the Devices page to register a device first.</p>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }

    .selector-card { margin-bottom: 1.25rem; }
    .selector-inner {
      display: flex; align-items: flex-end; gap: .875rem; padding: 1.25rem;
      flex-wrap: wrap;
    }

    .two-col { grid-template-columns: repeat(2, 1fr); max-width: 540px; margin-bottom: 1.25rem; }
    @media (max-width: 540px) { .two-col { grid-template-columns: 1fr; } }

    .section-header {
      display: flex; align-items: center; gap: .5rem;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-2);
    }
    .section-title { font-size: .9rem; font-weight: 600; color: var(--text-primary); flex: 1; }

    /* History card */
    .history-card { margin-bottom: 1.25rem; }

    /* Chart tabs */
    .chart-tabs {
      display: flex; gap: 4px; padding: .75rem 1.25rem .5rem;
      border-bottom: 1px solid var(--border-2);
    }
    .chart-tab {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 14px; border-radius: var(--radius-full);
      font-size: .75rem; font-weight: 600; border: 1px solid var(--border);
      background: var(--surface-2); color: var(--text-secondary); cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
    }
    .chart-tab:hover { background: var(--surface); color: var(--text-primary); }
    .chart-tab.active { background: var(--indigo-light); color: var(--indigo); border-color: var(--indigo); }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .temp-dot { background: #ef4444; }
    .hum-dot  { background: #3b82f6; }
    .vib-dot  { background: #8b5cf6; }

    .icon-btn-sm {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 6px; line-height: 1;
      display: flex; align-items: center;
      transition: color var(--t-fast), background var(--t-fast);
    }
    .icon-btn-sm:hover { color: var(--text-primary); background: var(--surface-2); }
    .icon-btn-sm mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Chart area */
    .chart-wrap { padding: .5rem 1rem 1rem; }
    .chart-area { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-2); }

    /* Stats table */
    .stats-table-wrap { overflow-x: auto; }
    .stats-table { width: 100%; border-collapse: collapse; }
    .stats-table th {
      font-size: .68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: var(--text-muted);
      padding: 10px 20px; text-align: left;
      background: var(--surface-2); border-bottom: 1px solid var(--border);
    }
    .stats-table td {
      padding: 11px 20px; border-bottom: 1px solid var(--border-2);
      font-size: .875rem; color: var(--text-secondary);
    }
    .stats-table tr:last-child td { border-bottom: none; }
    .stats-table tbody tr:hover td { background: rgba(8,145,178,.03); }
    .stats-table tbody tr.selected-row td { background: var(--indigo-light); }

    .rank-cell { color: var(--text-muted); font-weight: 600; width: 40px; }
    .device-link { color: var(--indigo); font-weight: 600; cursor: pointer; font-size: .82rem; }
    .device-link:hover { text-decoration: underline; }

    .progress-wrap { display: flex; align-items: center; gap: .625rem; min-width: 160px; }
    .progress-bar {
      flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--indigo), var(--violet));
      border-radius: 3px; transition: width .4s ease;
    }
    .progress-label { font-size: .75rem; color: var(--text-secondary); white-space: nowrap; min-width: 40px; text-align: right; }
  `]
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  devices: any[] = [];
  selectedDeviceId = '';
  deviceStats: any = null;
  allStats: any[] = [];
  barData: any[] = [];
  loading = false;
  loadingStats = false;

  // Telemetry history
  historyRaw: any[] = [];
  historyData: any[] = [];
  loadingHistory = false;
  chartSensor: 'temperature' | 'humidity' | 'vibration' = 'temperature';

  barScheme: any = { domain: ['#06b6d4', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899'] };

  chartScheme: any = { domain: ['#ef4444', '#3b82f6', '#8b5cf6'] };

  get yAxisLabel(): string {
    const labels: Record<string, string> = { temperature: '°C', humidity: '%', vibration: 'm/s²' };
    return labels[this.chartSensor] ?? '';
  }

  private historyCancel$ = new Subject<void>();

  constructor(private api: ApiService) {}
  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading = true;
    this.api.getDevices().pipe(catchError(() => of([]))).subscribe(devices => {
      this.devices = devices;
      this.loading = false;
      if (devices.length > 0) {
        if (!this.selectedDeviceId) this.selectedDeviceId = devices[0].deviceId;
        this.loadAllStats();
        this.loadHistory();
      }
    });
  }

  onDeviceChange() {
    this.loadDeviceStats();
    this.loadHistory();
  }

  loadAllStats() {
    if (this.devices.length === 0) return;
    const calls = this.devices.map((d: any) =>
      this.api.getDeviceStats(d.deviceId).pipe(catchError(() => of({ deviceId: d.deviceId, eventCount: 0 })))
    );
    forkJoin(calls).subscribe((results: any[]) => {
      this.allStats = results.sort((a, b) => b.eventCount - a.eventCount);
      this.barData  = this.allStats.map(s => ({ name: s.deviceId, value: s.eventCount }));
    });
  }

  loadDeviceStats() {
    if (!this.selectedDeviceId) return;
    this.loadingStats = true;
    this.api.getDeviceStats(this.selectedDeviceId).pipe(catchError(() => of(null))).subscribe(s => {
      this.deviceStats = s; this.loadingStats = false;
      this.loadAllStats();
    });
  }

  loadHistory() {
    if (!this.selectedDeviceId) return;
    this.loadingHistory = true;
    this.historyCancel$.next();
    const requestedDevice = this.selectedDeviceId;
    this.api.getDeviceHistory(requestedDevice).pipe(
      catchError(() => of([])),
      takeUntil(this.historyCancel$)
    ).subscribe(data => {
      if (requestedDevice !== this.selectedDeviceId) return;
      // Data arrives newest-first; reverse to get chronological order for chart
      this.historyRaw = [...data].reverse();
      this.buildChart();
      this.loadingHistory = false;
    });
  }

  buildChart() {
    if (!this.historyRaw.length) { this.historyData = []; return; }

    const colorMap: Record<string, string> = { temperature: '#ef4444', humidity: '#3b82f6', vibration: '#8b5cf6' };

    // Skip snapshots where this sensor was not reported instead of plotting a fake 0
    const series = this.historyRaw
      .filter(entry => entry[this.chartSensor] != null)
      .map(entry => ({
        name: this.formatTime(entry['ts']),
        value: Number(entry[this.chartSensor])
      }));

    this.historyData = [{
      name: this.chartSensor.charAt(0).toUpperCase() + this.chartSensor.slice(1),
      series
    }];

    this.chartScheme = { domain: [colorMap[this.chartSensor]] };
  }

  private formatTime(epochMs: number): string {
    const d = new Date(epochMs);
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0') + ':' +
           d.getSeconds().toString().padStart(2, '0');
  }

  ngOnDestroy() { this.historyCancel$.next(); this.historyCancel$.complete(); }

  getShare(count: number): number {
    const total = this.allStats.reduce((s, x) => s + x.eventCount, 0);
    return total === 0 ? 0 : (count / total) * 100;
  }
}
