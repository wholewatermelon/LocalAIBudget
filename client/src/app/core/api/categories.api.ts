import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { silent } from '../http-context';
import { Account, AccountUpdate, Category, CategoryCreate, CategoryUpdate } from '../models';

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Category[]> {
    return this.http.get<Category[]>('/api/categories');
  }

  /** 409 on duplicate name; handled by the caller. */
  create(body: CategoryCreate): Observable<Category> {
    return this.http.post<Category>('/api/categories', body, { context: silent() });
  }

  /** Also used by "Apply" on an AI suggestion (`{ budgetLimit }`). Caller shows errors. */
  update(id: number, body: CategoryUpdate): Observable<Category> {
    return this.http.patch<Category>(`/api/categories/${id}`, body, { context: silent() });
  }

  /** 409 if referenced by transactions/splits; handled by the caller. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/${id}`, { context: silent() });
  }
}

@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Account[]> {
    return this.http.get<Account[]>('/api/accounts');
  }

  update(id: number, body: AccountUpdate): Observable<Account> {
    return this.http.patch<Account>(`/api/accounts/${id}`, body);
  }
}
