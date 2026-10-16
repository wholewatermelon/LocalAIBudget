import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { MonthService } from '../../core/month.service';
import { formatMonth } from '../../core/month-utils';
import { MainBudgetTab } from './main-budget-tab';
import { MonthBudgetTab } from './month-budget-tab';

@Component({
  selector: 'app-budget-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, MonthBudgetTab, MainBudgetTab],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Budget · {{ monthLabel() }}</h1>
      </div>
      @if (month(); as m) {
        <mat-tab-group [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)" mat-stretch-tabs="false">
          <mat-tab label="This month">
            <ng-template matTabContent>
              <app-month-budget-tab [month]="m" />
            </ng-template>
          </mat-tab>
          <mat-tab label="Main budget">
            <ng-template matTabContent>
              <app-main-budget-tab [month]="m" />
            </ng-template>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
})
export class BudgetPage {
  private readonly router = inject(Router);
  protected readonly month = inject(MonthService).selected;
  protected readonly monthLabel = computed(() => formatMonth(this.month() ?? ''));

  /** `?tab=main` deep-links to the Main budget tab (e.g. from the Categories page). */
  readonly tab = input<string | undefined>();
  protected readonly tabIndex = computed(() => (this.tab() === 'main' ? 1 : 0));

  protected selectTab(i: number): void {
    const tree = this.router.parseUrl(this.router.url);
    const { tab: _drop, ...rest } = tree.queryParams;
    tree.queryParams = i === 1 ? { ...rest, tab: 'main' } : rest;
    void this.router.navigateByUrl(tree, { replaceUrl: true });
  }
}
