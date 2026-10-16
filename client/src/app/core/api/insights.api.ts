import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { silent } from '../http-context';
import { Insight, Month } from '../models';

/**
 * Generation is synchronous on the server: 30-90s normally, several minutes when a processing job is
 * competing for the local model. On timeout the panel re-GETs once to pick up a result saved server-side.
 */
export const INSIGHT_TIMEOUT_MS = 300_000;

@Injectable({ providedIn: 'root' })
export class InsightsApi {
  private readonly http = inject(HttpClient);

  latest(month: Month): Observable<Insight | null> {
    return this.http.get<Insight | null>('/api/insights', {
      params: new HttpParams().set('month', month),
    });
  }

  /** Errors (incl. TimeoutError) are shown inline by the insights panel. */
  generate(month: Month): Observable<Insight> {
    return this.http
      .post<Insight>('/api/insights/generate', { month }, { context: silent() })
      .pipe(timeout(INSIGHT_TIMEOUT_MS));
  }
}
