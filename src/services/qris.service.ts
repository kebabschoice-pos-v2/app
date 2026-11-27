import { supabase } from "@/integrations/supabase/client";
import {
  computeCrc16Ccitt,
  convertStaticQrisToDynamic,
  formatTLV,
  normalizeQrisPayload,
  validateQrisPayload,
} from "@/lib/qris-emv";

// EMVCo helpers live in a dependency-free module (shared by POS UI + integration tests).
export {
  computeCrc16Ccitt,
  convertStaticQrisToDynamic,
  formatTLV,
  normalizeQrisPayload,
  validateQrisPayload,
  verifyQrisCrc,
  parseEmvTlv,
} from "@/lib/qris-emv";

export interface QrisTransaction {
  id?: string;
  business_id: string;
  outlet_id?: string | null;
  order_id?: string | null;
  order_number: string;
  external_reference_id: string;
  amount: number;
  qris_payload: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  customer_name?: string | null;
  payment_time?: string | null;
  settlement_reference?: string | null;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export interface QrisTransactionResponse {
  external_reference_id: string;
  qris_payload: string;
  amount: number;
  order_number: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  expires_at: string;
  merchant_name: string;
  qr_svg?: string;
  /** "static" = QRIS Statis Resmi Toko (konfirmasi kasir), "dynamic" = payload per transaksi */
  mode?: "dynamic" | "static";
  /** Tampilan gambar QRIS statis milik toko (jika diunggah Owner) */
  qr_image_url?: string;
  /**
   * true = payload statis toko sudah dikonversi ke QRIS Dinamis EMVCo (tag 010212 + tag 54 nominal + CRC baru),
   * sehingga nominal transaksi langsung terisi otomatis di aplikasi pembayaran pelanggan.
   */
  auto_amount?: boolean;
}

/**
 * Thrown when QRIS cannot be generated because the merchant has no valid
 * official configuration (no real NMID and no official static QRIS).
 */
export class QrisConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrisConfigurationError";
  }
}

export interface StaticQrisSettings {
  payload: string;
  imageUrl: string;
  merchantName: string;
}

function isProductionRuntime(): boolean {
  try {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return true;
  } catch {
    /* ignore */
  }
  try {
    if (import.meta.env?.PROD === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Sample/placeholder NMIDs shipped by older builds — never treated as real configuration. */
const PLACEHOLDER_NMIDS = new Set(["ID1020023456789", "ID1020304050607"]);

/**
 * Returns a valid merchant NMID, or null when nothing valid is configured.
 * Never substitutes a fabricated NMID.
 */
export function normalizeNmid(value: unknown): string | null {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (PLACEHOLDER_NMIDS.has(raw)) return null;
  if (!/^[A-Z0-9]{6,32}$/.test(raw)) return null;
  return raw;
}

/**
 * Merge the top-level `outlets.settings.qris_static_payload` (raw static QRIS text used for
 * automatic-amount dynamic QRIS) into the outlet's payment_settings object.
 */
function resolveOutletPaySettings(settings: any): any | null {
  if (!settings || typeof settings !== "object") return null;
  const pay = settings.payment_settings && typeof settings.payment_settings === "object"
    ? settings.payment_settings
    : null;
  const topLevelPayload = normalizeQrisPayload(settings.qris_static_payload);
  if (!pay && !topLevelPayload) return null;
  const merged = { ...(pay || {}) };
  if (topLevelPayload && !merged.qrisStaticPayload) merged.qrisStaticPayload = topLevelPayload;
  return merged;
}

async function loadOutletPaymentSettings(
  outletId?: string | null,
  businessId?: string | null,
): Promise<any | null> {
  try {
    if (outletId && outletId !== "all" && outletId !== "default") {
      const { data } = await (supabase.from("outlets" as any) as any)
        .select("settings")
        .eq("id", outletId)
        .maybeSingle();
      const directPay = resolveOutletPaySettings(data?.settings);
      if (
        directPay &&
        (directPay.qrisNmid ||
          directPay.qris_nmid ||
          directPay.nmid ||
          directPay.qrisStaticImageUrl ||
          directPay.staticQrisImageUrl ||
          directPay.static_qris_image_url ||
          directPay.qrisImageUrl ||
          directPay.qrisStaticPayload)
      ) {
        return directPay;
      }
      if (!businessId && directPay) return directPay;
    }

    if (businessId) {
      const { data: busOutlets } = await (supabase.from("outlets" as any) as any)
        .select("settings")
        .eq("business_id", businessId)
        .limit(10);
      if (Array.isArray(busOutlets)) {
        let firstFound: any = null;
        for (const out of busOutlets) {
          const pay = resolveOutletPaySettings(out?.settings);
          if (pay) {
            if (!firstFound) firstFound = pay;
            if (
              pay.qrisNmid ||
              pay.qris_nmid ||
              pay.nmid ||
              pay.qrisStaticImageUrl ||
              pay.staticQrisImageUrl ||
              pay.static_qris_image_url ||
              pay.qrisImageUrl ||
              pay.qrisStaticPayload
            ) {
              return pay;
            }
          }
        }
        if (firstFound) return firstFound;
      }
    }
    return null;
  } catch (err) {
    console.warn("[QRIS] Gagal membaca payment_settings outlet:", err);
    return null;
  }
}

export function extractStaticQris(cfg: any): StaticQrisSettings | null {
  if (!cfg) return null;
  if (String(cfg.qrisMode || "").toLowerCase() === "dynamic") return null;
  if (cfg.qrisStaticEnabled === false) return null;
  const payload = normalizeQrisPayload(
    cfg.qrisStaticPayload ||
      cfg.staticQrisPayload ||
      cfg.static_qris_payload ||
      cfg.qris_static_payload ||
      "",
  );
  const imageUrl = String(
    cfg.qrisStaticImageUrl ||
      cfg.staticQrisImageUrl ||
      cfg.static_qris_image_url ||
      cfg.qrisImageUrl ||
      cfg.qris_image_url ||
      "",
  ).trim();
  if (!payload && !imageUrl) return null;
  return {
    payload,
    imageUrl,
    merchantName: String(cfg.qrisMerchantName || cfg.merchantName || "").trim(),
  };
}

/** Device-level payment settings saved from the outlet payment settings screen. */
function loadLocalPaymentSettings(): any | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("kebabschoicepos_payment_settings");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[QRIS] Gagal membaca payment settings lokal:", err);
    return null;
  }
}

/**
 * Resolves the merchant's OFFICIAL static QRIS (from outlets.settings.payment_settings,
 * falling back to this device's saved payment settings).
 * Returns null when the merchant has not configured one — callers must not invent a QR.
 */
export async function loadStaticQrisSettings(
  outletId?: string | null,
): Promise<StaticQrisSettings | null> {
  const fromDb = extractStaticQris(await loadOutletPaymentSettings(outletId));
  if (fromDb) return fromDb;

  return extractStaticQris(loadLocalPaymentSettings());
}

/**
 * Audit trail for a cashier-confirmed static QRIS payment.
 * Best-effort: a logging failure must never block a real sale.
 */
export async function logStaticQrisConfirmation(params: {
  businessId: string;
  outletId?: string | null;
  orderNumber: string;
  amount: number;
  referenceId?: string | null;
  confirmedBy?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const reference = params.referenceId || `QRIS-STATIC-${Date.now()}`;
  try {
    const { error } = await (supabase.from("qris_transactions" as any) as any).insert({
      business_id: params.businessId,
      outlet_id: params.outletId || null,
      order_number: params.orderNumber,
      external_reference_id: reference,
      amount: params.amount,
      qris_payload: "STATIC_QRIS_OFFICIAL",
      status: "PAID",
      payment_time: now,
      settlement_reference: `CASHIER-${Date.now()}`,
      metadata: {
        mode: "static",
        source: "cashier_confirmation",
        confirmed_by: params.confirmedBy || null,
      },
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.warn("[QRIS] Gagal mencatat konfirmasi QRIS statis:", error.message);
    }
  } catch (err) {
    console.warn("[QRIS] Network error mencatat konfirmasi QRIS statis:", err);
  }
}

// In-memory & fallback cache for offline resilience and integration tests
const inMemoryQrisStore = new Map<string, QrisTransaction>();
const LOCAL_STORAGE_QRIS_KEY = "kebabschoicepos_qris_transactions";

function loadFallbackStore(): void {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_QRIS_KEY);
      if (raw) {
        const list: QrisTransaction[] = JSON.parse(raw);
        list.forEach((tx) => inMemoryQrisStore.set(tx.external_reference_id, tx));
      }
    }
  } catch {}
}

function persistFallbackTx(tx: QrisTransaction): void {
  inMemoryQrisStore.set(tx.external_reference_id, tx);
  try {
    if (typeof localStorage !== "undefined") {
      const list = Array.from(inMemoryQrisStore.values()).slice(-50);
      localStorage.setItem(LOCAL_STORAGE_QRIS_KEY, JSON.stringify(list));
    }
  } catch {}
}

/**
 * Build the per-transaction QRIS payload from the store's static QRIS:
 * static payload (010211) -> dynamic payload (010212 + tag 54 nominal + CRC16-CCITT recalculated).
 * Returns "" when the static payload is missing/invalid so callers fall back to the static image.
 */
export function buildAutoAmountQrisPayload(staticPayload: string, amount: number): string {
  const clean = normalizeQrisPayload(staticPayload);
  if (!clean || !(Number(amount) > 0)) return "";
  const check = validateQrisPayload(clean);
  if (!check.ok) return "";
  try {
    return convertStaticQrisToDynamic(clean, amount);
  } catch (err) {
    console.warn("[QRIS] Gagal konversi QRIS statis ke dinamis:", err);
    return "";
  }
}

/**
 * Generate authentic Indonesian Dynamic QRIS string compliant with ASPI / Bank Indonesia standards
 */
export function generateQrisPayload(params: {
  amount: number;
  orderNumber: string;
  merchantName?: string;
  nmid: string;
  city?: string;
}): string {
  const merchantName = (params.merchantName || "KEBABS CHOICE").toUpperCase().slice(0, 25);
  const city = (params.city || "JAKARTA").toUpperCase().slice(0, 15);
  const nmid = normalizeNmid(params.nmid);
  if (!nmid) {
    throw new QrisConfigurationError(
      "NMID QRIS merchant belum diatur atau tidak valid. Atur NMID resmi di Pengaturan Pembayaran outlet.",
    );
  }
  const amountStr = Math.round(params.amount).toString();

  // 1. Tag 00: Payload Format Indicator
  let payload = formatTLV("00", "01");

  // 2. Tag 01: Point of Initiation Method -> '12' indicates Dynamic QR (Single Transaction)
  payload += formatTLV("01", "12");

  // 3. Tag 51: Merchant Account Information (NMID)
  const nmidValue =
    formatTLV("00", "ID.CO.QRIS.WWW") +
    formatTLV("01", nmid) +
    formatTLV("02", "0204UME");
  payload += formatTLV("51", nmidValue);

  // 4. Tag 52: Merchant Category Code (5812: Eating places & Restaurants)
  payload += formatTLV("52", "5812");

  // 5. Tag 53: Transaction Currency (360 = IDR)
  payload += formatTLV("53", "360");

  // 6. Tag 54: Transaction Amount
  payload += formatTLV("54", amountStr);

  // 7. Tag 58: Country Code (ID)
  payload += formatTLV("58", "ID");

  // 8. Tag 59: Merchant Name
  payload += formatTLV("59", merchantName);

  // 9. Tag 60: Merchant City
  payload += formatTLV("60", city);

  // 10. Tag 61: Postal Code (Optional)
  payload += formatTLV("61", "12340");

  // 11. Tag 62: Additional Data Field (Invoice / Reference ID)
  const addData =
    formatTLV("01", params.orderNumber.slice(0, 25)) +
    formatTLV("07", "POS01");
  payload += formatTLV("62", addData);

  // 12. Tag 63: CRC16 Checksum
  const stringToSign = payload + "6304";
  const crc = computeCrc16Ccitt(stringToSign);

  return `${stringToSign}${crc}`;
}

/**
 * Generate a dynamic QRIS transaction record and payload
 */
export async function generateDynamicQris(params: {
  businessId: string;
  outletId?: string | null;
  orderId?: string | null;
  orderNumber: string;
  amount: number;
  customerName?: string | null;
  merchantName?: string;
  city?: string;
  metadata?: any;
}): Promise<QrisTransactionResponse> {
  loadFallbackStore();

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(timestamp + 15 * 60 * 1000).toISOString(); // 15 mins expiry

  const outletSettings = await loadOutletPaymentSettings(params.outletId, params.businessId);
  const localSettings = loadLocalPaymentSettings();
  const configuredMerchantName = String(
    outletSettings?.qrisMerchantName || localSettings?.qrisMerchantName || "",
  ).trim();
  const merchantName = configuredMerchantName || params.merchantName || "KEBABS CHOICE";

  // Official static QRIS of the store (uploaded/configured by the Owner for this outlet).
  // When present it is shown as-is — no fabricated NMID, no generated payload.
  const staticQris = extractStaticQris(outletSettings) || extractStaticQris(localSettings);
  if (staticQris) {
    // When the Owner saved the static QRIS text payload, convert it to an EMVCo dynamic QRIS
    // (010212 + tag 54 nominal + recalculated CRC) so the amount is pre-filled on scan.
    const autoAmountPayload = buildAutoAmountQrisPayload(staticQris.payload, params.amount);
    return {
      external_reference_id: `QRIS-STATIC-${timestamp}-${randomSuffix}`,
      qris_payload: autoAmountPayload || staticQris.payload,
      amount: params.amount,
      order_number: params.orderNumber,
      status: "PENDING",
      expires_at: expiresAt,
      merchant_name: staticQris.merchantName || merchantName,
      mode: "static",
      auto_amount: Boolean(autoAmountPayload),
      qr_image_url: autoAmountPayload ? undefined : staticQris.imageUrl || undefined,
    };
  }

  // Dynamic QRIS requires the merchant's real NMID. Never substitute a fake one.
  const nmid = normalizeNmid(
    outletSettings?.qrisNmid ??
      outletSettings?.qris_nmid ??
      outletSettings?.nmid ??
      localSettings?.qrisNmid ??
      localSettings?.qris_nmid ??
      localSettings?.nmid,
  );
  if (!nmid) {
    throw new QrisConfigurationError(
      "QRIS belum dikonfigurasi. Atur NMID QRIS resmi atau unggah QRIS Statis toko di Pengaturan Pembayaran outlet terlebih dahulu.",
    );
  }

  const externalReferenceId = `QRIS-${timestamp}-${randomSuffix}`;

  const qrisPayload = generateQrisPayload({
    amount: params.amount,
    orderNumber: params.orderNumber,
    merchantName,
    city: params.city || "JAKARTA",
    nmid,
  });

  const txData: QrisTransaction = {
    business_id: params.businessId,
    outlet_id: params.outletId || null,
    order_id: params.orderId || null,
    order_number: params.orderNumber,
    external_reference_id: externalReferenceId,
    amount: params.amount,
    qris_payload: qrisPayload,
    status: "PENDING",
    customer_name: params.customerName || null,
    metadata: {
      ...params.metadata,
      expires_at: expiresAt,
      merchant_name: merchantName,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Persist locally first for offline instant access
  persistFallbackTx(txData);

  // Persist to Supabase qris_transactions table if online
  try {
    const { error } = await supabase.from("qris_transactions" as any).insert(txData);
    if (error) {
      console.warn("[QRIS] Failed inserting to qris_transactions in Supabase, using fallback:", error.message);
    }
  } catch (err) {
    console.warn("[QRIS] Network error saving qris_transaction:", err);
  }

  return {
    external_reference_id: externalReferenceId,
    qris_payload: qrisPayload,
    amount: params.amount,
    order_number: params.orderNumber,
    status: "PENDING",
    expires_at: expiresAt,
    merchant_name: merchantName,
  };
}

/**
 * Check payment status of a QRIS transaction by external_reference_id
 */
export async function checkQrisPaymentStatus(
  externalReferenceId: string,
): Promise<{
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  payment_time?: string | null;
  settlement_reference?: string | null;
  amount?: number;
}> {
  loadFallbackStore();

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("qris_transactions" as any)
      .select("status, payment_time, settlement_reference, amount")
      .eq("external_reference_id", externalReferenceId)
      .maybeSingle();

    if (!error && data) {
      const resData = data as any;
      // Sync fallback store
      const local = inMemoryQrisStore.get(externalReferenceId);
      if (local && resData.status) {
        local.status = resData.status;
        local.payment_time = resData.payment_time;
        local.settlement_reference = resData.settlement_reference;
        persistFallbackTx(local);
      }
      return {
        status: resData.status,
        payment_time: resData.payment_time,
        settlement_reference: resData.settlement_reference,
        amount: resData.amount,
      };
    }
  } catch (err) {
    console.warn("[QRIS] Error checking remote status:", err);
  }

  // Fallback to local store
  const local = inMemoryQrisStore.get(externalReferenceId);
  if (local) {
    return {
      status: local.status,
      payment_time: local.payment_time,
      settlement_reference: local.settlement_reference,
      amount: local.amount,
    };
  }

  return { status: "PENDING" };
}

/**
 * Simulate QRIS Payment Settlement (Used for testing and cashier demo mode)
 */
export async function simulateQrisPayment(
  externalReferenceId: string,
  settlementRef?: string,
): Promise<{
  success: boolean;
  status: "PAID";
  message: string;
  settlement_reference: string;
}> {
  loadFallbackStore();
  const now = new Date().toISOString();
  const ref = settlementRef || `SETTLE-${Date.now()}`;

  // Update in local fallback store
  const local = inMemoryQrisStore.get(externalReferenceId);
  if (local) {
    local.status = "PAID";
    local.payment_time = now;
    local.settlement_reference = ref;
    local.updated_at = now;
    persistFallbackTx(local);
  }

  // Update in Supabase
  try {
    await supabase
      .from("qris_transactions" as any)
      .update({
        status: "PAID",
        payment_time: now,
        settlement_reference: ref,
        updated_at: now,
      })
      .eq("external_reference_id", externalReferenceId);

    // If order is linked, update sales_orders to paid
    if (local?.order_number) {
      await supabase
        .from("sales_orders")
        .update({
          status: "paid",
          paid_at: now,
          updated_at: now,
        })
        .eq("order_number", local.order_number);
    }
  } catch (err) {
    console.warn("[QRIS] Simulate error updating Supabase:", err);
  }

  return {
    success: true,
    status: "PAID",
    message: "Pembayaran QRIS berhasil diselesaikan (Auto-Settlement Simuler)",
    settlement_reference: ref,
  };
}

/**
 * Subscribe to realtime status changes of a QRIS transaction using Supabase Realtime + polling fallback
 */
export function subscribeQrisStatus(
  externalReferenceId: string,
  onStatusChange: (
    status: "PENDING" | "PAID" | "EXPIRED" | "FAILED",
    details?: {
      payment_time?: string | null;
      settlement_reference?: string | null;
    },
  ) => void,
): () => void {
  let isUnsubscribed = false;

  // 1. Supabase Realtime Subscription
  const channel = supabase
    .channel(`qris-status-${externalReferenceId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "qris_transactions",
        filter: `external_reference_id=eq.${externalReferenceId}`,
      },
      (payload) => {
        if (isUnsubscribed) return;
        const newRecord = payload.new as any;
        if (newRecord?.status) {
          onStatusChange(newRecord.status, {
            payment_time: newRecord.payment_time,
            settlement_reference: newRecord.settlement_reference,
          });
        }
      },
    )
    .subscribe();

  // 2. Light Polling Fallback (runs every 2.5 seconds)
  const intervalId = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const res = await checkQrisPaymentStatus(externalReferenceId);
      if (res.status === "PAID" || res.status === "EXPIRED" || res.status === "FAILED") {
        onStatusChange(res.status, {
          payment_time: res.payment_time,
          settlement_reference: res.settlement_reference,
        });
      }
    } catch {}
  }, 2500);

  // Return teardown function
  return () => {
    isUnsubscribed = true;
    clearInterval(intervalId);
    supabase.removeChannel(channel).catch(() => {});
  };
}
