import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import {
  MainBudget,
  MainBudgetVersion,
  Month,
  MonthBudget,
  MonthItemUpdate,
  SeedPreview,
  SeedRequest,
} from '../models';

/**
 * Section H: versioned main budget + per-month adjustments.
 * Writes are silent (callers show inline errors / roll back); reads use the global snackbar.
 */
@Injectable({ providedIn: 'root' })
export class BudgetPlanApi {
  private readonly http = inject(HttpClient);

  // ---- Main budget ----

  main(month: Month): Observable<MainBudget> {
    return this.http.get<MainBudget>('/api/budget/main', { params: new HttpParams().set('month', month) });
  }

  history(categoryId: number): Observable<MainBudgetVersion[]> {
    return this.http.get<MainBudgetVersion[]>('/api/budget/main/history', {
      params: new HttpParams().set('categoryId', categoryId),
    });
  }

  /** Upsert the version starting at `effectiveFrom`; `amount: null` removes the category from main from then on. */
  setMainItem(categoryId: number, amount: number | null, effectiveFrom: Month): Observable<MainBudget> {
    return this.http.put<MainBudget>(
      `/api/budget/main/items/${categoryId}`,
      { amount, effectiveFrom },
      { context: silent() },
    );
  }

  /** Undo one version. */
  deleteMainVersion(categoryId: number, effectiveFrom: Month): Observable<void> {
    return this.http.delete<void>(`/api/budget/main/items/${categoryId}/versions/${effectiveFrom}`, {
      context: silent(),
    });
  }

  seedPreview(body: SeedRequest): Observable<SeedPreview> {
    return this.http.post<SeedPreview>('/api/budget/main/seed/preview', body, { context: silent() });
  }

  seed(body: SeedRequest): Observable<MainBudget> {
    return this.http.post<MainBudget>('/api/budget/main/seed', body, { context: silent() });
  }

  // ---- Month view / adjustments ----

  /** `quiet` = auxiliary read (e.g. dashboard markers): failures don't hit the global snackbar. */
  month(month: Month, quiet = false): Observable<MonthBudget> {
    return this.http.get<MonthBudget>('/api/budget/month', {
      params: new HttpParams().set('month', month),
      ...(quiet ? { context: silent() } : {}),
    });
  }

  setMonthItem(month: Month, categoryId: number, body: MonthItemUpdate): Observable<MonthBudget> {
    return this.http.put<MonthBudget>(`/api/budget/month/${month}/items/${categoryId}`, body, {
      context: silent(),
    });
  }

  /** Reset to main (removes the adjustment / month-only item). */
  resetMonthItem(month: Month, categoryId: number): Observable<MonthBudget> {
    return this.http.delete<MonthBudget>(`/api/budget/month/${month}/items/${categoryId}`, { context: silent() });
  }

  copyAdjustments(month: Month, fromMonth: Month): Observable<MonthBudget> {
    return this.http.post<MonthBudget>(
      `/api/budget/month/${month}/copy-adjustments`,
      { fromMonth },
      { context: silent() },
    );
  }
}
