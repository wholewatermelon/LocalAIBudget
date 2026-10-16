import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import { Health } from '../models';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly http = inject(HttpClient);

  /** Background poll: errors are rendered by the indicator, not the global snackbar. */
  get(): Observable<Health> {
    return this.http.get<Health>('/api/health', { context: silent() });
  }
}
