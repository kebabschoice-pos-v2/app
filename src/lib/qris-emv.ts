/**
 * Pure EMVCo / QRIS (Bank Indonesia – ASPI) helpers.
 *
 * Dependency-free on purpose: imported by the POS (browser), the QRIS service,
 * and transpiled directly by `scripts/test-integration.mjs`.
 */

export interface EmvTlv {
  tag: string;
  value: string;
}

/**
 * CRC16-CCITT (False) checksum required by EMVCo / QRIS.
 * Polynomial 0x1021, initial value 0xFFFF, no reflection, no final XOR.
 * Returns 4 uppercase hex characters.
 */
export function computeCrc16Ccitt(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i) & 0xff;
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/** Format a Tag-Length-Value element (2-digit decimal length). */
export function formatTLV(tag: string, value: string): string {
  const lenStr = String(value.length).padStart(2, "0");
  return `${tag}${lenStr}${value}`;
}

/** Normalise a pasted / decoded QRIS string (strip whitespace & line breaks). */
export function normalizeQrisPayload(raw: string | null | undefined): string {
  return String(raw || "").replace(/[\r\n\t]/g, "").trim();
}

/**
 * Parse top-level EMV TLV elements. Returns null when the payload is not a
 * well-formed TLV sequence (e.g. truncated or garbage text).
 */
export function parseEmvTlv(payload: string): EmvTlv[] | null {
  const items: EmvTlv[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) return null;
    const tag = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) return null;
    const len = Number(lenStr);
    const start = i + 4;
    const end = start + len;
    if (end > payload.length) return null;
    items.push({ tag, value: payload.slice(start, end) });
    i = end;
  }
  return items;
}

/** True when the trailing `6304XXXX` CRC matches the rest of the payload. */
export function verifyQrisCrc(payload: string): boolean {
  const clean = normalizeQrisPayload(payload);
  if (clean.length < 8) return false;
  const body = clean.slice(0, -4);
  if (!body.endsWith("6304")) return false;
  return computeCrc16Ccitt(body) === clean.slice(-4).toUpperCase();
}

export interface QrisPayloadValidation {
  ok: boolean;
  crcValid: boolean;
  isStatic: boolean;
  isDynamic: boolean;
  merchantName: string;
  merchantCity: string;
  error?: string;
}

/** Structural validation of a QRIS payload (static or dynamic). */
export function validateQrisPayload(raw: string | null | undefined): QrisPayloadValidation {
  const payload = normalizeQrisPayload(raw);
  const base: QrisPayloadValidation = {
    ok: false,
    crcValid: false,
    isStatic: false,
    isDynamic: false,
    merchantName: "",
    merchantCity: "",
  };
  if (!payload) return { ...base, error: "Payload QRIS kosong." };
  if (!payload.startsWith("000201")) {
    return { ...base, error: "Payload QRIS harus diawali 000201 (EMVCo Payload Format Indicator)." };
  }
  const tlv = parseEmvTlv(payload);
  if (!tlv) return { ...base, error: "Struktur TLV payload QRIS tidak valid / terpotong." };
  const get = (tag: string) => tlv.find((t) => t.tag === tag)?.value ?? "";
  const poi = get("01");
  const crcTag = tlv[tlv.length - 1];
  const result: QrisPayloadValidation = {
    ...base,
    crcValid: verifyQrisCrc(payload),
    isStatic: poi === "11",
    isDynamic: poi === "12",
    merchantName: get("59"),
    merchantCity: get("60"),
  };
  if (!crcTag || crcTag.tag !== "63" || crcTag.value.length !== 4) {
    return { ...result, error: "Tag CRC 6304 tidak ditemukan di akhir payload." };
  }
  if (get("58") !== "ID") {
    return { ...result, error: "Tag negara 5802ID tidak ditemukan." };
  }
  return { ...result, ok: true };
}

/**
 * Convert a STATIC QRIS payload (e.g. Shopee Partner / merchant sticker) into a
 * DYNAMIC payload with the transaction amount pre-filled:
 *  1. Tag 01 `010211` (static) -> `010212` (dynamic)
 *  2. Remove existing tag 54, insert `54` + 2-digit length + rounded amount
 *     right before tag 58 (`5802ID`)
 *  3. Recalculate CRC16-CCITT (0xFFFF, poly 0x1021) on tag `6304`
 *
 * Example: Rp 9.000 -> `...54049000` + `5802ID...6304XXXX`
 */
export function convertStaticQrisToDynamic(staticPayload: string, amount: number): string {
  const payload = normalizeQrisPayload(staticPayload);
  const rounded = Math.round(Number(amount) || 0);
  if (!payload) throw new Error("Payload QRIS statis kosong.");
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error("Nominal QRIS harus lebih besar dari 0.");
  }
  const amountStr = String(rounded);
  if (amountStr.length > 13) throw new Error("Nominal QRIS melebihi batas 13 digit.");
  const amountTlv = formatTLV("54", amountStr);

  const tlv = parseEmvTlv(payload);
  if (tlv && tlv.length > 0) {
    // Structured path: rebuild top-level TLV list (safe even if "5802ID" appears inside nested data)
    const rebuilt: string[] = [];
    const hasPoiTag = tlv.some((el) => el.tag === "01");
    let insertedAmount = false;
    for (const el of tlv) {
      if (el.tag === "63" || el.tag === "54") continue;
      if (!insertedAmount && (el.tag === "58" || Number(el.tag) > 58)) {
        rebuilt.push(amountTlv);
        insertedAmount = true;
      }
      if (el.tag === "00") {
        rebuilt.push(formatTLV(el.tag, el.value));
        if (!hasPoiTag) {
          rebuilt.push(formatTLV("01", "12"));
        }
      } else if (el.tag === "01") {
        rebuilt.push(formatTLV("01", "12"));
      } else {
        rebuilt.push(formatTLV(el.tag, el.value));
      }
    }
    if (!insertedAmount) rebuilt.push(amountTlv);
    const body = `${rebuilt.join("")}6304`;
    return `${body}${computeCrc16Ccitt(body)}`;
  }

  // Fallback string path for slightly malformed payloads
  let body = payload.replace(/6304[0-9A-Fa-f]{4}$/, "");
  body = body.replace("010211", "010212");
  body = body.replace(/54(\d{2})(\d+?)(?=5802ID)/, (match, lenStr: string, digits: string) =>
    digits.length === Number(lenStr) ? "" : match,
  );
  const countryIdx = body.indexOf("5802ID");
  if (countryIdx < 0) throw new Error("Tag 5802ID tidak ditemukan pada payload QRIS statis.");
  body = `${body.slice(0, countryIdx)}${amountTlv}${body.slice(countryIdx)}6304`;
  return `${body}${computeCrc16Ccitt(body)}`;
}
