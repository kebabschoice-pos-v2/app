/**
 * Utilities for formatting Indonesian Rupiah inputs and stripping leading zeros
 */

/**
 * Formats a number or numeric string into dotted Indonesian thousand format
 * Example: 110000 -> "110.000", "50000" -> "50.000", 0 -> "0"
 */
export function formatNumberWithDots(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  const numStr = String(val).replace(/\D/g, "");
  if (!numStr) return "0";
  const num = parseInt(numStr, 10);
  return new Intl.NumberFormat("id-ID").format(num);
}

/**
 * Parses a formatted thousand string back into a pure number
 * Example: "110.000" -> 110000, "0" -> 0
 */
export function parseNumberFromDots(str: string | number | undefined | null): number {
  if (typeof str === "number") return isNaN(str) ? 0 : str;
  if (!str) return 0;
  const cleaned = String(str).replace(/\D/g, "");
  if (!cleaned) return 0;
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Strips accidental leading zeros while typing
 * Example: "012" -> "12", "0" -> "0", "" -> ""
 */
export function stripLeadingZeros(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (!s) return "";
  // If user typed 0 followed by digits, strip leading zeros
  if (/^0\d+/.test(s)) {
    return s.replace(/^0+/, "") || "0";
  }
  return s;
}

/**
 * Sanitizes quantity inputs (removes leading zero, returns valid number)
 */
export function sanitizeQuantityInput(val: string | number | undefined | null): number {
  const stripped = stripLeadingZeros(val);
  const num = Number(stripped);
  return isNaN(num) || num < 0 ? 0 : num;
}
