import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../services/api.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>sensors</mat-icon> Telemetry Console</h2>
          <p class="subtitle">Push sensor readings directly to the Kafka ingestion pipeline</p>
        </div>
      </div>

      <div class="layout">

        <!-- ── Send panel ───────────────────────────────────── -->
        <div class="card send-panel">
          <div class="panel-header">
            <div class="panel-icon"><mat-icon>send</mat-icon></div>
            <div>
              <div class="panel-title">Send Readings</div>
              <div class="panel-sub">Device → Ingestion → Kafka → Processing</div>
            </div>
          </div>

          <!-- Device selector -->
          <div class="field" style="margin-bottom:1.125rem">
            <label for="device-sel">Target Device</label>
            <select id="device-sel" [(ngModel)]="selectedId" class="select-input"
                    [disabled]="devices.length === 0" aria-label="Select target device">
              <option value="" disabled>Select a device…</option>
              <option *ngFor="let d of devices" [value]="d.deviceId">
                {{ d.deviceId }} ({{ d.type }})
              </option>
            </select>
            <div class="no-devices-hint" *ngIf="devices.length === 0">
              <mat-icon>info_outline</mat-icon>
              No devices found. Register a device first.
            </div>
          </div>

          <!-- Sensor cards -->
          <div class="sensor-grid">

            <!-- Temperature -->
            <div class="sensor-card" [class.s-warn]="tTemp > 80 && tTemp <= 100" [class.s-crit]="tTemp > 100"
                 role="group" aria-label="Temperature sensor">
              <div class="sensor-header">
                <div class="sensor-icon temp"><mat-icon>thermostat</mat-icon></div>
                <div class="sensor-meta">
                  <div class="sensor-name">Temperature</div>
                  <div class="sensor-unit">°C</div>
                </div>
                <div class="sensor-value" [class.v-warn]="tTemp > 80 && tTemp <= 100" [class.v-crit]="tTemp > 100">
                  {{ tTemp | number:'1.1-1' }}
                </div>
              </div>
              <input type="range" min="-20" max="150" step="0.5" [(ngModel)]="tTemp"
                     class="slider temp-slider" aria-label="Temperature slider" />
              <input type="number" step="0.1" [(ngModel)]="tTemp" class="num-input" aria-label="Temperature value" />
              <div class="threshold-msg crit" *ngIf="tTemp > 100">
                <mat-icon>warning</mat-icon> Critical — alert will fire
              </div>
              <div class="threshold-msg warn" *ngIf="tTemp > 80 && tTemp <= 100">
                <mat-icon>info_outline</mat-icon> Warning range
              </div>
            </div>

            <!-- Humidity -->
            <div class="sensor-card" role="group" aria-label="Humidity sensor">
              <div class="sensor-header">
                <div class="sensor-icon hum"><mat-icon>water_drop</mat-icon></div>
                <div class="sensor-meta">
                  <div class="sensor-name">Humidity</div>
                  <div class="sensor-unit">%</div>
                </div>
                <div class="sensor-value">{{ tHum | number:'1.0-0' }}</div>
              </div>
              <input type="range" min="0" max="100" step="1" [(ngModel)]="tHum"
                     class="slider hum-slider" aria-label="Humidity slider" />
              <input type="number" step="1" min="0" max="100" [(ngModel)]="tHum"
                     class="num-input" aria-label="Humidity value" />
            </div>

            <!-- Vibration -->
            <div class="sensor-card" role="group" aria-label="Vibration sensor">
              <div class="sensor-header">
                <div class="sensor-icon vib"><mat-icon>vibration</mat-icon></div>
                <div class="sensor-meta">
                  <div class="sensor-name">Vibration</div>
                  <div class="sensor-unit">m/s²</div>
                </div>
                <div class="sensor-value">{{ tVib | number:'1.2-2' }}</div>
              </div>
              <input type="range" min="0" max="15" step="0.01" [(ngModel)]="tVib"
                     class="slider vib-slider" aria-label="Vibration slider" />
              <input type="number" step="0.01" min="0" [(ngModel)]="tVib"
                     class="num-input" aria-label="Vibration value" />
            </div>
          </div>

          <!-- Presets -->
          <div class="presets-row">
            <span class="presets-label">Quick presets:</span>
            <button class="preset normal" (click)="setPreset('normal')">Normal</button>
            <button class="preset warn"   (click)="setPreset('warn')">Warning</button>
            <button class="preset crit"   (click)="setPreset('crit')">Critical</button>
          </div>

          <!-- Send button -->
          <button class="send-btn" (click)="send()" [disabled]="!selectedId || sending"
                  [attr.aria-busy]="sending">
            <mat-spinner *ngIf="sending" diameter="18" class="s-spin"></mat-spinner>
            <mat-icon *ngIf="!sending">send</mat-icon>
            {{ sending ? 'Sending…' : 'Send Telemetry' }}
          </button>
        </div>

        <!-- ── History panel ────────────────────────────────── -->
        <div class="card history-panel">
          <div class="history-header">
            <div class="history-title">Session History</div>
            <span class="count-pill">{{ history.length }}</span>
          </div>

          <div class="empty" style="padding:2.5rem 1rem" *ngIf="history.length === 0">
            <mat-icon>history</mat-icon>
            <p>No events sent yet this session</p>
          </div>

          <div class="history-list" *ngIf="history.length > 0">
            <div class="history-item" *ngFor="let h of history"
                 [class.h-crit]="h.temp > 100 && h.ok"
                 [class.h-err]="!h.ok">
              <div class="h-top">
                <div class="h-status-icon">
                  <mat-icon [class.ok-icon]="h.ok" [class.err-icon]="!h.ok">
                    {{ h.ok ? 'check_circle' : 'cancel' }}
                  </mat-icon>
                </div>
                <span class="mono h-device">{{ h.deviceId }}</span>
                <span class="h-time">{{ h.time | date:'HH:mm:ss' }}</span>
              </div>
              <div class="h-vals">
                <span class="h-val temp-val">
                  <mat-icon>thermostat</mat-icon>{{ h.temp }}°C
                </span>
                <span class="h-val hum-val">
                  <mat-icon>water_drop</mat-icon>{{ h.hum }}%
                </span>
                <span class="h-val vib-val">
                  <mat-icon>vibration</mat-icon>{{ h.vib }} m/s²
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }

    /* Layout */
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

    /* Send panel */
    .panel-header {
      display: flex; align-items: center; gap: .875rem; margin-bottom: 1.25rem;
      padding: 1.25rem 1.25rem 0;
    }
    .panel-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: var(--indigo-light); color: var(--indigo);
      display: flex; align-items: center; justify-content: center;
    }
    .panel-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-title { font-size: .9375rem; font-weight: 700; color: var(--text-primary); }
    .panel-sub { font-size: .72rem; color: var(--text-muted); margin-top: 2px; }

    /* Card body padding for send panel */
    .send-panel { display: flex; flex-direction: column; }
    .send-panel .field { padding: 0 1.25rem; }
    .send-panel .select-input { padding: 0 1.25rem; }

    .field { padding: 0 1.25rem; }
    .field label { font-size: .75rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 5px; }

    .select-input {
      width: calc(100% - 2.5rem); margin: 0 1.25rem;
      border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 10px 12px; font-family: 'Inter', sans-serif; font-size: .875rem;
      color: var(--text-primary); background: var(--surface); outline: none;
      transition: border-color var(--t-fast), background var(--t-slow);
    }
    .select-input:focus { border-color: var(--indigo); }
    .select-input:disabled { opacity: .6; cursor: not-allowed; }

    .no-devices-hint {
      display: flex; align-items: center; gap: 5px;
      font-size: .73rem; color: var(--rose); margin-top: 5px;
      padding: 0 1.25rem;
    }
    .no-devices-hint mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Sensor cards */
    .sensor-grid { display: flex; flex-direction: column; gap: .75rem; padding: 0 1.25rem; margin-bottom: 1rem; }
    .sensor-card {
      background: var(--surface-2); border: 1.5px solid var(--border);
      border-radius: var(--radius-md); padding: .875rem 1rem;
      transition: border-color var(--t-fast), background var(--t-fast);
    }
    .sensor-card.s-warn { border-color: var(--amber); background: rgba(245,158,11,.04); }
    .sensor-card.s-crit { border-color: var(--rose);  background: rgba(239,68,68,.04); }

    .sensor-header { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
    .sensor-icon {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .sensor-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .sensor-icon.temp { background: var(--c-error-bg);   color: #dc2626; }
    .sensor-icon.hum  { background: var(--c-info-bg);    color: #2563eb; }
    .sensor-icon.vib  { background: var(--c-violet-bg);  color: #7c3aed; }
    .sensor-meta { flex: 1; }
    .sensor-name { font-size: .82rem; font-weight: 600; color: var(--text-primary); }
    .sensor-unit { font-size: .68rem; color: var(--text-muted); margin-top: 1px; }
    .sensor-value {
      font-size: 1.5rem; font-weight: 700; color: var(--text-primary);
      font-family: 'JetBrains Mono', 'Roboto Mono', monospace; min-width: 60px; text-align: right;
    }
    .sensor-value.v-warn { color: var(--amber); }
    .sensor-value.v-crit { color: var(--rose); }

    .slider {
      width: 100%; height: 4px; border-radius: 4px;
      outline: none; appearance: none; cursor: pointer; margin-bottom: .5rem;
      background: var(--border);
    }
    .temp-slider { accent-color: #ef4444; }
    .hum-slider  { accent-color: #3b82f6; }
    .vib-slider  { accent-color: #8b5cf6; }

    .num-input {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
      padding: 6px 10px; font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .85rem;
      outline: none; color: var(--text-primary); background: var(--surface);
      box-sizing: border-box; transition: border-color var(--t-fast), background var(--t-slow);
    }
    .num-input:focus { border-color: var(--indigo); }

    .threshold-msg {
      display: flex; align-items: center; gap: 4px;
      font-size: .72rem; font-weight: 500; margin-top: 5px;
    }
    .threshold-msg mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .threshold-msg.crit { color: var(--rose); }
    .threshold-msg.warn { color: var(--amber); }

    /* Presets */
    .presets-row {
      display: flex; align-items: center; gap: 8px;
      padding: 0 1.25rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .presets-label { font-size: .73rem; color: var(--text-muted); }
    .preset {
      padding: 5px 14px; border-radius: var(--radius-full);
      border: 1.5px solid transparent; font-size: .78rem; font-weight: 600;
      cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity var(--t-fast);
    }
    .preset:hover { opacity: .8; }
    .preset.normal { background: var(--c-success-bg); color: var(--c-success-text); border-color: #6ee7b7; }
    .preset.warn   { background: var(--c-warning-bg); color: var(--c-warning-text); border-color: #fcd34d; }
    .preset.crit   { background: var(--c-error-bg);   color: var(--c-error-text);   border-color: #fca5a5; }

    /* Send button */
    .send-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: calc(100% - 2.5rem); margin: 0 1.25rem 1.25rem;
      background: linear-gradient(135deg, var(--indigo), var(--indigo-dark)); color: #fff;
      border: none; border-radius: var(--radius-md); padding: 14px;
      font-size: .9375rem; font-weight: 600; font-family: 'Inter', sans-serif;
      cursor: pointer; box-shadow: 0 4px 14px rgba(var(--c-primary-rgb),.4);
      transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .send-btn:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(var(--c-primary-rgb),.5); }
    .send-btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; transform: none; }
    .send-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    ::ng-deep .s-spin circle { stroke: #fff !important; }

    /* History panel */
    .history-panel { display: flex; flex-direction: column; overflow: hidden; }
    .history-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: .875rem 1.25rem; border-bottom: 1px solid var(--border-2); flex-shrink: 0;
    }
    .history-title { font-size: .9rem; font-weight: 600; color: var(--text-primary); }

    .history-list {
      display: flex; flex-direction: column; overflow-y: auto;
      max-height: 100%; flex: 1;
    }
    .history-item {
      padding: .75rem 1.25rem; border-bottom: 1px solid var(--border-2);
      transition: background var(--t-fast);
    }
    .history-item:last-child { border-bottom: none; }
    .history-item:hover { background: var(--surface-2); }
    .history-item.h-crit { border-left: 3px solid var(--rose); }
    .history-item.h-err  { border-left: 3px solid var(--text-muted); opacity: .75; }

    .h-top { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; }
    .h-status-icon mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ok-icon  { color: var(--emerald); }
    .err-icon { color: var(--rose); }
    .h-device { font-size: .8rem; font-weight: 600; color: var(--indigo); flex: 1; }
    .h-time { font-size: .68rem; color: var(--text-muted); }

    .h-vals { display: flex; gap: 6px; flex-wrap: wrap; }
    .h-val {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: .72rem; padding: 2px 8px; border-radius: var(--radius-full); font-weight: 500;
    }
    .h-val mat-icon { font-size: 11px; width: 11px; height: 11px; }
    .h-val.temp-val { background: var(--c-error-bg);   color: var(--c-error-text); }
    .h-val.hum-val  { background: var(--c-info-bg);    color: var(--c-info-text); }
    .h-val.vib-val  { background: var(--c-violet-bg);  color: var(--c-violet-text); }
  `]
})
export class TelemetryComponent implements OnInit {
  devices: any[] = []; selectedId = '';
  tTemp = 25.0; tHum = 60.0; tVib = 0.02;
  sending = false;
  history: any[] = [];

  constructor(private api: ApiService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.api.getDevices().pipe(catchError(() => of([]))).subscribe(d => {
      this.devices = d;
      if (d.length > 0) this.selectedId = d[0].deviceId;
    });
  }

  setPreset(l: string) {
    if (l === 'normal') { this.tTemp = 22;  this.tHum = 55; this.tVib = 0.01; }
    if (l === 'warn')   { this.tTemp = 75;  this.tHum = 85; this.tVib = 3.5;  }
    if (l === 'crit')   { this.tTemp = 115; this.tHum = 95; this.tVib = 8.0;  }
  }

  send() {
    if (!this.selectedId) return;
    this.sending = true;
    this.api.sendTelemetry(this.selectedId, this.tTemp, this.tHum, this.tVib).subscribe({
      next: () => {
        this.snack.open('Telemetry accepted!', 'OK', { duration: 2000 });
        this.history.unshift({ deviceId: this.selectedId, temp: this.tTemp, hum: this.tHum, vib: this.tVib, time: new Date(), ok: true });
        if (this.history.length > 20) this.history.pop();
        this.sending = false;
      },
      error: (e) => {
        this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 });
        this.history.unshift({ deviceId: this.selectedId, temp: this.tTemp, hum: this.tHum, vib: this.tVib, time: new Date(), ok: false });
        if (this.history.length > 20) this.history.pop();
        this.sending = false;
      }
    });
  }
}
