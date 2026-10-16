import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import { SplitInput, Transaction, TransactionFilters } from '../models';

@Injectable({ providedIn: 'root' })
export class TransactionsApi {
  private readonly http = inject(HttpClient);

  list(filters: TransactionFilters = {}): Observable<Transaction[]> {
    let params = new HttpParams();
    if (filters.month) params = params.set('month', filters.month);
    if (filters.accountId != null) params = params.set('accountId', filters.accountId);
    if (filters.categoryId != null) params = params.set('categoryId', filters.categoryId);
    if (filters.uncategorized) params = params.set('uncategorized', 'true');
    const search = filters.search?.trim();
    if (search) params = params.set('search', search);
    if (filters.needsReview) params = params.set('needsReview', 'true');
    return this.http.get<Transaction[]>('/api/transactions', { params });
  }

  /** "Looks good": clears needs_review without changing the category. Caller shows errors. */
  markReviewed(id: number): Observable<Transaction> {
    return this.http.patch<Transaction>(
      `/api/transactions/${id}`,
      { reviewed: true },
      { context: silent() },
    );
  }

  /** Bulk "looks good". */
  bulkReview(ids: number[]): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>('/api/transactions/review', { ids });
  }

  /** Caller handles errors (optimistic update + rollback), so no global snackbar. */
  setCategory(id: number, categoryId: number | null): Observable<Transaction> {
    return this.http.patch<Transaction>(
      `/api/transactions/${id}`,
      { categoryId },
      { context: silent() },
    );
  }

  /** Empty array clears splits. Caller (split dialog) shows server validation errors inline. */
  setSplits(id: number, splits: SplitInput[]): Observable<Transaction> {
    return this.http.put<Transaction>(
      `/api/transactions/${id}/splits`,
      { splits },
      { context: silent() },
    );
  }
}
