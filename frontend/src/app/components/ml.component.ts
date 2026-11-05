import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../services/api.service';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-ml',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>psychology</mat-icon> ML Platform</h2>
          <p class="subtitle">IsolationForest anomaly detection engine</p>
        </div>
        <button class="icon-btn" (click)="loadAll()" [disabled]="loadingStats"
                matTooltip="Refresh stats" aria-label="Refresh ML stats">
          <mat-icon [class.spin]="loadingStats">refresh</mat-icon>
        </button>
      </div>

      <!-- Stats KPIs -->
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-accent-bar indigo"></div>
          <div class="kpi-icon indigo"><mat-icon>dataset</mat-icon></div>
          <div class="kpi-label">Events Processed</div>
          <div class="kpi-value">{{ mlStats?.total_events ?? 0 | number }}</div>
          <div class="kpi-sub">Total from data lake</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar violet"></div>
          <div class="kpi-icon violet"><mat-icon>devices</mat-icon></div>
          <div class="kpi-label">Tracked Devices</div>
          <div class="kpi-value">{{ mlStats?.devices?.length || 0 }}</div>
          <div class="kpi-sub">In ML data lake</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar" [class.emerald]="mlHealth === 'ok'" [class.rose]="mlHealth === 'error'" [class.amber]="mlHealth === 'checking'"></div>
          <div class="kpi-icon" [class.emerald]="mlHealth === 'ok'" [class.rose]="mlHealth === 'error'" [class.amber]="mlHealth === 'checking'">
            <mat-icon>{{ mlHealth === 'ok' ? 'check_circle' : mlHealth === 'error' ? 'cloud_off' : 'hourglass_empty' }}</mat-icon>
          </div>
          <div class="kpi-label">Platform Status</div>
          <div class="kpi-value" style="font-size:1.15rem;margin-top:4px"
               [class.emerald]="mlHealth === 'ok'" [class.rose]="mlHealth === 'error'">
            {{ mlHealth === 'ok' ? 'Online' : mlHealth === 'error' ? 'Offline' : 'Checking…' }}
          </div>
          <div class="kpi-sub">FastAPI service</div>
        </div>
        <div class="kpi" *ngIf="mlStats?.latest_timestamp">
          <div class="kpi-accent-bar sky"></div>
          <div class="kpi-icon sky"><mat-icon>schedule</mat-icon></div>
          <div class="kpi-label">Last Event</div>
          <div class="kpi-value" style="font-size:.9rem;margin-top:4px">
            {{ (mlStats?.latest_timestamp * 1000) | date:'dd MMM, HH:mm' }}
          </div>
          <div class="kpi-sub">Most recent telemetry</div>
        </div>
      </div>

      <!-- Anomaly Stats KPIs -->
      <div class="kpi-grid anomaly-kpis" *ngIf="anomalyStats">
        <div class="kpi">
          <div class="kpi-accent-bar rose"></div>
          <div class="kpi-icon rose"><mat-icon>bug_report</mat-icon></div>
          <div class="kpi-label">Anomalies Detected</div>
          <div class="kpi-value rose">{{ anomalyStats.anomaly_count | number }}</div>
          <div class="kpi-sub">Out of {{ anomalyStats.total_predictions }} predictions</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar amber"></div>
          <div class="kpi-icon amber"><mat-icon>percent</mat-icon></div>
          <div class="kpi-label">Anomaly Rate</div>
          <div class="kpi-value" [class.rose]="anomalyStats.anomaly_rate > 20" [class.amber]="anomalyStats.anomaly_rate > 5 && anomalyStats.anomaly_rate <= 20">
            {{ anomalyStats.anomaly_rate }}%
          </div>
          <div class="kpi-sub">Of all predictions</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar sky"></div>
          <div class="kpi-icon sky"><mat-icon>model_training</mat-icon></div>
          <div class="kpi-label">Total Predictions</div>
          <div class="kpi-value">{{ anomalyStats.total_predictions | number }}</div>
          <div class="kpi-sub">Since last restart</div>
        </div>
        <div class="kpi">
          <div class="kpi-accent-bar emerald"></div>
          <div class="kpi-icon emerald"><mat-icon>router</mat-icon></div>
          <div class="kpi-label">Affected Devices</div>
          <div class="kpi-value">{{ anomalyDeviceCount }}</div>
          <div class="kpi-sub">With anomalies detected</div>
        </div>
      </div>

      <!-- Recent anomalies -->
      <div class="card" *ngIf="anomalyStats?.recent_anomalies?.length">
        <div class="card-header">
          <span class="card-title">Recent Anomalies</span>
          <span class="count-pill rose-pill">{{ anomalyStats.recent_anomalies.length }}</span>
        </div>
        <div class="anomaly-list">
          <div class="anomaly-row" *ngFor="let a of anomalyStats.recent_anomalies">
            <div class="anomaly-icon"><mat-icon>warning</mat-icon></div>
            <div class="anomaly-detail">
              <span class="anomaly-device mono">{{ a.device_id }}</span>
              <span class="anomaly-ts">{{ a.timestamp | date:'dd/MM HH:mm:ss' }}</span>
            </div>
            <div class="anomaly-score">Score <strong>{{ a.score }}</strong></div>
          </div>
        </div>
      </div>

      <!-- Devices in data lake -->
      <div class="card devices-lake-card" *ngIf="mlStats?.devices?.length">
        <div class="card-header">
          <span class="card-title">Devices in ML Data Lake</span>
          <span class="count-pill">{{ mlStats.devices.length }}</span>
        </div>
        <div class="chips-body">
          <span class="device-chip" *ngFor="let d of mlStats.devices">
            <mat-icon>router</mat-icon>{{ d }}
          </span>
        </div>
      </div>

      <!-- Two column: Prediction + Training -->
      <div class="two-col">

        <!-- Prediction card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-title">Anomaly Prediction</span>
              <span class="card-sub">Test the IsolationForest model</span>
            </div>
          </div>
          <div class="card-body">

            <div class="field" style="margin-bottom:.875rem">
              <label for="pred-device">Device ID</label>
              <div class="input-wrap">
                <mat-icon class="fi">router</mat-icon>
                <input id="pred-device" [(ngModel)]="predDeviceId" placeholder="e.g. sensor-001" />
              </div>
            </div>

            <div class="sensor-inputs">
              <div class="sensor-input-group">
                <label class="sensor-label">
                  <span class="sensor-dot temp"></span> Temperature (°C)
                </label>
                <input type="number" step="0.1" [(ngModel)]="predTemp" class="num-input"
                       [class.input-warn]="predTemp > 80" [class.input-crit]="predTemp > 100" />
              </div>
              <div class="sensor-input-group">
                <label class="sensor-label">
                  <span class="sensor-dot hum"></span> Humidity (%)
                </label>
                <input type="number" step="1" [(ngModel)]="predHumidity" class="num-input" />
              </div>
              <div class="sensor-input-group">
                <label class="sensor-label">
                  <span class="sensor-dot vib"></span> Vibration (m/s²)
                </label>
                <input type="number" step="0.01" [(ngModel)]="predVibration" class="num-input" />
              </div>
            </div>

            <div class="presets-row" style="margin:.875rem 0">
              <span class="preset-label-sm">Presets:</span>
              <button class="preset-btn green" (click)="setPredPreset('normal')">Normal</button>
              <button class="preset-btn red" (click)="setPredPreset('anomaly')">Anomalous</button>
            </div>

            <button class="run-btn" (click)="predict()" [disabled]="!predDeviceId || predicting">
              <mat-spinner *ngIf="predicting" diameter="18" class="btn-spin"></mat-spinner>
              <mat-icon *ngIf="!predicting">model_training</mat-icon>
              {{ predicting ? 'Running model…' : 'Run Prediction' }}
            </button>

            <div class="predict-result" *ngIf="predResult"
                 [class.r-anomaly]="predResult.is_anomaly"
                 [class.r-normal]="!predResult.is_anomaly"
                 role="status" aria-live="polite">
              <div class="result-icon">
                <mat-icon>{{ predResult.is_anomaly ? 'warning' : 'check_circle' }}</mat-icon>
              </div>
              <div class="result-content">
                <div class="result-title">
                  {{ predResult.is_anomaly ? 'ANOMALY DETECTED' : 'Normal Reading' }}
                  <span class="severity-badge"
                        *ngIf="predResult.severity && predResult.severity !== 'NORMAL'"
                        [class]="'sev-' + predResult.severity?.toLowerCase()">
                    {{ predResult.severity }}
                  </span>
                </div>
                <div class="result-detail">Score: <strong>{{ predResult.anomaly_score?.toFixed(4) }}</strong></div>
                <div class="result-detail" *ngIf="predResult.scores">
                  IF: <strong>{{ predResult.scores.isolation?.toFixed(3) }}</strong> &nbsp;
                  Z: <strong>{{ predResult.scores.zscore?.toFixed(2) }}&sigma;</strong> &nbsp;
                  Trend: <strong>{{ predResult.scores.trend ? 'yes' : 'no' }}</strong>
                </div>
                <div class="result-reason" *ngIf="predResult.reason">{{ predResult.reason }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Training card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-title">Model Training</span>
              <span class="card-sub">Retrain with latest Kafka data</span>
            </div>
          </div>
          <div class="card-body">

            <div class="train-log" *ngIf="trainingLog"
                 [class.log-success]="trainingStatus === 'success'"
                 [class.log-error]="trainingStatus === 'error'"
                 role="status" aria-live="polite">
              <mat-icon>{{ trainingStatus === 'success' ? 'check_circle' : 'error_outline' }}</mat-icon>
              <span>{{ trainingLog }}</span>
            </div>

            <button class="run-btn train" (click)="trainModel()" [disabled]="training">
              <mat-spinner *ngIf="training" diameter="18" class="btn-spin"></mat-spinner>
              <mat-icon *ngIf="!training">auto_fix_high</mat-icon>
              {{ training ? 'Training in progress…' : 'Retrain Model' }}
            </button>

            <div class="divider"></div>

            <!-- Auto-retrain config -->
            <p class="steps-title">Auto-Retrain Schedule</p>
            <div class="autotrain-box" *ngIf="autoTrainConfig">
              <div class="autotrain-row">
                <span class="autotrain-label">Enable auto-retraining</span>
                <button class="toggle-btn" (click)="toggleAutoTrain()"
                        [class.toggle-on]="autoTrainConfig.enabled"
                        [attr.aria-pressed]="autoTrainConfig.enabled">
                  <span class="toggle-thumb"></span>
                </button>
              </div>
              <div class="autotrain-row" *ngIf="autoTrainConfig.enabled">
                <span class="autotrain-label">Interval (hours)</span>
                <input type="number" min="1" max="168" step="1" class="interval-input"
                       [(ngModel)]="autoTrainIntervalHours"
                       (change)="saveAutoTrain()" />
              </div>
              <div class="autotrain-status" *ngIf="autoTrainConfig.last_train_time">
                <mat-icon>history</mat-icon>
                Last trained: {{ (autoTrainConfig.last_train_time * 1000) | date:'dd/MM HH:mm' }}
              </div>
              <div class="autotrain-status no-train" *ngIf="autoTrainConfig.enabled && !autoTrainConfig.last_train_time">
                <mat-icon>schedule</mat-icon> Waiting for first scheduled run…
              </div>
            </div>

            <div class="divider"></div>

            <p class="steps-title">Training pipeline:</p>
            <div class="steps">
              <div class="step">
                <div class="step-icon"><mat-icon>storage</mat-icon></div>
                <div class="step-text">Reads Parquet files from data lake</div>
              </div>
              <div class="step">
                <div class="step-icon"><mat-icon>tune</mat-icon></div>
                <div class="step-text">Fits IsolationForest (contamination=0.1)</div>
              </div>
              <div class="step">
                <div class="step-icon"><mat-icon>save</mat-icon></div>
                <div class="step-text">Persists model to /app/ml/models/</div>
              </div>
              <div class="step">
                <div class="step-icon"><mat-icon>done_all</mat-icon></div>
                <div class="step-text">Predictions available immediately</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }

    .severity-badge {
      display: inline-block; margin-left: 8px;
      padding: 2px 8px; border-radius: 12px; font-size: .68rem; font-weight: 700;
    }
    .sev-low      { background: rgba(234,179,8,.15);  color: #ca8a04; }
    .sev-high     { background: rgba(249,115,22,.15); color: #ea580c; }
    .sev-critical { background: rgba(239,68,68,.15);  color: #dc2626; }

    .result-reason {
      margin-top: 4px; font-size: .75rem; color: var(--text-muted);
      font-style: italic; line-height: 1.4;
    }

    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-2);
    }
    .card-title { font-size: .9rem; font-weight: 600; color: var(--text-primary); }
    .card-sub { font-size: .72rem; color: var(--text-muted); margin-top: 2px; }
    .card-title-group { display: flex; flex-direction: column; }
    .card-body { padding: 1.25rem; }

    /* Anomaly KPIs */
    .anomaly-kpis { margin-top: -0.25rem; margin-bottom: 1.25rem; }

    .rose-pill { background: rgba(239,68,68,.12) !important; color: #dc2626 !important; }

    /* Recent anomalies list */
    .anomaly-list { padding: .5rem 1.25rem 1rem; display: flex; flex-direction: column; gap: 6px; }
    .anomaly-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .5rem .75rem; border-radius: var(--radius-md);
      background: var(--c-error-bg); border-left: 3px solid var(--rose);
    }
    .anomaly-icon mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--rose); }
    .anomaly-detail { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .anomaly-device { font-size: .8rem; font-weight: 600; color: var(--text-primary); }
    .anomaly-ts { font-size: .72rem; color: var(--text-muted); }
    .anomaly-score { font-size: .75rem; color: var(--text-secondary); white-space: nowrap; }
    .anomaly-score strong { color: var(--rose); }

    /* Devices lake */
    .devices-lake-card { margin-bottom: 1.25rem; }
    .chips-body { display: flex; flex-wrap: wrap; gap: 8px; padding: 1rem 1.25rem; }
    .device-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--indigo-light); color: var(--indigo);
      padding: 4px 12px; border-radius: var(--radius-full);
      font-size: .8rem; font-weight: 500;
    }
    .device-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

    .sensor-inputs { display: flex; flex-direction: column; gap: .625rem; }
    .sensor-input-group { display: flex; flex-direction: column; gap: 4px; }
    .sensor-label {
      display: flex; align-items: center; gap: 6px;
      font-size: .75rem; font-weight: 600; color: var(--text-secondary);
    }
    .sensor-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .sensor-dot.temp { background: #ef4444; }
    .sensor-dot.hum  { background: #3b82f6; }
    .sensor-dot.vib  { background: #8b5cf6; }
    .num-input {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 8px 12px; font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .85rem;
      outline: none; color: var(--text-primary); background: var(--surface);
      transition: border-color var(--t-fast), background var(--t-slow); box-sizing: border-box;
    }
    .num-input:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(8,145,178,.1); }
    .num-input.input-warn { border-color: var(--amber); }
    .num-input.input-crit { border-color: var(--rose); }

    .presets-row { display: flex; align-items: center; gap: 6px; }
    .preset-label-sm { font-size: .73rem; color: var(--text-muted); }
    .preset-btn {
      padding: 5px 14px; border-radius: var(--radius-full);
      font-size: .75rem; font-weight: 600; border: none; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: opacity var(--t-fast);
    }
    .preset-btn:hover { opacity: .82; }
    .preset-btn.green { background: var(--c-success-bg); color: var(--c-success-text); }
    .preset-btn.red   { background: var(--c-error-bg);   color: var(--c-error-text); }

    .run-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; background: linear-gradient(135deg, var(--indigo), var(--indigo-dark));
      color: #fff; border: none; border-radius: var(--radius-md);
      padding: 12px; font-size: .9rem; font-weight: 600; font-family: 'Inter', sans-serif;
      cursor: pointer; box-shadow: 0 3px 12px rgba(var(--c-primary-rgb),.35);
      transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .run-btn:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
    .run-btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; transform: none; }
    .run-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .run-btn.train { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 3px 12px rgba(16,185,129,.35); margin-top: .5rem; }
    ::ng-deep .btn-spin circle { stroke: #fff !important; }

    .predict-result {
      display: flex; align-items: center; gap: .875rem; margin-top: 1rem;
      padding: .875rem 1rem; border-radius: var(--radius-md);
      animation: fadeUp .25s ease;
    }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .predict-result.r-anomaly { background: var(--c-error-bg); border-left: 3px solid var(--rose); }
    .predict-result.r-normal  { background: var(--c-success-bg); border-left: 3px solid var(--emerald); }
    .result-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .r-anomaly .result-icon mat-icon { color: var(--rose); }
    .r-normal  .result-icon mat-icon { color: var(--emerald); }
    .result-title { font-weight: 700; font-size: .9rem; margin-bottom: 4px; color: var(--text-primary); }
    .result-detail { font-size: .8rem; color: var(--text-secondary); }

    .train-log {
      display: flex; align-items: center; gap: 8px;
      padding: .625rem .875rem; border-radius: var(--radius-md); margin-bottom: .75rem;
      font-size: .85rem;
    }
    .train-log mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
    .train-log.log-success { background: var(--c-success-bg); color: var(--c-success-text); }
    .train-log.log-error   { background: var(--c-error-bg);   color: var(--c-error-text); }

    .divider { height: 1px; background: var(--border-2); margin: 1rem 0; }

    /* Auto-train */
    .autotrain-box {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: .875rem 1rem;
      display: flex; flex-direction: column; gap: .625rem;
    }
    .autotrain-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
    .autotrain-label { font-size: .8rem; color: var(--text-secondary); font-weight: 500; }

    .toggle-btn {
      width: 42px; height: 24px; border-radius: 12px;
      background: var(--border); border: none; cursor: pointer; position: relative;
      transition: background var(--t-fast);
    }
    .toggle-btn.toggle-on { background: var(--indigo); }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; transition: left var(--t-fast);
      box-shadow: 0 1px 4px rgba(0,0,0,.25);
    }
    .toggle-btn.toggle-on .toggle-thumb { left: 21px; }

    .interval-input {
      width: 80px; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 6px 10px; font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .85rem;
      outline: none; color: var(--text-primary); background: var(--surface); text-align: center;
    }
    .interval-input:focus { border-color: var(--indigo); }

    .autotrain-status {
      display: flex; align-items: center; gap: 5px;
      font-size: .75rem; color: var(--text-muted);
    }
    .autotrain-status mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .autotrain-status.no-train { color: var(--amber); }

    .steps-title { font-size: .78rem; font-weight: 600; color: var(--text-secondary); margin: 0 0 .625rem; }
    .steps { display: flex; flex-direction: column; gap: .625rem; }
    .step { display: flex; align-items: center; gap: .75rem; }
    .step-icon {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      background: var(--indigo-light); color: var(--indigo);
      display: flex; align-items: center; justify-content: center;
    }
    .step-icon mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .step-text { font-size: .8rem; color: var(--text-secondary); }
  `]
})
export class MlComponent implements OnInit {
  mlStats: any = null;
  mlHealth = 'checking';
  loadingStats = false;
  anomalyStats: any = null;
  autoTrainConfig: any = null;
  autoTrainIntervalHours = 6;

  predDeviceId = ''; predTemp = 25.0; predHumidity = 60.0; predVibration = 0.02;
  predicting = false; predResult: any = null;
  training = false; trainingLog = ''; trainingStatus = '';

  get anomalyDeviceCount() {
    if (!this.anomalyStats?.anomalies_by_device) return 0;
    return Object.keys(this.anomalyStats.anomalies_by_device).length;
  }

  constructor(private api: ApiService, private snack: MatSnackBar) {}
  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loadingStats = true; this.mlHealth = 'checking';
    forkJoin({
      stats:       this.api.getMlStats().pipe(catchError(() => of(null))),
      health:      this.api.getMlHealth().pipe(catchError(() => of(null))),
      anomaly:     this.api.getMlAnomalyStats().pipe(catchError(() => of(null))),
      autoTrain:   this.api.getAutoTrainConfig().pipe(catchError(() => of(null))),
    }).subscribe(({ stats, health, anomaly, autoTrain }) => {
      this.mlStats      = stats;
      this.mlHealth     = health ? 'ok' : 'error';
      this.anomalyStats = anomaly;
      this.autoTrainConfig = autoTrain;
      if (autoTrain) this.autoTrainIntervalHours = autoTrain.interval_hours ?? 6;
      this.loadingStats = false;
    });
  }

  loadStats() { this.loadAll(); }

  setPredPreset(type: string) {
    if (type === 'normal') { this.predTemp = 22; this.predHumidity = 55; this.predVibration = 0.01; }
    if (type === 'anomaly') { this.predTemp = 150; this.predHumidity = 99; this.predVibration = 12.0; }
  }

  predict() {
    if (!this.predDeviceId) return;
    this.predicting = true; this.predResult = null;
    this.api.predict(this.predDeviceId, this.predTemp, this.predHumidity, this.predVibration).subscribe({
      next: (r) => {
        this.predResult = r; this.predicting = false;
        // Refresh anomaly stats after prediction
        this.api.getMlAnomalyStats().pipe(catchError(() => of(null))).subscribe(a => this.anomalyStats = a);
      },
      error: (e) => {
        this.snack.open('Prediction error: ' + (e.error?.detail || e.status), 'Close', { duration: 5000 });
        this.predicting = false;
      }
    });
  }

  trainModel() {
    this.training = true; this.trainingLog = '';
    this.api.trainModel().subscribe({
      next: (r) => {
        this.trainingLog = r?.message || 'Training completed successfully';
        this.trainingStatus = 'success'; this.training = false;
        this.loadAll();
        this.snack.open('Model retrained!', 'OK', { duration: 3000 });
      },
      error: (e) => {
        this.trainingLog = 'Training failed: ' + (e.error?.detail || e.status);
        this.trainingStatus = 'error'; this.training = false;
      }
    });
  }

  toggleAutoTrain() {
    if (!this.autoTrainConfig) return;
    const newEnabled = !this.autoTrainConfig.enabled;
    this.api.setAutoTrainConfig(newEnabled, this.autoTrainIntervalHours).subscribe({
      next: (r) => {
        this.autoTrainConfig = { ...this.autoTrainConfig, ...r.config };
        this.snack.open(`Auto-retrain ${newEnabled ? 'enabled' : 'disabled'}`, 'OK', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to update auto-retrain config', 'Close', { duration: 3000 })
    });
  }

  saveAutoTrain() {
    if (!this.autoTrainConfig?.enabled) return;
    this.api.setAutoTrainConfig(true, this.autoTrainIntervalHours).subscribe({
      next: (r) => {
        this.autoTrainConfig = { ...this.autoTrainConfig, ...r.config };
        this.snack.open(`Auto-retrain interval set to ${this.autoTrainIntervalHours}h`, 'OK', { duration: 2000 });
      },
      error: () => this.snack.open('Failed to update interval', 'Close', { duration: 3000 })
    });
  }
}
