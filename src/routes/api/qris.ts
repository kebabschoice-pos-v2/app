import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  authenticateRequest,
  requireBusinessAccess,
  resolveUserBusinessIds,
  outletBelongsToBusinesses,
} from "@/lib/server-auth";
import {
  QrisConfigurationError,
  generateDynamicQris,
  checkQrisPaymentStatus,
  simulateQrisPayment,
} from "@/services/qris.service";

function isProductionRuntime(): boolean {
  try {
    return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  } catch {
    return false;
  }
}

/**
 * Loads a QRIS transaction row so the caller's ownership of its business can be verified.
 */
async function loadQrisTransaction(referenceId: string): Promise<any | null> {
  try {
    const { data } = await supabaseAdmin
      .from("qris_transactions" as any)
      .select("external_reference_id, business_id, order_number, amount, status")
      .eq("external_reference_id", referenceId)
      .maybeSingle();
    return (data as any) || null;
  } catch (err) {
    console.error("[API QRIS] Gagal membaca transaksi QRIS:", err);
    return null;
  }
}

async function callerOwnsTransaction(
  userId: string,
  transaction: any,
): Promise<boolean> {
  const businessId = String(transaction?.business_id || "");
  if (!businessId) return false;
  const { allIds } = await resolveUserBusinessIds(userId, businessId);
  return allIds.includes(businessId);
}

export const Route = createFileRoute("/api/qris")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          if (!auth.ok) {
            return Response.json({ error: auth.error }, { status: auth.status });
          }

          const url = new URL(request.url);
          const referenceId = url.searchParams.get("reference_id")?.trim();

          if (!referenceId) {
            return Response.json(
              { error: "Parameter reference_id wajib disertakan" },
              { status: 400 },
            );
          }

          if (referenceId.length < 3 || referenceId.length > 128) {
            return Response.json(
              { error: "Panjang parameter reference_id tidak valid (3 - 128 karakter)" },
              { status: 400 },
            );
          }

          const transaction = await loadQrisTransaction(referenceId);
          if (!transaction) {
            return Response.json(
              { error: "Transaksi QRIS tidak ditemukan" },
              { status: 404 },
            );
          }

          if (!(await callerOwnsTransaction(auth.user.id, transaction))) {
            return Response.json(
              { error: "Anda tidak memiliki akses ke transaksi QRIS ini" },
              { status: 403 },
            );
          }

          const statusData = await checkQrisPaymentStatus(referenceId);
          return Response.json({
            success: true,
            data: statusData,
          });
        } catch (error: any) {
          console.error("[API QRIS GET] Error:", error);
          return Response.json(
            { error: error.message || "Gagal memeriksa status QRIS" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { action = "create" } = body;

          // Action: Simulate Settlement (Test / Cashier Demo Mode) — DEV ONLY
          if (action === "simulate") {
            if (isProductionRuntime()) {
              return Response.json(
                { error: "Simulasi pembayaran QRIS dinonaktifkan di produksi" },
                { status: 403 },
              );
            }

            const auth = await authenticateRequest(request);
            if (!auth.ok) {
              return Response.json({ error: auth.error }, { status: auth.status });
            }

            const { external_reference_id, settlement_reference } = body;

            if (!external_reference_id || typeof external_reference_id !== "string") {
              return Response.json(
                { error: "external_reference_id wajib disertakan untuk simulasi" },
                { status: 400 },
              );
            }

            const referenceId = external_reference_id.trim();
            const transaction = await loadQrisTransaction(referenceId);
            if (!transaction) {
              return Response.json(
                { error: "Transaksi QRIS tidak ditemukan" },
                { status: 404 },
              );
            }

            if (!(await callerOwnsTransaction(auth.user.id, transaction))) {
              return Response.json(
                { error: "Anda tidak memiliki akses ke transaksi QRIS ini" },
                { status: 403 },
              );
            }

            const simResult = await simulateQrisPayment(
              referenceId,
              settlement_reference ? String(settlement_reference).trim() : undefined,
            );

            return Response.json(simResult);
          }

          // Action: Create Dynamic QRIS
          if (action === "create") {
            const {
              business_id,
              outlet_id,
              order_id,
              order_number,
              amount,
              customer_name,
              merchant_name,
              metadata,
            } = body;

            if (!business_id || typeof business_id !== "string") {
              return Response.json(
                { error: "Field business_id wajib berupa string" },
                { status: 400 },
              );
            }

            if (!order_number || typeof order_number !== "string") {
              return Response.json(
                { error: "Field order_number wajib berupa string" },
                { status: 400 },
              );
            }

            if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
              return Response.json(
                { error: "Field amount wajib berupa angka lebih besar dari 0" },
                { status: 400 },
              );
            }

            if (amount > 100_000_000) {
              return Response.json(
                { error: "Nominal pembayaran melebihi batas maksimum QRIS (Rp 100.000.000)" },
                { status: 400 },
              );
            }

            // Verifies the Supabase JWT and that business_id belongs to the caller.
            const access = await requireBusinessAccess(request, business_id.trim());
            if (!access.ok) {
              return Response.json({ error: access.error }, { status: access.status });
            }

            const trimmedOutletId = outlet_id ? String(outlet_id).trim() : null;
            if (trimmedOutletId) {
              const outletAllowed = await outletBelongsToBusinesses(trimmedOutletId, [
                access.businessId,
              ]);
              if (!outletAllowed) {
                return Response.json(
                  { error: "Outlet tidak termasuk dalam bisnis ini" },
                  { status: 403 },
                );
              }
            }

            const qrisData = await generateDynamicQris({
              businessId: access.businessId,
              outletId: trimmedOutletId || undefined,
              orderId: order_id ? String(order_id).trim() : undefined,
              orderNumber: String(order_number).trim(),
              amount,
              customerName: customer_name ? String(customer_name).slice(0, 100) : undefined,
              merchantName: merchant_name ? String(merchant_name).slice(0, 50) : undefined,
              metadata,
            });

            return Response.json({
              success: true,
              data: qrisData,
            });
          }

          return Response.json(
            { error: `Action '${action}' tidak dikenali` },
            { status: 400 },
          );
        } catch (error: any) {
          console.error("[API QRIS POST] Error:", error);
          if (error instanceof QrisConfigurationError) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          return Response.json(
            { error: error.message || "Gagal memproses QRIS request" },
            { status: 500 },
          );
        }
      },
    },
  },
});
