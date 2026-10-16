/**
 * Category semantics shared by the UI.
 *
 * Income categories (isIncome) and transfer categories (isTransfer: card payments, internal moves)
 * are excluded from spending: they are shown in a "money in / transfers" list, never as budget bars.
 * Per ARCHITECTURE.md F.2 the `isTransfer` flag is authoritative; the name check is only a fallback
 * for payloads from a server that predates the flag.
 */
export const TRANSFER_CATEGORY_NAME = 'Transfer';

/** Legacy fallback: identify the seeded Transfer category by name (case-insensitive). */
export function isTransferCategory(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === TRANSFER_CATEGORY_NAME.toLowerCase();
}

/** Uses `isTransfer` when present; falls back to the name check only if the field is missing. */
export function isTransfer(c: { name: string; isTransfer?: boolean | null }): boolean {
  return typeof c.isTransfer === 'boolean' ? c.isTransfer : isTransferCategory(c.name);
}

/** True when a category does not count toward spending budgets. */
export function isNonSpendingCategory(c: { name: string; isIncome: boolean; isTransfer?: boolean | null }): boolean {
  return c.isIncome || isTransfer(c);
}
