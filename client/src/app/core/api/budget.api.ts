import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BudgetSummary, Month, TrendPoint } from '../models';

@Injectable({ providedIn: 'root' })
export class BudgetApi {
  private readonly http = inject(HttpClient);

  summary(month: Month): Observable<BudgetSummary> {
    return this.http.get<BudgetSummary>('/api/budget/summary', {
      params: new HttpParams().set('month', month),
    });
  }

  /** `months` calendar months ending at `month` (server default: latest month with data), oldest first. */
  trend(months = 6, month?: Month | null): Observable<TrendPoint[]> {
    let params = new HttpParams().set('months', months);
    if (month) params = params.set('month', month);
    return this.http.get<TrendPoint[]>('/api/budget/trend', { params });
  }
}
