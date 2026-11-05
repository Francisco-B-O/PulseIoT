import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../services/api.service';
import { interval, Subscription, catchError, of, switchMap, forkJoin, finalize } from 'rxjs';

interface Alert {
  id: string;
  deviceId: string;
  severity: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2>
            <mat-icon>notifications_active</mat-icon> Alerts
            <span class="head-badge" *ngIf="unacked > 0" [attr.aria-label]="unacked + ' unacknowledged alerts'">{{ unacked }}</span>
          </h2>
          <p class="subtitle">Auto-refresh every 10s · {{ all.length }} total</p>
        </div>
        <div class="head-right">
          <button class="btn-ghost" (click)="exportCsv()" [disabled]="filtered.length === 0"
                  matTooltip="Export filtered alerts as CSV">
            <mat-icon>download</mat-icon> Export CSV
          </button>
          <button class="btn-ghost" (click)="ackAll()" [disabled]="unacked === 0">
            <mat-icon>done_all</mat-icon> Acknowledge All
          </button>
          <button class="icon-btn" (click)="load()" [matTooltip]="'Refresh alerts'" aria-label="Refresh alerts">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Alert Rules Panel -->
      <div class="rules-panel" [class.rules-open]="rulesOpen">
        <button class="rules-toggle" (click)="toggleRules()">
          <mat-icon>tune</mat-icon>
          <span>Alert Rules</span>
          <span class="rules-badge" *ngIf="tempThreshold !== null">Critical threshold: {{ tempThreshold }}°C</span>
          <mat-icon class="rules-chevron" [class.rotated]="rulesOpen">expand_more</mat-icon>
        </button>

        <div class="rules-body" *ngIf="rulesOpen">
          <div class="rule-row">
            <div class="rule-icon"><mat-icon>thermostat</mat-icon></div>
            <div class="rule-content">
              <div class="rule-label">Temperature Critical Threshold (°C)</div>
              <div class="rule-desc">Alerts are triggered when temperature exceeds this value. Warning at 80% of threshold.</div>
              <div class="rule-input-row">
                <input type="number" step="1" min="1" class="rule-input"
                       [(ngModel)]="tempThresholdEdit"
                       placeholder="e.g. 100" />
                <button class="btn-accent rule-save-btn" (click)="saveThreshold()"
                        [disabled]="savingThreshold || tempThresholdEdit === null">
                  <mat-icon>{{ savingThreshold ? 'hourglass_empty' : 'save' }}</mat-icon>
                  {{ savingThreshold ? 'Saving…' : 'Save' }}
                </button>
              </div>
              <div class="rule-hint" *ngIf="tempThreshold !== null">
                Current: <strong>{{ tempThreshold }}°C</strong> critical ·
                <strong>{{ (tempThreshold * 0.8).toFixed(0) }}°C</strong> warning
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Severity summary cards -->
      <div class="summary-bar" role="group" aria-label="Filter by severity">
        <button class="sum-item high" (click)="setSev('HIGH')"
                [class.active-filter]="sevFilter === 'HIGH'"
                [attr.aria-pressed]="sevFilter === 'HIGH'"
                [attr.aria-label]="count('HIGH') + ' high alerts'">
          <mat-icon>warning</mat-icon>
          <div>
            <div class="sum-count">{{ count('HIGH') }}</div>
            <div class="sum-label">High</div>
          </div>
        </button>
        <button class="sum-item med" (click)="setSev('MEDIUM')"
                [class.active-filter]="sevFilter === 'MEDIUM'"
                [attr.aria-pressed]="sevFilter === 'MEDIUM'"
                [attr.aria-label]="count('MEDIUM') + ' medium alerts'">
          <mat-icon>info</mat-icon>
          <div>
            <div class="sum-count">{{ count('MEDIUM') }}</div>
            <div class="sum-label">Medium</div>
          </div>
        </button>
        <button class="sum-item low" (click)="setSev('LOW')"
                [class.active-filter]="sevFilter === 'LOW'"
                [attr.aria-pressed]="sevFilter === 'LOW'"
                [attr.aria-label]="count('LOW') + ' low alerts'">
          <mat-icon>notifications</mat-icon>
          <div>
            <div class="sum-count">{{ count('LOW') }}</div>
            <div class="sum-label">Low</div>
          </div>
        </button>

        <div class="filters-right">
          <div class="filter-pills" role="group" aria-label="Filter by status">
            <button class="pill" [class.active]="statusFilter === ''" (click)="setStatus('')">All</button>
            <button class="pill" [class.active]="statusFilter === 'pending'" (click)="setStatus('pending')">Pending</button>
            <button class="pill" [class.active]="statusFilter === 'acked'" (click)="setStatus('acked')">Acknowledged</button>
          </div>
          <div class="auto-refresh-hint">
            <mat-icon>sync</mat-icon> Auto-refresh 10s
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-card">
        <div class="loading-center" *ngIf="loading && filtered.length === 0">
          <mat-spinner diameter="36"></mat-spinner>
        </div>

        <div class="empty" *ngIf="!loading && filtered.length === 0 && all.length === 0">
          <mat-icon>notifications_none</mat-icon>
          <p>No alerts yet. Send some telemetry with critical values to trigger alerts.</p>
        </div>
        <div class="empty" *ngIf="!loading && filtered.length === 0 && all.length > 0">
          <mat-icon>filter_list_off</mat-icon>
          <p>No alerts match the current filter. Try clearing the filter.</p>
        </div>

        <table *ngIf="filtered.length > 0" aria-label="Alerts table">
          <thead>
            <tr>
              <th scope="col">Severity</th>
              <th scope="col">Device</th>
              <th scope="col">Message</th>
              <th scope="col">Time</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of filtered"
                [class.row-crit]="a.severity === 'HIGH' && !a.acknowledged"
                [class.row-acked]="a.acknowledged">
              <td>
                <div class="sev-cell">
                  <span class="sev-bar" [class]="'sev-bar-' + a.severity?.toLowerCase()"></span>
                  <span class="badge" [class]="a.severity?.toLowerCase()">{{ a.severity }}</span>
                </div>
              </td>
              <td>
                <span class="mono device-link">{{ a.deviceId }}</span>
              </td>
              <td class="msg-cell">{{ a.message }}</td>
              <td>
                <span class="mono time-cell">{{ a.timestamp | date:'dd/MM HH:mm:ss' }}</span>
              </td>
              <td>
                <span class="badge" [class]="a.acknowledged ? 'ack' : 'pending'">
                  {{ a.acknowledged ? 'ACK' : 'Pending' }}
                </span>
              </td>
              <td class="action-cell">
                <button class="ack-btn" *ngIf="!a.acknowledged" (click)="ack(a.id)"
                        matTooltip="Acknowledge alert" [attr.aria-label]="'Acknowledge alert for ' + a.deviceId">
                  <mat-icon>check_circle_outline</mat-icon>
                </button>
                <mat-icon class="acked-icon" *ngIf="a.acknowledged" aria-label="Acknowledged">check_circle</mat-icon>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Results count -->
        <div class="results-footer" *ngIf="filtered.length > 0">
          Showing {{ filtered.length }} of {{ all.length }} alerts
          <button class="clear-filter-btn" *ngIf="sevFilter || statusFilter" (click)="sevFilter=''; statusFilter=''; applyFilter()">
            Clear filters
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }
    .head-right { display: flex; align-items: center; gap: 8px; }

    .summary-bar button { font-family: 'Inter', sans-serif; }
    .filters-right { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

    .sev-cell { display: flex; align-items: center; gap: 8px; }
    .sev-bar { width: 3px; height: 20px; border-radius: 2px; flex-shrink: 0; }
    .sev-bar-critical { background: #ef4444; }
    .sev-bar-high     { background: #f97316; }
    .sev-bar-medium   { background: #f59e0b; }
    .sev-bar-low      { background: #8b5cf6; }

    .device-link { color: var(--indigo); font-weight: 500; white-space: nowrap; font-size: .8rem; }
    .msg-cell { color: var(--text-secondary); max-width: 300px; }
    .time-cell { color: var(--text-muted); white-space: nowrap; font-size: .78rem; }
    .row-acked td { opacity: .55; }
    .action-cell { text-align: right; }

    .ack-btn {
      background: var(--c-info-bg); border: none; border-radius: 7px;
      width: 30px; height: 30px; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      color: #1d4ed8; transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .ack-btn:hover { opacity: .75; transform: scale(1.08); }
    .ack-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .acked-icon { font-size: 18px; width: 18px; height: 18px; color: var(--emerald); }

    .results-footer {
      display: flex; align-items: center; gap: 1rem;
      padding: .75rem 1.25rem;
      font-size: .78rem; color: var(--text-muted);
      border-top: 1px solid var(--border-2);
    }
    .clear-filter-btn {
      background: none; border: none; cursor: pointer;
      color: var(--indigo); font-size: .78rem; font-weight: 500;
      font-family: 'Inter', sans-serif; padding: 0;
      text-decoration: underline; text-underline-offset: 2px;
    }
    .visually-hidden {
      position: absolute; width: 1px; height: 1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
    }

    /* Rules panel */
    .rules-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); margin-bottom: 1.25rem;
      overflow: hidden;
      transition: background var(--t-slow), border-color var(--t-slow);
    }
    .rules-toggle {
      display: flex; align-items: center; gap: .625rem; width: 100%;
      padding: .875rem 1.25rem; background: none; border: none; cursor: pointer;
      color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: .875rem; font-weight: 600;
      text-align: left;
      transition: background var(--t-fast);
    }
    .rules-toggle:hover { background: var(--surface-2); }
    .rules-toggle mat-icon:first-child { font-size: 18px; width: 18px; height: 18px; color: var(--indigo); }
    .rules-badge {
      margin-left: auto; font-size: .72rem; font-weight: 500;
      color: var(--text-muted); margin-right: .25rem;
    }
    .rules-chevron { font-size: 18px; width: 18px; height: 18px; color: var(--text-muted); transition: transform var(--t-fast); }
    .rules-chevron.rotated { transform: rotate(180deg); }

    .rules-body { padding: 1rem 1.25rem 1.25rem; border-top: 1px solid var(--border-2); }
    .rule-row { display: flex; gap: .875rem; align-items: flex-start; }
    .rule-icon {
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; margin-top: 2px;
      background: rgba(239,68,68,.1); color: #ef4444;
      display: flex; align-items: center; justify-content: center;
    }
    .rule-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .rule-content { flex: 1; }
    .rule-label { font-size: .875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
    .rule-desc { font-size: .78rem; color: var(--text-muted); margin-bottom: .75rem; line-height: 1.5; }
    .rule-input-row { display: flex; align-items: center; gap: .625rem; flex-wrap: wrap; }
    .rule-input {
      width: 120px; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 8px 12px; font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .9rem;
      outline: none; color: var(--text-primary); background: var(--surface);
      transition: border-color var(--t-fast);
    }
    .rule-input:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(8,145,178,.1); }
    .rule-save-btn { display: flex; align-items: center; gap: 5px; }
    .rule-hint { font-size: .75rem; color: var(--text-muted); margin-top: .5rem; }
    .rule-hint strong { color: var(--text-secondary); }
  `]
})
export class AlertsComponent implements OnInit, OnDestroy {
  all: Alert[] = []; filtered: Alert[] = [];
  loading = false; sevFilter = ''; statusFilter = '';
  get unacked() { return this.all.filter(a => !a.acknowledged).length; }
  private sub?: Subscription;

  // Rules panel
  rulesOpen = false;
  tempThreshold: number | null = null;
  tempThresholdEdit: number | null = null;
  savingThreshold = false;

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.load();
    this.loadThreshold();
    this.sub = interval(10000)
      .pipe(switchMap(() => this.api.getAlerts().pipe(catchError(() => of([])))))
      .subscribe(a => {
        this.all = a.sort((x: Alert, y: Alert) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
        this.applyFilter();
      });
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }

  load() {
    this.loading = true;
    this.api.getAlerts().pipe(catchError(() => of([]))).subscribe(a => {
      this.all = a.sort((x: any, y: any) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
      this.applyFilter(); this.loading = false;
    });
  }

  applyFilter() {
    this.filtered = this.all.filter(a => {
      const s  = !this.sevFilter || a.severity === this.sevFilter;
      const st = !this.statusFilter || (this.statusFilter === 'pending' ? !a.acknowledged : a.acknowledged);
      return s && st;
    });
  }

  setSev(s: string)    { this.sevFilter = this.sevFilter === s ? '' : s; this.applyFilter(); }
  setStatus(s: string) { this.statusFilter = s; this.applyFilter(); }
  count(s: string)     { return this.all.filter(a => a.severity === s).length; }

  ack(id: string) {
    this.api.acknowledgeAlert(id).subscribe({
      next: () => { this.snack.open('Alert acknowledged', 'OK', { duration: 2000 }); this.load(); },
      error: (e) => this.snack.open('Error: ' + (e.error?.message || e.status || 'Unknown error'), 'Close', { duration: 3000 })
    });
  }

  ackAll() {
    if (!this.all.some(a => !a.acknowledged)) return;
    this.api.acknowledgeAllAlerts().subscribe({
      next: (r) => {
        this.load();
        this.snack.open(`${r.acknowledged} alerts acknowledged`, 'OK', { duration: 3000 });
      },
      error: (e) => this.snack.open('Error: ' + (e.error?.message || e.status || 'Unknown error'), 'Close', { duration: 3000 })
    });
  }

  // ─── Rules ───────────────────────────────────────────────────────────────────
  toggleRules() {
    this.rulesOpen = !this.rulesOpen;
    if (this.rulesOpen && this.tempThreshold === null) this.loadThreshold();
  }

  loadThreshold() {
    this.api.getTemperatureRule().pipe(catchError(() => of(null))).subscribe(val => {
      if (val !== null) {
        this.tempThreshold = Number(val);
        this.tempThresholdEdit = this.tempThreshold;
      }
    });
  }

  saveThreshold() {
    if (this.tempThresholdEdit === null || this.tempThresholdEdit <= 0) return;
    this.savingThreshold = true;
    this.api.setTemperatureRule(this.tempThresholdEdit)
      .pipe(catchError(() => of(null)), finalize(() => this.savingThreshold = false))
      .subscribe(() => {
        this.tempThreshold = this.tempThresholdEdit;
        this.snack.open(`Threshold updated to ${this.tempThreshold}°C`, 'OK', { duration: 3000 });
      });
  }

  exportCsv() {
    if (!this.filtered.length) return;
    const headers = ['ID', 'Device', 'Severity', 'Message', 'Timestamp', 'Status'];
    const rows = this.filtered.map(a => [
      a.id,
      a.deviceId,
      a.severity,
      `"${(a.message || '').replace(/"/g, '""')}"`,
      new Date(a.timestamp).toISOString(),
      a.acknowledged ? 'ACK' : 'Pending'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.snack.open(`Exported ${this.filtered.length} alerts`, 'OK', { duration: 2500 });
  }
}
