import { supabase } from "@/integrations/supabase/client";

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
 * Compute CRC16-CCITT (False) checksum required by EMVCo / Bank Indonesia QRIS specifications
 * Polynomial: 0x1021, Initial: 0xFFFF
 */
export function computeCrc16Ccitt(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i);
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

/**
 * Format Tag-Length-Value (TLV) string for EMVCo QRIS
 */
export function formatTLV(tag: string, value: string): string {
  const lenStr = String(value.length).padStart(2, "0");
  return `${tag}${lenStr}${value}`;
}

/**
 * Generate authentic Indonesian Dynamic QRIS string compliant with ASPI / Bank Indonesia standards
 */
export function generateQrisPayload(params: {
  amount: number;
  orderNumber: string;
  merchantName?: string;
  nmid?: string;
  city?: string;
}): string {
  const merchantName = (params.merchantName || "KEBABS CHOICE").toUpperCase().slice(0, 25);
  const city = (params.city || "JAKARTA").toUpperCase().slice(0, 15);
  const nmid = params.nmid || "ID1020023456789";
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
  const externalReferenceId = `QRIS-${timestamp}-${randomSuffix}`;

  const qrisPayload = generateQrisPayload({
    amount: params.amount,
    orderNumber: params.orderNumber,
    merchantName: params.merchantName || "KEBABS CHOICE",
    city: params.city || "JAKARTA",
  });

  const expiresAt = new Date(timestamp + 15 * 60 * 1000).toISOString(); // 15 mins expiry

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
      merchant_name: params.merchantName || "KEBABS CHOICE",
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
    merchant_name: params.merchantName || "KEBABS CHOICE",
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
