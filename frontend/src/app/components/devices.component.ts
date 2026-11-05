import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../services/api.service';
import { catchError, forkJoin, of } from 'rxjs';
import * as L from 'leaflet';

interface Device {
  id: string;
  deviceId: string;
  type: string;
  status: string;
  createdAt: string;
  simulated: boolean;
  lastSeen?: number | null;
  isOnline?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>router</mat-icon> Devices</h2>
          <p class="subtitle">
            {{ devices.length }} device{{ devices.length !== 1 ? 's' : '' }} registered ·
            <span class="online-count">{{ onlineCount }} online</span>
          </p>
        </div>
        <div class="head-actions">
          <button class="btn-outline" (click)="load()" [matTooltip]="'Refresh'" aria-label="Refresh device list">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
          </button>
          <button class="btn-primary" (click)="showForm = !showForm"
                  [attr.aria-expanded]="showForm" aria-controls="register-form">
            <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
            {{ showForm ? 'Cancel' : 'Register Device' }}
          </button>
        </div>
      </div>

      <!-- Register form -->
      <div id="register-form" class="register-panel" *ngIf="showForm" role="form" aria-label="Register new device">
        <div class="register-panel-header">
          <mat-icon>memory</mat-icon>
          <span>Register New Device</span>
        </div>
        <div class="register-row">
          <div class="field">
            <label for="device-id">Device ID</label>
            <div class="input-wrap">
              <mat-icon class="fi">tag</mat-icon>
              <input id="device-id" [(ngModel)]="newId" placeholder="e.g. sensor-001" autocomplete="off" />
            </div>
          </div>
          <div class="field">
            <label for="device-type">Sensor Type</label>
            <select id="device-type" [(ngModel)]="newType" class="select-input">
              <option value="TEMPERATURE">TEMPERATURE</option>
              <option value="HUMIDITY">HUMIDITY</option>
              <option value="VIBRATION">VIBRATION</option>
              <option value="MULTI_SENSOR">MULTI_SENSOR</option>
            </select>
          </div>
          <div class="field coord-field">
            <label>Location (optional)</label>
            <div class="coord-row">
              <div class="input-wrap coord-input-wrap">
                <mat-icon class="fi">my_location</mat-icon>
                <input type="number" step="0.000001" [(ngModel)]="newLat" placeholder="Latitude" class="coord-input" />
              </div>
              <div class="input-wrap coord-input-wrap">
                <mat-icon class="fi">my_location</mat-icon>
                <input type="number" step="0.000001" [(ngModel)]="newLng" placeholder="Longitude" class="coord-input" />
              </div>
              <button class="btn-map-pick" (click)="openLocPickerForNew()" matTooltip="Pick on map" type="button">
                <mat-icon>map</mat-icon>
              </button>
            </div>
            <span class="coord-hint" *ngIf="newLat != null && newLng != null">
              <mat-icon style="font-size:11px;width:11px;height:11px">location_on</mat-icon>
              {{ newLat | number:'1.4-4' }}, {{ newLng | number:'1.4-4' }}
            </span>
          </div>
          <div class="field sim-field">
            <label class="sim-label">
              <input type="checkbox" [(ngModel)]="newSimulated" class="sim-check" />
              <mat-icon class="sim-icon">play_circle</mat-icon>
              Simulate telemetry
            </label>
            <span class="sim-hint">Auto-send random sensor data</span>
          </div>
          <button class="btn-accent register-submit" (click)="create()"
                  [disabled]="!newId || !newType || creating">
            <mat-icon>{{ creating ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ creating ? 'Registering…' : 'Register' }}
          </button>
        </div>
      </div>

      <!-- Table card -->
      <div class="table-card">
        <div class="table-header">
          <span class="table-title">
            Registered Devices
            <span class="count-pill">{{ filtered.length }}</span>
          </span>
          <div class="search-wrap">
            <mat-icon class="search-icon">search</mat-icon>
            <input [(ngModel)]="search" (ngModelChange)="applySearch()" placeholder="Search devices…"
                   class="search-input" aria-label="Search devices" />
            <button *ngIf="search" class="search-clear" (click)="search=''; applySearch()" aria-label="Clear search">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <div class="loading-center" *ngIf="loading && devices.length === 0">
          <mat-spinner diameter="36"></mat-spinner>
        </div>

        <div class="empty" *ngIf="!loading && devices.length === 0">
          <mat-icon>router</mat-icon>
          <p>No devices registered yet. Use the button above to add your first device.</p>
        </div>
        <div class="empty" *ngIf="!loading && devices.length > 0 && filtered.length === 0">
          <mat-icon>search_off</mat-icon>
          <p>No devices match "{{ search }}"</p>
        </div>

        <div class="table-scroll" *ngIf="filtered.length > 0">
        <table aria-label="Devices table">
          <thead>
            <tr>
              <th scope="col">Device ID</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Live</th>
              <th scope="col">Simulated</th>
              <th scope="col">GPS</th>
              <th scope="col">Zone</th>
              <th scope="col">Last Seen</th>
              <th scope="col">Registered</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of filtered">
              <td>
                <span class="mono device-id">{{ d.deviceId }}</span>
              </td>
              <td>
                <span class="type-chip" [class]="'type-' + d.type?.toLowerCase()">{{ d.type }}</span>
              </td>
              <td>
                <div class="status-pill">
                  <span class="status-dot" [class.up]="d.status === 'ACTIVE'" [class.down]="d.status !== 'ACTIVE'"></span>
                  <span [class.status-active]="d.status === 'ACTIVE'" [class.status-inactive]="d.status !== 'ACTIVE'">
                    {{ d.status }}
                  </span>
                </div>
              </td>
              <td>
                <div class="live-pill" [class.live-online]="d.isOnline" [class.live-offline]="!d.isOnline"
                     [matTooltip]="deviceTooltip(d)">
                  <span class="live-dot" [class.pulse]="d.isOnline"></span>
                  {{ d.isOnline ? 'Online' : 'Offline' }}
                </div>
              </td>
              <td>
                <button class="sim-toggle" [class.sim-on]="d.simulated" [class.sim-off]="!d.simulated"
                        (click)="toggleSimulated(d)"
                        [matTooltip]="d.simulated ? 'Simulated — click to disable' : 'Not simulated — click to enable'"
                        [attr.aria-label]="(d.simulated ? 'Disable' : 'Enable') + ' simulation for ' + d.deviceId">
                  <mat-icon>{{ d.simulated ? 'play_circle' : 'pause_circle' }}</mat-icon>
                  {{ d.simulated ? 'ON' : 'OFF' }}
                </button>
              </td>
              <td>
                <div class="gps-cell">
                  <span *ngIf="d.latitude != null && d.longitude != null" class="gps-coords mono">
                    {{ d.latitude | number:'1.3-3' }}, {{ d.longitude | number:'1.3-3' }}
                  </span>
                  <span *ngIf="d.latitude == null || d.longitude == null" class="gps-none">No GPS</span>
                  <button class="gps-btn" (click)="openLocPicker(d)"
                          [matTooltip]="(d.latitude != null ? 'Edit location' : 'Set location on map')"
                          [attr.aria-label]="'Set GPS for ' + d.deviceId">
                    <mat-icon>{{ d.latitude != null ? 'edit_location' : 'add_location' }}</mat-icon>
                  </button>
                  <button *ngIf="d.latitude != null" class="gps-btn gps-clear-btn" (click)="clearLocation(d)"
                          matTooltip="Clear GPS" [attr.aria-label]="'Clear GPS for ' + d.deviceId">
                    <mat-icon>location_off</mat-icon>
                  </button>
                </div>
              </td>
              <td>
                <span *ngIf="deviceAreaMap.get(d.deviceId)" class="zone-badge">
                  <mat-icon class="zone-icon">pentagon</mat-icon>{{ deviceAreaMap.get(d.deviceId) }}
                </span>
                <span *ngIf="!deviceAreaMap.get(d.deviceId)" class="muted">—</span>
              </td>
              <td class="muted">
                <span *ngIf="d.lastSeen" class="mono" style="font-size:.78rem">
                  {{ d.lastSeen | date:'dd/MM HH:mm:ss' }}
                </span>
                <span *ngIf="!d.lastSeen" class="never-seen">—</span>
              </td>
              <td class="muted">{{ d.createdAt | date:'dd MMM yyyy, HH:mm' }}</td>
              <td>
                <div class="action-row">
                  <button class="action-btn blue" (click)="openTelemetry(d)"
                          matTooltip="Send telemetry" [attr.aria-label]="'Send telemetry to ' + d.deviceId">
                    <mat-icon>sensors</mat-icon>
                  </button>
                  <button class="action-btn red" (click)="remove(d.id, d.deviceId)"
                          matTooltip="Delete device" [attr.aria-label]="'Delete device ' + d.deviceId">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- ── Telemetry Modal ───────────────────────────────────── -->
    <div class="modal-backdrop" *ngIf="telDevice" (click)="closeTel()"
         role="dialog" aria-modal="true" [attr.aria-label]="'Send telemetry to ' + telDevice?.deviceId">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon"><mat-icon>sensors</mat-icon></div>
            <div>
              <div class="modal-title">Send Telemetry</div>
              <div class="modal-subtitle">Push sensor readings to Kafka</div>
            </div>
          </div>
          <button class="icon-btn" (click)="closeTel()" aria-label="Close dialog">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="modal-device-row">
          <span class="device-badge mono">{{ telDevice?.deviceId }}</span>
          <span class="type-chip" [class]="'type-' + telDevice?.type?.toLowerCase()">{{ telDevice?.type }}</span>
        </div>

        <div class="modal-presets">
          <span class="preset-label">Quick preset:</span>
          <button class="preset-btn green" (click)="preset('normal')">Normal</button>
          <button class="preset-btn yellow" (click)="preset('warn')">Warning</button>
          <button class="preset-btn red" (click)="preset('critical')">Critical</button>
        </div>

        <div class="modal-fields">
          <div class="modal-field">
            <label class="modal-label">
              <mat-icon class="ml-icon temp">thermostat</mat-icon>
              Temperature (°C)
            </label>
            <input type="number" step="0.1" [(ngModel)]="tTemp" class="modal-input"
                   [class.input-warn]="tTemp > 80 && tTemp <= 100"
                   [class.input-crit]="tTemp > 100"
                   aria-label="Temperature in Celsius" />
            <div class="val-hint crit" *ngIf="tTemp > 100">
              <mat-icon>warning</mat-icon> Critical — will trigger alert
            </div>
            <div class="val-hint warn" *ngIf="tTemp > 80 && tTemp <= 100">
              <mat-icon>info_outline</mat-icon> Warning threshold exceeded
            </div>
          </div>

          <div class="modal-field">
            <label class="modal-label">
              <mat-icon class="ml-icon hum">water_drop</mat-icon>
              Humidity (%)
            </label>
            <input type="number" step="1" min="0" max="100" [(ngModel)]="tHum" class="modal-input"
                   aria-label="Humidity percentage" />
          </div>

          <div class="modal-field">
            <label class="modal-label">
              <mat-icon class="ml-icon vib">vibration</mat-icon>
              Vibration (m/s²)
            </label>
            <input type="number" step="0.01" min="0" [(ngModel)]="tVib" class="modal-input"
                   aria-label="Vibration in meters per second squared" />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-ghost" (click)="closeTel()">Cancel</button>
          <button class="btn-primary" (click)="sendTel()" [disabled]="sending">
            <mat-icon>{{ sending ? 'hourglass_empty' : 'send' }}</mat-icon>
            {{ sending ? 'Sending…' : 'Send Telemetry' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Location Picker Modal ─────────────────────────────── -->
    <div class="modal-backdrop" *ngIf="locPickerOpen" (click)="closeLocPicker()"
         role="dialog" aria-modal="true" aria-label="Set device location">
      <div class="modal loc-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <div class="modal-icon loc-icon"><mat-icon>location_on</mat-icon></div>
            <div>
              <div class="modal-title">Set Device Location</div>
              <div class="modal-subtitle">
                {{ locDevice ? locDevice.deviceId : 'New device' }} · Click the map to place a pin
              </div>
            </div>
          </div>
          <button class="icon-btn" (click)="closeLocPicker()" aria-label="Close location picker">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div id="loc-picker-map" class="loc-map"></div>

        <div class="loc-coords" *ngIf="pickedLat != null && pickedLng != null">
          <mat-icon>my_location</mat-icon>
          <span class="mono">{{ pickedLat | number:'1.5-5' }}, {{ pickedLng | number:'1.5-5' }}</span>
        </div>
        <div class="loc-coords loc-coords-empty" *ngIf="pickedLat == null || pickedLng == null">
          <mat-icon>touch_app</mat-icon>
          <span>Click anywhere on the map to place a pin</span>
        </div>

        <div class="modal-actions">
          <button class="btn-ghost" (click)="closeLocPicker()">Cancel</button>
          <button class="btn-outline loc-clear-btn" *ngIf="locDevice?.latitude != null" (click)="clearLocationFromPicker()">
            <mat-icon>location_off</mat-icon> Clear GPS
          </button>
          <button class="btn-primary" (click)="confirmLocPicker()" [disabled]="pickedLat == null || savingLoc">
            <mat-icon>{{ savingLoc ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ savingLoc ? 'Saving…' : 'Save Location' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }
    .online-count { color: var(--c-success); font-weight: 600; }
    .head-actions { display: flex; gap: 8px; }

    /* Register panel */
    .register-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem;
      box-shadow: var(--shadow-sm);
      animation: fadeUp .2s ease;
      transition: background var(--t-slow), border-color var(--t-slow);
    }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .register-panel-header {
      display: flex; align-items: center; gap: 8px;
      font-size: .875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;
    }
    .register-panel-header mat-icon { font-size: 17px; width: 17px; height: 17px; color: var(--indigo); }
    .register-row { display: flex; gap: .875rem; align-items: flex-end; flex-wrap: wrap; }
    .register-row .field { flex: 1; min-width: 180px; }
    .register-submit { align-self: flex-end; }

    /* Coordinate fields */
    .coord-field { min-width: 260px; }
    .coord-row { display: flex; gap: 6px; align-items: center; }
    .coord-input-wrap { flex: 1; }
    .coord-input { width: 100%; }
    .coord-hint {
      display: flex; align-items: center; gap: 3px;
      font-size: .7rem; color: var(--c-success); margin-top: 3px; font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
    }
    .btn-map-pick {
      width: 36px; height: 36px; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      background: var(--surface-2); color: var(--indigo); cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: border-color var(--t-fast), background var(--t-fast);
    }
    .btn-map-pick:hover { border-color: var(--indigo); background: var(--indigo-light); }
    .btn-map-pick mat-icon { font-size: 17px; width: 17px; height: 17px; }

    /* Search */
    .search-wrap {
      display: flex; align-items: center; gap: 6px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 0 10px; flex: 0 0 220px;
      transition: border-color var(--t-fast), background var(--t-slow);
    }
    .search-wrap:focus-within { border-color: var(--indigo); background: var(--surface); }
    .search-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-muted); }
    .search-input {
      flex: 1; border: none; outline: none; padding: 8px 0;
      background: transparent; font-family: 'Inter', sans-serif;
      font-size: .825rem; color: var(--text-primary);
    }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear {
      background: none; border: none; cursor: pointer; color: var(--text-muted);
      padding: 2px; line-height: 1; transition: color var(--t-fast);
    }
    .search-clear:hover { color: var(--text-primary); }
    .search-clear mat-icon { font-size: 15px; width: 15px; height: 15px; display: block; }

    /* Table specifics */
    .device-id { color: var(--indigo); font-weight: 500; font-size: .82rem; white-space: nowrap; }
    .table-scroll { overflow-x: auto; }
    .table-scroll table { min-width: 1080px; }
    .table-scroll td, .table-scroll th { padding-left: 14px; padding-right: 14px; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; font-weight: 500; }
    .status-active   { color: var(--c-success); }
    .status-inactive { color: var(--text-muted); }
    .never-seen { color: var(--text-muted); }

    /* GPS cell */
    .gps-cell { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
    .gps-coords { font-size: .72rem; color: var(--text-secondary); white-space: nowrap; }
    .gps-none { font-size: .72rem; color: var(--text-muted); font-style: italic; }
    .gps-btn {
      width: 24px; height: 24px; border: none; border-radius: 5px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      background: var(--indigo-light); color: var(--indigo);
      transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .gps-btn:hover { opacity: .8; transform: scale(1.06); }
    .gps-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .gps-clear-btn { background: var(--c-error-bg); color: #dc2626; }

    /* Live pill */
    .live-pill {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: .75rem; font-weight: 600;
      padding: 3px 9px; border-radius: var(--radius-full);
    }
    .live-online  { background: rgba(16,185,129,.12); color: #059669; }
    .live-offline { background: rgba(148,163,184,.1);  color: var(--text-muted); }
    .live-dot {
      width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0;
    }
    .live-dot.pulse { animation: pulse-dot 2s ease-in-out infinite; }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: .5; transform: scale(1.3); }
    }

    /* Simulated toggle in table */
    .sim-toggle {
      display: inline-flex; align-items: center; gap: 4px;
      border: none; border-radius: var(--radius-full);
      font-size: .72rem; font-weight: 700; cursor: pointer;
      padding: 3px 9px; font-family: 'Inter', sans-serif;
      transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .sim-toggle mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .sim-toggle:hover { opacity: .8; transform: scale(1.03); }
    .sim-on  { background: rgba(8,145,178,.15); color: var(--indigo); }
    .sim-off { background: rgba(148,163,184,.1);  color: var(--text-muted); }

    /* Simulated field in register form */
    .sim-field { display: flex; flex-direction: column; justify-content: flex-end; min-width: 160px; }
    .sim-label {
      display: flex; align-items: center; gap: 6px;
      font-size: .825rem; font-weight: 600; color: var(--text-primary);
      cursor: pointer; user-select: none;
    }
    .sim-check { width: 15px; height: 15px; accent-color: var(--indigo); cursor: pointer; }
    .sim-icon  { font-size: 16px; width: 16px; height: 16px; color: var(--indigo); }
    .sim-hint  { font-size: .72rem; color: var(--text-muted); margin-top: 2px; padding-left: 21px; }

    .zone-badge {
      display: inline-flex; align-items: center; gap: 3px;
      background: rgba(8,145,178,.1); color: var(--indigo);
      border-radius: var(--radius-full); padding: 2px 8px;
      font-size: .72rem; font-weight: 600; white-space: nowrap; max-width: 140px;
      overflow: hidden; text-overflow: ellipsis;
    }
    .zone-icon { font-size: 11px; width: 11px; height: 11px; flex-shrink: 0; }

    .action-row { display: flex; gap: 6px; }
    .action-btn {
      width: 30px; height: 30px; border: none; border-radius: 7px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .action-btn:hover { opacity: .8; transform: scale(1.05); }
    .action-btn.blue { background: var(--c-info-bg); color: #1d4ed8; }
    .action-btn.red  { background: var(--c-error-bg); color: #dc2626; }

    /* Modal base */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 100;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(3px); padding: 1rem;
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--surface); border-radius: var(--radius-xl); width: 100%;
      max-width: 460px; padding: 1.5rem; box-shadow: var(--shadow-xl);
      border: 1px solid var(--border);
      animation: slideUp .22s ease;
      transition: background var(--t-slow), border-color var(--t-slow);
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .modal-title-wrap { display: flex; align-items: center; gap: .75rem; }
    .modal-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: var(--indigo-light); color: var(--indigo);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .modal-icon.loc-icon { background: rgba(16,185,129,.12); color: #059669; }
    .modal-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .modal-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
    .modal-subtitle { font-size: .75rem; color: var(--text-muted); margin-top: 1px; }

    .modal-device-row { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .device-badge {
      background: var(--indigo-light); color: var(--indigo);
      padding: 4px 12px; border-radius: var(--radius-full);
      font-size: .8rem; font-weight: 600;
    }

    .modal-presets {
      display: flex; align-items: center; gap: 6px;
      background: var(--surface-2); border-radius: var(--radius-md);
      padding: .625rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .preset-label { font-size: .75rem; color: var(--text-muted); margin-right: 4px; }
    .preset-btn {
      padding: 5px 14px; border-radius: var(--radius-full);
      font-size: .75rem; font-weight: 600; border: none; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: opacity var(--t-fast), transform var(--t-fast);
    }
    .preset-btn:hover { opacity: .85; transform: scale(1.03); }
    .preset-btn.green  { background: var(--c-success-bg); color: var(--c-success-text); }
    .preset-btn.yellow { background: var(--c-warning-bg); color: var(--c-warning-text); }
    .preset-btn.red    { background: var(--c-error-bg);   color: var(--c-error-text); }

    .modal-fields { display: flex; flex-direction: column; gap: .875rem; }
    .modal-label {
      display: flex; align-items: center; gap: 6px;
      font-size: .75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px;
    }
    .ml-icon { font-size: 15px; width: 15px; height: 15px; }
    .ml-icon.temp { color: #ef4444; }
    .ml-icon.hum  { color: #3b82f6; }
    .ml-icon.vib  { color: #8b5cf6; }
    .modal-input {
      width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-md);
      padding: 10px 12px; font-family: 'Inter', sans-serif; font-size: .875rem;
      outline: none; color: var(--text-primary); background: var(--surface);
      transition: border-color var(--t-fast), background var(--t-slow);
      box-sizing: border-box;
    }
    .modal-input:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(8,145,178,.1); }
    .modal-input.input-warn { border-color: var(--amber); }
    .modal-input.input-crit { border-color: var(--rose); }
    .val-hint {
      display: flex; align-items: center; gap: 4px;
      font-size: .72rem; font-weight: 500; margin-top: 4px;
    }
    .val-hint mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .val-hint.crit { color: var(--rose); }
    .val-hint.warn { color: var(--amber); }

    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-2); }

    /* Location picker modal */
    .loc-modal { max-width: 600px; }
    .loc-map {
      width: 100%; height: 320px; border-radius: var(--radius-md);
      border: 1px solid var(--border); margin-bottom: .875rem;
      background: #e5e7eb;
    }
    .loc-coords {
      display: flex; align-items: center; gap: 6px;
      font-size: .8rem; color: var(--text-secondary); margin-bottom: .25rem;
      padding: 6px 10px; background: var(--surface-2); border-radius: var(--radius-md);
    }
    .loc-coords mat-icon { font-size: 15px; width: 15px; height: 15px; color: #059669; flex-shrink: 0; }
    .loc-coords-empty mat-icon { color: var(--text-muted); }
    .loc-coords-empty { color: var(--text-muted); font-style: italic; }
    .loc-clear-btn { color: #dc2626 !important; border-color: #dc2626 !important; }
    .loc-clear-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
  `]
})
export class DevicesComponent implements OnInit, OnDestroy {
  devices: Device[] = []; filtered: Device[] = [];
  search = '';
  loading = false; showForm = false; creating = false;
  deviceAreaMap = new Map<string, string>();
  newId = ''; newType = 'MULTI_SENSOR'; newSimulated = false;
  newLat: number | null = null; newLng: number | null = null;
  telDevice: Device | null = null;
  tTemp = 25.0; tHum = 60.0; tVib = 0.02;
  sending = false;

  // Location picker state
  locPickerOpen = false;
  locDevice: Device | null = null;
  pickingForNew = false;
  pickedLat: number | null = null;
  pickedLng: number | null = null;
  savingLoc = false;
  private locMap?: L.Map;
  private locMarker?: L.Marker;

  get onlineCount() { return this.devices.filter(d => d.isOnline).length; }

  constructor(private api: ApiService, private snack: MatSnackBar) {}
  ngOnInit() { this.load(); }
  ngOnDestroy() { this.destroyLocMap(); }

  load() {
    this.loading = true;
    forkJoin({
      devices: this.api.getDevices().pipe(catchError(() => of([]))),
      areas:   this.api.getAreas().pipe(catchError(() => of([])))
    }).subscribe(({ devices, areas }) => {
      this.devices = devices;
      this.buildAreaMap(areas);
      this.applySearch();
      this.loading = false;
      this.loadOnlineStatus(devices);
    });
  }

  private buildAreaMap(areas: any[]): void {
    this.deviceAreaMap.clear();
    areas.forEach((a: any) => {
      (a.deviceIds ?? []).forEach((id: string) => {
        const existing = this.deviceAreaMap.get(id);
        this.deviceAreaMap.set(id, existing ? `${existing}, ${a.name}` : a.name);
      });
    });
  }

  private loadOnlineStatus(devs: any[]) {
    if (!devs.length) return;
    const calls = devs.map((d: any) =>
      this.api.getDeviceStats(d.deviceId).pipe(catchError(() => of({ deviceId: d.deviceId, lastSeen: null })))
    );
    forkJoin(calls).subscribe((stats: any[]) => {
      const now = Date.now();
      const statsMap = new Map(stats.map(s => [s.deviceId, s]));
      this.devices = this.devices.map(d => {
        const s = statsMap.get(d.deviceId);
        const lastSeen = s?.lastSeen ?? null;
        return {
          ...d,
          lastSeen,
          isOnline: lastSeen != null && (now - lastSeen) < ONLINE_THRESHOLD_MS
        };
      });
      this.applySearch();
    });
  }

  deviceTooltip(d: Device): string {
    if (!d.lastSeen) return 'No telemetry received';
    return 'Last seen: ' + new Date(d.lastSeen).toLocaleTimeString();
  }

  applySearch() {
    const q = this.search.toLowerCase();
    this.filtered = q ? this.devices.filter(d =>
      d.deviceId?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q) || d.status?.toLowerCase().includes(q)
    ) : [...this.devices];
  }

  create() {
    if (!this.newId || !this.newType) return;
    this.creating = true;
    this.api.createDevice(this.newId.trim(), this.newType, this.newSimulated, this.newLat, this.newLng).subscribe({
      next: () => {
        this.snack.open(`Device "${this.newId}" registered!`, 'OK', { duration: 3000 });
        this.newId = ''; this.newType = 'MULTI_SENSOR'; this.newSimulated = false;
        this.newLat = null; this.newLng = null;
        this.showForm = false; this.creating = false;
        this.load();
      },
      error: (e) => {
        this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 });
        this.creating = false;
      }
    });
  }

  toggleSimulated(d: Device) {
    const next = !d.simulated;
    this.api.setSimulated(d.deviceId, next).subscribe({
      next: (updated: any) => {
        d.simulated = updated.simulated;
        this.snack.open(
          `Simulation ${next ? 'enabled' : 'disabled'} for "${d.deviceId}"`,
          'OK', { duration: 3000 }
        );
      },
      error: (e) => this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 })
    });
  }

  remove(id: string, deviceId: string) {
    if (!confirm(`Delete device "${deviceId}"? This cannot be undone.`)) return;
    this.api.deleteDevice(deviceId).subscribe({
      next: () => { this.snack.open(`Device "${deviceId}" deleted.`, 'OK', { duration: 3000 }); this.load(); },
      error: (e) => this.snack.open('Delete failed: ' + e.status, 'Close', { duration: 5000 })
    });
  }

  openTelemetry(d: any) { this.telDevice = d; this.tTemp = 25; this.tHum = 60; this.tVib = 0.02; }
  closeTel() { this.telDevice = null; }
  preset(l: string) {
    if (l === 'normal')   { this.tTemp = 22;  this.tHum = 55; this.tVib = 0.01; }
    if (l === 'warn')     { this.tTemp = 75;  this.tHum = 85; this.tVib = 3.5;  }
    if (l === 'critical') { this.tTemp = 115; this.tHum = 95; this.tVib = 8.0;  }
  }

  sendTel() {
    this.sending = true;
    this.api.sendTelemetry(this.telDevice!.deviceId, this.tTemp, this.tHum, this.tVib).subscribe({
      next: () => {
        this.snack.open('Telemetry sent!', 'OK', { duration: 2000 });
        this.sending = false; this.closeTel();
      },
      error: (e) => {
        this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 });
        this.sending = false;
      }
    });
  }

  // ── Location picker ──────────────────────────────────────────────────────────

  openLocPicker(d: Device) {
    this.locDevice = d;
    this.pickingForNew = false;
    this.pickedLat = d.latitude ?? null;
    this.pickedLng = d.longitude ?? null;
    this.locPickerOpen = true;
    setTimeout(() => this.initLocMap(), 80);
  }

  openLocPickerForNew() {
    this.locDevice = null;
    this.pickingForNew = true;
    this.pickedLat = this.newLat;
    this.pickedLng = this.newLng;
    this.locPickerOpen = true;
    setTimeout(() => this.initLocMap(), 80);
  }

  private initLocMap() {
    const el = document.getElementById('loc-picker-map');
    if (!el) return;

    const center: L.LatLngTuple = this.pickedLat != null && this.pickedLng != null
      ? [this.pickedLat, this.pickedLng]
      : [40.416775, -3.70379]; // Madrid as default center

    this.locMap = L.map('loc-picker-map', { zoomControl: true }).setView(center, this.pickedLat == null ? 5 : 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.locMap);

    if (this.pickedLat != null && this.pickedLng != null) {
      this.locMarker = L.marker([this.pickedLat, this.pickedLng], { draggable: true }).addTo(this.locMap);
      this.locMarker.on('dragend', () => {
        const pos = this.locMarker!.getLatLng();
        this.pickedLat = pos.lat;
        this.pickedLng = pos.lng;
      });
    }

    this.locMap.on('click', (e: L.LeafletMouseEvent) => {
      this.pickedLat = e.latlng.lat;
      this.pickedLng = e.latlng.lng;
      if (this.locMarker) {
        this.locMarker.setLatLng(e.latlng);
      } else {
        this.locMarker = L.marker(e.latlng, { draggable: true }).addTo(this.locMap!);
        this.locMarker.on('dragend', () => {
          const pos = this.locMarker!.getLatLng();
          this.pickedLat = pos.lat;
          this.pickedLng = pos.lng;
        });
      }
    });
  }

  confirmLocPicker() {
    if (this.pickedLat == null || this.pickedLng == null) return;

    if (this.pickingForNew) {
      this.newLat = this.pickedLat;
      this.newLng = this.pickedLng;
      this.closeLocPicker();
      return;
    }

    if (!this.locDevice) return;
    this.savingLoc = true;
    this.api.updateDeviceLocation(this.locDevice.deviceId, this.pickedLat, this.pickedLng).subscribe({
      next: (updated: any) => {
        const d = this.devices.find(x => x.deviceId === this.locDevice!.deviceId);
        if (d) { d.latitude = updated.latitude; d.longitude = updated.longitude; }
        this.applySearch();
        this.snack.open(`Location saved for "${this.locDevice!.deviceId}"`, 'OK', { duration: 3000 });
        this.savingLoc = false;
        this.closeLocPicker();
      },
      error: (e) => {
        this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 });
        this.savingLoc = false;
      }
    });
  }

  clearLocation(d: Device) {
    if (!confirm(`Clear GPS coordinates for "${d.deviceId}"?`)) return;
    this.api.updateDeviceLocation(d.deviceId, null, null).subscribe({
      next: () => {
        d.latitude = null; d.longitude = null;
        this.applySearch();
        this.snack.open(`GPS cleared for "${d.deviceId}"`, 'OK', { duration: 3000 });
      },
      error: (e) => this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 })
    });
  }

  clearLocationFromPicker() {
    if (!this.locDevice) return;
    if (!confirm(`Clear GPS coordinates for "${this.locDevice.deviceId}"?`)) return;
    this.api.updateDeviceLocation(this.locDevice.deviceId, null, null).subscribe({
      next: () => {
        const d = this.devices.find(x => x.deviceId === this.locDevice!.deviceId);
        if (d) { d.latitude = null; d.longitude = null; }
        this.applySearch();
        this.snack.open(`GPS cleared for "${this.locDevice!.deviceId}"`, 'OK', { duration: 3000 });
        this.closeLocPicker();
      },
      error: (e) => this.snack.open('Error: ' + (e.error?.message || e.status), 'Close', { duration: 5000 })
    });
  }

  closeLocPicker() {
    this.destroyLocMap();
    this.locPickerOpen = false;
    this.locDevice = null;
    this.pickingForNew = false;
    this.pickedLat = null;
    this.pickedLng = null;
    this.savingLoc = false;
  }

  private destroyLocMap() {
    if (this.locMap) {
      this.locMap.remove();
      this.locMap = undefined;
      this.locMarker = undefined;
    }
  }
}
