/**
 * Loyverse-style smart cash tender suggestions.
 *
 * Returns at most 3 Rupiah amounts strictly GREATER than `total`, obtained by
 * rounding the total up to each common banknote denomination. The cashier UI
 * always shows "Uang Pas" (exact) next to these suggestions.
 *
 *  - Rp 79.000 -> [80.000, 100.000]
 *  - Rp 9.000  -> [10.000, 20.000, 50.000]
 */
export const RUPIAH_DENOMINATIONS = [5000, 10000, 20000, 50000, 100000] as const;

export function getSmartCashSuggestions(total: number, maxSuggestions = 3): number[] {
  const safeTotal = Math.ceil(Number(total) || 0);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) return [];

  const candidates = new Set<number>();

  // Sub-1.000 odd totals (e.g. PB1 tax producing Rp 16.500 -> offer Rp 17.000 first)
  if (safeTotal % 1000 !== 0) {
    const nextThousand = Math.ceil(safeTotal / 1000) * 1000;
    if (nextThousand > safeTotal) candidates.add(nextThousand);
  }

  // Tiny totals (< Rp 5.000): include Rp 2.000 note step
  if (safeTotal < 5000) {
    const nextTwoThousand = Math.ceil(safeTotal / 2000) * 2000;
    if (nextTwoThousand > safeTotal) candidates.add(nextTwoThousand);
  }

  for (const denom of RUPIAH_DENOMINATIONS) {
    const roundedUp = Math.ceil(safeTotal / denom) * denom;
    if (roundedUp > safeTotal) candidates.add(roundedUp);
  }

  // Large bills (e.g. exact multiple of 100.000): offer next 50k and 100k steps
  if (candidates.size === 0) {
    candidates.add(safeTotal + 50000);
    candidates.add(safeTotal + 100000);
  }

  return Array.from(candidates)
    .sort((a, b) => a - b)
    .slice(0, Math.max(0, maxSuggestions));
}
