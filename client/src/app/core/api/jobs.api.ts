import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import { Job, JobMode, Month } from '../models';

@Injectable({ providedIn: 'root' })
export class JobsApi {
  private readonly http = inject(HttpClient);

  /** Starts a background job (202). 409 if one is already queued/running for the month. */
  process(month: Month, mode: JobMode = 'incremental'): Observable<Job> {
    return this.http.post<Job>('/api/jobs/process', { month, mode });
  }

  get(id: number): Observable<Job> {
    return this.http.get<Job>(`/api/jobs/${id}`);
  }

  /** `quiet` = background check: errors are not shown in the global snackbar. */
  list(month?: Month | null, limit = 20, quiet = false): Observable<Job[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    params = params.set('limit', limit);
    return this.http.get<Job[]>('/api/jobs', { params, ...(quiet ? { context: silent() } : {}) });
  }
}
