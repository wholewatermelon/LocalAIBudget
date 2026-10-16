import { Injectable } from '@nestjs/common';

/**
 * Single choke point for category visibility (future "Project Phase 2": per-person visibility, e.g. kids see
 * only some categories). Today everyone sees everything → `null`. Category-scoped reads (transactions,
 * budget summary/trend, insights) call `visibleCategoryIds()` and filter with it, so adding a per-viewer
 * allow-list later only changes this class (plus passing the viewer in).
 */
@Injectable()
export class CategoryAccessService {
  /** `null` = all categories visible; otherwise the allow-list of category ids. */
  visibleCategoryIds(): Promise<number[] | null> {
    return Promise.resolve(null);
  }
}

export function isVisible(
  categoryId: number | null,
  visible: number[] | null,
): boolean {
  return (
    visible === null || (categoryId !== null && visible.includes(categoryId))
  );
}
