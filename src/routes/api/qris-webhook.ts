import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Validate the webhook callback token against QRIS_WEBHOOK_SECRET.
 * The secret is mandatory: there is no local/test fallback and no hardcoded default.
 */
function getWebhookSecret(): string | null {
  try {
    const secret = String(process.env.QRIS_WEBHOOK_SECRET || "").trim();
    return secret ? secret : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison to avoid leaking the secret through timing. */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractCallbackToken(request: Request): string {
  const headerToken =
    request.headers.get("x-callback-token") ||
    request.headers.get("x-webhook-token") ||
    request.headers.get("x-signature") ||
    "";
  if (headerToken.trim()) return headerToken.trim();
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

interface StoredQrisTransaction {
  external_reference_id: string;
  business_id: string | null;
  order_number: string | null;
  amount: number | null;
  status: string | null;
  payment_time?: string | null;
  settlement_reference?: string | null;
}

async function loadQrisTransaction(params: {
  referenceId?: string;
  orderNumber?: string;
}): Promise<StoredQrisTransaction | null> {
  try {
    let query = (supabaseAdmin.from("qris_transactions" as any) as any).select(
      "external_reference_id, business_id, order_number, amount, status, payment_time, settlement_reference",
    );
    if (params.referenceId) {
      query = query.eq("external_reference_id", params.referenceId);
    } else if (params.orderNumber) {
      query = query
        .eq("order_number", params.orderNumber)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1);
    } else {
      return null;
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn("[Webhook] Gagal membaca qris_transactions:", error.message);
      return null;
    }
    return (data as StoredQrisTransaction) || null;
  } catch (err) {
    console.warn("[Webhook] Error membaca qris_transactions:", err);
    return null;
  }
}

export const Route = createFileRoute("/api/qris-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const webhookSecret = getWebhookSecret();
          if (!webhookSecret) {
            console.error(
              "[API QRIS Webhook] QRIS_WEBHOOK_SECRET belum dikonfigurasi; webhook ditolak.",
            );
            return Response.json(
              { error: "Webhook QRIS belum dikonfigurasi di server" },
              { status: 503 },
            );
          }

          const bodyText = await request.text();
          let body: any = {};
          try {
            body = JSON.parse(bodyText);
          } catch {
            return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
          }

          // 1. Signature / Token Validation — the callback token MUST equal the env secret.
          const callbackToken = extractCallbackToken(request);
          if (!callbackToken || !secureCompare(callbackToken, webhookSecret)) {
            return Response.json(
              { error: "Unauthorized: Invalid webhook signature or callback token" },
              { status: 401 },
            );
          }

          // Extract standard payment gateway payload parameters
          const externalReferenceId =
            body.external_reference_id ||
            body.reference_id ||
            body.external_id ||
            body.order_id;
          const orderNumber = body.order_number || body.bill_no;
          const settlementStatus = (
            body.status ||
            body.transaction_status ||
            "PAID"
          ).toUpperCase();
          const settlementReference =
            body.settlement_reference ||
            body.payment_id ||
            body.transaction_id ||
            `SETTLE-${Date.now()}`;
          const claimedAmount = parseAmount(
            body.amount ??
              body.total_amount ??
              body.gross_amount ??
              body.transaction_amount ??
              body.nominal ??
              body.bill_total,
          );

          if (!externalReferenceId && !orderNumber) {
            return Response.json(
              {
                error:
                  "Field external_reference_id atau order_number wajib disertakan",
              },
              { status: 400 },
            );
          }

          const isSettlement = ["PAID", "SETTLED", "SUCCESS", "CAPTURE"].includes(
            settlementStatus,
          );

          const transaction = await loadQrisTransaction({
            referenceId: externalReferenceId ? String(externalReferenceId).trim() : undefined,
            orderNumber: orderNumber ? String(orderNumber).trim() : undefined,
          });

          if (!transaction) {
            return Response.json(
              { error: "Transaksi QRIS tidak ditemukan" },
              { status: 404 },
            );
          }

          const targetRef = transaction.external_reference_id;

          // 2. Idempotency Check: Verify if transaction was already marked as PAID
          if (transaction.status === "PAID") {
            return Response.json({
              success: true,
              message: "Transaction already settled (idempotent)",
              status: "PAID",
              external_reference_id: targetRef,
              payment_time: transaction.payment_time,
              settlement_reference: transaction.settlement_reference,
            });
          }

          if (!isSettlement) {
            return Response.json({
              success: true,
              message: `Webhook received with non-settlement status: ${settlementStatus}`,
              status: settlementStatus,
            });
          }

          // 3. Amount verification — the settled nominal must match the stored transaction.
          if (claimedAmount === null) {
            return Response.json(
              { error: "Field amount wajib disertakan untuk verifikasi pembayaran" },
              { status: 400 },
            );
          }

          const storedAmount = parseAmount(transaction.amount);
          if (
            storedAmount === null ||
            Math.round(storedAmount) !== Math.round(claimedAmount)
          ) {
            return Response.json(
              { error: "Nominal pembayaran tidak cocok dengan transaksi QRIS" },
              { status: 409 },
            );
          }

          // 4. Process Settlement
          const paidAt = new Date().toISOString();

          const { error: qrisUpdateErr } = await (supabaseAdmin.from(
            "qris_transactions" as any,
          ) as any)
            .update({
              status: "PAID",
              payment_time: paidAt,
              settlement_reference: settlementReference,
              updated_at: paidAt,
            })
            .eq("external_reference_id", targetRef);

          if (qrisUpdateErr) {
            console.warn("[Webhook] Gagal update qris_transactions:", qrisUpdateErr.message);
          }

          // Also ensure the owning sales order is updated — scoped to the QRIS business.
          const linkedOrderNumber = orderNumber || transaction.order_number;
          if (linkedOrderNumber && transaction.business_id) {
            try {
              const { error: soErr } = await supabaseAdmin
                .from("sales_orders")
                .update({
                  status: "paid",
                  paid_at: paidAt,
                  updated_at: paidAt,
                } as any)
                .eq("order_number", String(linkedOrderNumber).trim())
                .eq("business_id", transaction.business_id);
              if (soErr) {
                console.warn("[Webhook] Warning updating sales_orders:", soErr.message);
              }
            } catch (soErr) {
              console.warn("[Webhook] Warning updating sales_orders:", soErr);
            }
          }

          return Response.json({
            success: true,
            message: "Payment settled successfully via webhook",
            status: "PAID",
            external_reference_id: targetRef,
            settlement_reference: settlementReference,
            payment_time: paidAt,
          });
        } catch (error: any) {
          console.error("[API QRIS Webhook] Error:", error);
          return Response.json(
            { error: error.message || "Failed to process QRIS webhook" },
            { status: 500 },
          );
        }
      },
    },
  },
});
