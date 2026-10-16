import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { MonthService } from './core/month.service';
import { HealthIndicator } from './layout/health-indicator';
import { MonthPicker } from './layout/month-picker';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MonthPicker,
    HealthIndicator,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (narrow()) {
        <button mat-icon-button aria-label="Toggle navigation" (click)="sidenav.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a class="brand" routerLink="/" queryParamsHandling="preserve">
        <mat-icon>savings</mat-icon>
        <span class="brand-text">LocalAI Budget</span>
      </a>
      <span class="spacer"></span>
      <app-month-picker />
      <app-health-indicator />
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav
        #sidenav
        [mode]="narrow() ? 'over' : 'side'"
        [opened]="!narrow()"
        class="sidenav"
      >
        <mat-nav-list>
          @for (item of nav; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              queryParamsHandling="preserve"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"
              [activated]="rla.isActive"
              (click)="closeIfNarrow(sidenav)"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .toolbar {
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-large);
    }
    .spacer {
      flex: 1 1 auto;
    }
    .container {
      flex: 1 1 auto;
    }
    .sidenav {
      width: 220px;
      border-right: 1px solid var(--mat-sys-outline-variant);
    }
    @media (max-width: 599px) {
      .brand-text {
        display: none;
      }
    }
  `,
})
export class App {
  // Inject eagerly so it observes the very first navigation and resolves the default month.
  protected readonly months = inject(MonthService);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/process', label: 'Process', icon: 'upload_file' },
    { path: '/transactions', label: 'Transactions', icon: 'receipt_long' },
    { path: '/categories', label: 'Categories', icon: 'category' },
    { path: '/rules', label: 'Rules', icon: 'rule_settings' },
  ];

  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 899px)')
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  protected closeIfNarrow(sidenav: MatSidenav): void {
    if (this.narrow()) void sidenav.close();
  }
}
