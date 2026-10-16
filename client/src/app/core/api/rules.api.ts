import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import { MatchType, Rule, RuleCreate, RulePreview, RuleSuggestion, RuleUpdate } from '../models';

@Injectable({ providedIn: 'root' })
export class RulesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Rule[]> {
    return this.http.get<Rule[]>('/api/rules');
  }

  /** 409 on duplicate (pattern, matchType); caller shows a friendly message. */
  create(body: RuleCreate): Observable<Rule> {
    return this.http.post<Rule>('/api/rules', body, { context: silent() });
  }

  update(id: number, body: RuleUpdate): Observable<Rule> {
    return this.http.patch<Rule>(`/api/rules/${id}`, body, { context: silent() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/rules/${id}`);
  }

  /** Live preview while typing: silent (invalid regex while typing is expected). */
  preview(pattern: string, matchType: MatchType): Observable<RulePreview> {
    return this.http.post<RulePreview>('/api/rules/preview', { pattern, matchType }, { context: silent() });
  }

  /** Best-effort follow-up to a category correction; failures are ignored. */
  suggest(transactionId: number): Observable<RuleSuggestion> {
    return this.http.get<RuleSuggestion>('/api/rules/suggest', {
      params: new HttpParams().set('transactionId', transactionId),
      context: silent(),
    });
  }
}
