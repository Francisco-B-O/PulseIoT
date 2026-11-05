import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../services/api.service';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'up' | 'down' | 'checking';
  icon: string;
  details?: any;
  lastChecked?: Date;
}

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-head">
        <div>
          <h2><mat-icon>monitor_heart</mat-icon> System Health</h2>
          <p class="subtitle">
            Real-time service status
            <span class="last-check" *ngIf="lastCheck"> · Last checked {{ lastCheck | date:'HH:mm:ss' }}</span>
          </p>
        </div>
        <button class="btn-primary" (click)="checkAll()" [disabled]="checking">
          <mat-icon [class.spin]="checking">refresh</mat-icon>
          {{ checking ? 'Checking…' : 'Refresh All' }}
        </button>
      </div>

      <!-- Overall status banner -->
      <div class="status-banner" [class.banner-up]="allUp && !checking" [class.banner-down]="!allUp && !checking" [class.banner-checking]="checking"
           role="status" aria-live="polite">
        <div class="banner-icon">
          <mat-icon>{{ checking ? 'hourglass_empty' : allUp ? 'check_circle' : 'warning' }}</mat-icon>
        </div>
        <div class="banner-text">
          <div class="banner-title">
            {{ checking ? 'Checking services…' : allUp ? 'All services operational' : 'Some services unreachable' }}
          </div>
          <div class="banner-sub">
            {{ upCount }} / {{ services.length }} services online
          </div>
        </div>
      </div>

      <!-- Service cards -->
      <div class="services-grid">
        <div class="service-card card" *ngFor="let svc of services"
             [class.card-up]="svc.status === 'up'"
             [class.card-down]="svc.status === 'down'">

          <div class="svc-top">
            <div class="svc-icon-wrap" [class.icon-up]="svc.status === 'up'" [class.icon-down]="svc.status === 'down'" [class.icon-checking]="svc.status === 'checking'">
              <mat-icon>{{ svc.icon }}</mat-icon>
            </div>
            <div class="svc-info">
              <div class="svc-name">{{ svc.name }}</div>
              <div class="svc-url">{{ svc.url }}</div>
            </div>
            <div class="svc-indicator">
              <mat-spinner *ngIf="svc.status === 'checking'" diameter="22"></mat-spinner>
              <div class="indicator-dot" *ngIf="svc.status !== 'checking'"
                   [class.dot-up]="svc.status === 'up'"
                   [class.dot-down]="svc.status === 'down'">
              </div>
            </div>
          </div>

          <div class="svc-status-row">
            <span class="svc-status-text"
                  [class.text-up]="svc.status === 'up'"
                  [class.text-down]="svc.status === 'down'"
                  [class.text-checking]="svc.status === 'checking'">
              {{ svc.status === 'up' ? 'Operational' : svc.status === 'down' ? 'Unreachable' : 'Checking…' }}
            </span>
            <span class="svc-time" *ngIf="svc.lastChecked">
              {{ svc.lastChecked | date:'HH:mm:ss' }}
            </span>
          </div>

          <!-- Gateway component details -->
          <div class="component-list" *ngIf="svc.details?.components">
            <div class="comp-divider"></div>
            <div class="comp-row" *ngFor="let k of objectKeys(svc.details.components)">
              <mat-icon class="comp-icon"
                        [class.comp-icon-up]="svc.details.components[k].status === 'UP'"
                        [class.comp-icon-down]="svc.details.components[k].status !== 'UP'">
                {{ svc.details.components[k].status === 'UP' ? 'check_circle' : 'cancel' }}
              </mat-icon>
              <span class="comp-name">{{ k }}</span>
              <span class="comp-status-badge" [class.up-badge]="svc.details.components[k].status === 'UP'">
                {{ svc.details.components[k].status }}
              </span>
            </div>
          </div>

          <!-- ML health details -->
          <div class="component-list" *ngIf="svc.details?.status && !svc.details?.components">
            <div class="comp-divider"></div>
            <div class="comp-row">
              <mat-icon class="comp-icon comp-icon-up">info</mat-icon>
              <span class="comp-name">Status</span>
              <span class="comp-status-badge up-badge">{{ svc.details.status }}</span>
            </div>
            <div class="comp-row" *ngIf="svc.details.model_loaded !== undefined">
              <mat-icon class="comp-icon" [class.comp-icon-up]="svc.details.model_loaded" [class.comp-icon-down]="!svc.details.model_loaded">
                {{ svc.details.model_loaded ? 'check_circle' : 'cancel' }}
              </mat-icon>
              <span class="comp-name">ML Model Loaded</span>
              <span class="comp-status-badge" [class.up-badge]="svc.details.model_loaded">
                {{ svc.details.model_loaded ? 'YES' : 'NO' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Architecture card -->
      <div class="card arch-card">
        <div class="arch-header">
          <mat-icon>account_tree</mat-icon>
          <span>Platform Architecture</span>
        </div>

        <div class="arch-flow">
          <div class="arch-node node-infra">
            <mat-icon>hub</mat-icon>
            <span>Kafka + Zookeeper</span>
          </div>
          <mat-icon class="arch-arrow">arrow_forward</mat-icon>
          <div class="arch-node node-gateway">
            <mat-icon>security</mat-icon>
            <span>API Gateway :8080</span>
          </div>
          <mat-icon class="arch-arrow">arrow_forward</mat-icon>
          <div class="arch-node node-services">
            <mat-icon>miscellaneous_services</mat-icon>
            <span>Microservices</span>
          </div>
          <mat-icon class="arch-arrow">arrow_forward</mat-icon>
          <div class="arch-node node-ml">
            <mat-icon>psychology</mat-icon>
            <span>ML Platform :8000</span>
          </div>
        </div>

        <div class="services-tags">
          <span class="svc-tag" *ngFor="let s of allServiceNames">{{ s }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { margin: 3px 0 0; font-size: .78rem; color: var(--text-muted); }
    .last-check { font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-size: .78rem; }

    /* Status banner */
    .status-banner {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 1.25rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem;
      border: 1px solid transparent; transition: all var(--t-default);
    }
    .banner-up      { background: var(--c-success-bg); border-color: rgba(16,185,129,.2); }
    .banner-down    { background: var(--c-warning-bg); border-color: rgba(245,158,11,.2); }
    .banner-checking{ background: var(--surface-2); border-color: var(--border); }

    .banner-icon { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .banner-up   .banner-icon { background: rgba(16,185,129,.15); color: var(--emerald); }
    .banner-down .banner-icon { background: rgba(245,158,11,.15); color: var(--amber); }
    .banner-checking .banner-icon { background: var(--border); color: var(--text-muted); }
    .banner-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }

    .banner-title { font-size: .9375rem; font-weight: 700; }
    .banner-up   .banner-title { color: var(--c-success-text); }
    .banner-down .banner-title { color: var(--c-warning-text); }
    .banner-checking .banner-title { color: var(--text-secondary); }
    .banner-sub { font-size: .78rem; margin-top: 2px; color: var(--text-muted); }

    /* Services grid */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }

    .service-card { position: relative; overflow: hidden; }
    .service-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
    .card-up::before   { background: linear-gradient(90deg, var(--emerald), var(--sky)); }
    .card-down::before { background: linear-gradient(90deg, var(--rose), var(--amber)); }

    .svc-top { display: flex; align-items: center; gap: .875rem; padding: 1.125rem 1.125rem .75rem; }

    .svc-icon-wrap {
      width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .svc-icon-wrap mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .icon-up       { background: var(--c-success-bg); color: var(--c-success); }
    .icon-down     { background: var(--c-error-bg);   color: var(--c-error); }
    .icon-checking { background: var(--border-2);     color: var(--text-muted); }

    .svc-info { flex: 1; min-width: 0; }
    .svc-name { font-size: .9rem; font-weight: 700; color: var(--text-primary); }
    .svc-url  { font-size: .7rem; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .svc-indicator { flex-shrink: 0; }
    .indicator-dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-up   { background: var(--emerald); box-shadow: 0 0 0 3px rgba(16,185,129,.2); animation: pulse-dot 2s ease infinite; }
    .dot-down { background: var(--rose);    box-shadow: 0 0 0 3px rgba(239,68,68,.2); }
    @keyframes pulse-dot {
      0%   { box-shadow: 0 0 0 0 rgba(16,185,129,.5); }
      70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
      100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
    }

    .svc-status-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.125rem .875rem;
    }
    .svc-status-text { font-size: .8rem; font-weight: 600; }
    .text-up       { color: var(--c-success); }
    .text-down     { color: var(--c-error); }
    .text-checking { color: var(--text-muted); }
    .svc-time { font-size: .7rem; color: var(--text-muted); font-family: 'JetBrains Mono', 'Roboto Mono', monospace; }

    /* Component details */
    .component-list { padding: 0 1.125rem .875rem; }
    .comp-divider { height: 1px; background: var(--border-2); margin-bottom: .625rem; }
    .comp-row { display: flex; align-items: center; gap: .5rem; padding: 3px 0; }
    .comp-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; }
    .comp-icon-up   { color: var(--emerald); }
    .comp-icon-down { color: var(--rose); }
    .comp-name { flex: 1; font-size: .78rem; color: var(--text-secondary); }
    .comp-status-badge {
      font-size: .65rem; font-weight: 700; padding: 2px 7px;
      border-radius: var(--radius-full); background: var(--c-error-bg); color: var(--c-error-text);
    }
    .comp-status-badge.up-badge { background: var(--c-success-bg); color: var(--c-success-text); }

    /* Architecture card */
    .arch-card { }
    .arch-header {
      display: flex; align-items: center; gap: .625rem;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-2);
      font-size: .9rem; font-weight: 600; color: var(--text-primary);
    }
    .arch-header mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--indigo); }

    .arch-flow {
      display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
      padding: 1.25rem;
    }
    .arch-node {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: .875rem 1rem; border-radius: var(--radius-md);
      font-size: .75rem; font-weight: 600; text-align: center; min-width: 110px;
      border: 1px solid transparent;
    }
    .arch-node mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .node-infra   { background: var(--c-violet-bg);  color: var(--c-violet-text);  border-color: rgba(139,92,246,.2); }
    .node-gateway { background: var(--c-error-bg);   color: var(--c-error-text);   border-color: rgba(239,68,68,.2); }
    .node-services{ background: var(--c-success-bg); color: var(--c-success-text); border-color: rgba(16,185,129,.2); }
    .node-ml      { background: var(--c-info-bg);    color: var(--c-info-text);    border-color: rgba(14,165,233,.2); }
    .arch-arrow { color: var(--text-muted); font-size: 20px; }

    .services-tags {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--border-2); padding-top: .875rem;
    }
    .svc-tag {
      background: var(--surface-2); color: var(--text-secondary);
      padding: 4px 12px; border-radius: var(--radius-full);
      font-size: .73rem; font-weight: 500; border: 1px solid var(--border);
    }
  `]
})
export class HealthComponent implements OnInit {
  services: ServiceStatus[] = [
    { name: 'API Gateway',       icon: 'security',          url: `${environment.apiGatewayUrl.replace('/api/v1', '')}/actuator/health`, status: 'checking' },
    { name: 'ML Platform',       icon: 'psychology',         url: `${environment.mlApiUrl}/health`,                                      status: 'checking' },
    { name: 'Discovery Service', icon: 'hub',                url: `${environment.apiGatewayUrl}/discovery/health`,                       status: 'checking' },
  ];

  checking = false;
  lastCheck?: Date;
  allServiceNames = ['auth-service', 'gateway-service', 'device-service', 'ingestion-service', 'processing-service', 'alert-service', 'analytics-service', 'notification-service', 'iot-ml-platform'];
  objectKeys = Object.keys;

  constructor(private api: ApiService) {}
  ngOnInit() { this.checkAll(); }
  get allUp(): boolean { return this.services.every(s => s.status === 'up'); }
  get upCount(): number { return this.services.filter(s => s.status === 'up').length; }

  checkAll() {
    this.checking = true;
    this.services.forEach(s => s.status = 'checking');

    this.api.getGatewayHealth().pipe(catchError(() => of(null))).subscribe(r => {
      const svc = this.services[0];
      svc.status = r ? 'up' : 'down'; svc.details = r; svc.lastChecked = new Date();
      this.finishCheck();
    });

    this.api.getMlHealth().pipe(catchError(() => of(null))).subscribe(r => {
      const svc = this.services[1];
      svc.status = r ? 'up' : 'down'; svc.details = r; svc.lastChecked = new Date();
      this.finishCheck();
    });

    this.api.getDiscoveryHealth().pipe(catchError(() => of(null))).subscribe(r => {
      const svc = this.services[2];
      const discoveryStatus = r?.components?.discoveryComposite?.status;
      svc.status = discoveryStatus === 'UP' ? 'up' : 'down';
      svc.details = r?.components?.discoveryComposite?.components?.discoveryClient
        ? { components: { discoveryClient: r.components.discoveryComposite.components.discoveryClient } }
        : r?.components?.discoveryComposite;
      svc.lastChecked = new Date();
      this.finishCheck();
    });
  }

  private finishCheck() {
    if (this.services.every(s => s.status !== 'checking')) {
      this.checking = false;
      this.lastCheck = new Date();
    }
  }
}
