import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Month, MonthSummary, StatementFile } from '../models';

@Injectable({ providedIn: 'root' })
export class StatementsApi {
  private readonly http = inject(HttpClient);

  months(): Observable<MonthSummary[]> {
    return this.http.get<MonthSummary[]>('/api/months');
  }

  list(month: Month): Observable<StatementFile[]> {
    return this.http.get<StatementFile[]>('/api/statements', {
      params: new HttpParams().set('month', month),
    });
  }

  /** Multipart upload: field `files` (1..n) and optional `month`. */
  upload(files: File[], month?: Month | null): Observable<StatementFile[]> {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    if (month) form.append('month', month);
    return this.http.post<StatementFile[]>('/api/statements/upload', form);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/statements/${id}`);
  }
}
