import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { CategoriesApi } from './api/categories.api';
import { Category, CategoryCreate, CategoryUpdate } from './models';

/**
 * The ONLY place the UI reads/writes category data (pages must not call CategoriesApi directly).
 *
 * A future phase will show different categories to different people: add that visibility filter in
 * `visibleFilter` (or swap it for a user-aware predicate) and every page picks it up via `categories()`.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly api = inject(CategoriesApi);

  private readonly _all = signal<Category[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  /** Visibility hook for the future per-person permission phase. Currently shows everything. */
  private readonly visibleFilter = signal<(c: Category) => boolean>(() => true);

  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Categories visible to the current user, sorted by name. */
  readonly categories = computed(() => {
    const visible = this.visibleFilter();
    return this._all()
      .filter(visible)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly byId = computed(() => new Map(this.categories().map((c) => [c.id, c])));

  /** Re-fetch from the server. Safe to call repeatedly. */
  load(): void {
    this._loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (list) => {
          this._all.set(list);
          this._loaded.set(true);
        },
        error: () => this._loaded.set(true),
      });
  }

  /** Load once (no-op if already loaded). */
  ensureLoaded(): void {
    if (!this._loaded() && !this._loading()) this.load();
  }

  create(body: CategoryCreate): Observable<Category> {
    return this.api.create(body).pipe(tap((c) => this._all.update((list) => [...list, c])));
  }

  update(id: number, body: CategoryUpdate): Observable<Category> {
    return this.api
      .update(id, body)
      .pipe(tap((c) => this._all.update((list) => list.map((x) => (x.id === id ? c : x)))));
  }

  delete(id: number): Observable<void> {
    return this.api
      .delete(id)
      .pipe(tap(() => this._all.update((list) => list.filter((x) => x.id !== id))));
  }
}
