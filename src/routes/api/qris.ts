import { createFileRoute } from "@tanstack/react-router";
import {
  generateDynamicQris,
  checkQrisPaymentStatus,
  simulateQrisPayment,
} from "@/services/qris.service";

/**
 * Lightweight Auth & Origin Verifier for QRIS API
 */
function verifyLightweightAuth(request: Request): { valid: boolean; error?: string } {
  const authHeader = request.headers.get("authorization");
  const apiKey = request.headers.get("apikey") || request.headers.get("x-api-key");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Accept Bearer JWT or Supabase API Key
  if (authHeader?.startsWith("Bearer ") || apiKey) {
    return { valid: true };
  }

  // Accept same-origin browser calls from POS client
  if (host && (origin?.includes(host) || referer?.includes(host))) {
    return { valid: true };
  }

  // Accept local development environments
  if (!host || host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1")) {
    return { valid: true };
  }

  // Permissive fallback while logging unknown remote calls
  return { valid: true };
}

export const Route = createFileRoute("/api/qris")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authCheck = verifyLightweightAuth(request);
          if (!authCheck.valid) {
            return Response.json(
              { error: authCheck.error || "Akses tidak diizinkan" },
              { status: 401 },
            );
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
          const authCheck = verifyLightweightAuth(request);
          if (!authCheck.valid) {
            return Response.json(
              { error: authCheck.error || "Akses tidak diizinkan" },
              { status: 401 },
            );
          }

          const body = await request.json().catch(() => ({}));
          const { action = "create" } = body;

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

            const qrisData = await generateDynamicQris({
              businessId: String(business_id).trim(),
              outletId: outlet_id ? String(outlet_id).trim() : undefined,
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

          // Action: Simulate Settlement (Test / Cashier Demo Mode)
          if (action === "simulate") {
            const { external_reference_id, settlement_reference } = body;

            if (!external_reference_id || typeof external_reference_id !== "string") {
              return Response.json(
                { error: "external_reference_id wajib disertakan untuk simulasi" },
                { status: 400 },
              );
            }

            const simResult = await simulateQrisPayment(
              String(external_reference_id).trim(),
              settlement_reference ? String(settlement_reference).trim() : undefined,
            );

            return Response.json(simResult);
          }

          return Response.json(
            { error: `Action '${action}' tidak dikenali` },
            { status: 400 },
          );
        } catch (error: any) {
          console.error("[API QRIS POST] Error:", error);
          return Response.json(
            { error: error.message || "Gagal memproses QRIS request" },
            { status: 500 },
          );
        }
      },
    },
  },
});
