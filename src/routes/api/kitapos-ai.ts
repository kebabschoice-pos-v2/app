import { createFileRoute } from "@tanstack/react-router";
import { requireBusinessAccess } from "@/lib/server-auth";
import { generateInternalAiInsight } from "@/services/ai-assistant.service";

export interface KitaposAiRequest {
  prompt?: string;
  messages?: Array<{ role: string; content?: string; parts?: Array<{ text?: string }> }>;
  businessId?: string;
  businessName?: string;
  metrics?: Record<string, unknown>;
  products?: any[];
  inventory?: any[];
  customers?: any[];
  orders?: any[];
  outlets?: any[];
}

export interface KitaposAiResponse {
  message: string;
  data?: Record<string, unknown>;
  success: boolean;
}

export const Route = createFileRoute("/api/kitapos-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Real Supabase JWT verification: the caller must belong to a business.
          const access = await requireBusinessAccess(request);
          if (!access.ok) {
            return new Response(
              JSON.stringify({
                success: false,
                message: access.error,
              }),
              {
                status: access.status,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const body = (await request.json().catch(() => ({}))) as KitaposAiRequest;

          // When the client names a business, it must be one of the caller's businesses.
          if (body.businessId && !access.businessIds.includes(body.businessId)) {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Anda tidak memiliki akses ke bisnis ini",
              }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const scopedBusinessId = body.businessId || access.businessId;

          // Input validation: limits on prompt and messages
          if (body.prompt && typeof body.prompt === "string" && body.prompt.length > 5000) {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Prompt melebihi batas maksimum 5000 karakter",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (Array.isArray(body.messages) && body.messages.length > 50) {
            body.messages = body.messages.slice(-50);
          }

          // Extract prompt from either body.prompt or last user message
          let userPrompt = (body.prompt || "").trim();
          if (!userPrompt && Array.isArray(body.messages) && body.messages.length > 0) {
            const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
            if (lastUser) {
              if (typeof lastUser.content === "string") {
                userPrompt = lastUser.content;
              } else if (Array.isArray(lastUser.parts)) {
                userPrompt = lastUser.parts.map((p) => p.text || "").join(" ");
              }
            }
          }

          if (!userPrompt) {
            userPrompt = "Ringkasan bisnis hari ini";
          }

          // Sanitize userPrompt length
          userPrompt = userPrompt.slice(0, 4000);

          // Generate internal insight from POS Single Source of Truth
          const answer = generateInternalAiInsight(userPrompt, {
            businessName: body.businessName ? String(body.businessName).slice(0, 100) : undefined,
            metrics: body.metrics as any,
            products: Array.isArray(body.products) ? body.products.slice(0, 500) : undefined,
            inventory: Array.isArray(body.inventory) ? body.inventory.slice(0, 500) : undefined,
            customers: Array.isArray(body.customers) ? body.customers.slice(0, 500) : undefined,
            orders: Array.isArray(body.orders) ? body.orders.slice(0, 500) : undefined,
            outlets: Array.isArray(body.outlets) ? body.outlets.slice(0, 100) : undefined,
          });

          const responsePayload: KitaposAiResponse = {
            success: true,
            message: answer,
            data: {
              prompt: userPrompt,
              businessId: scopedBusinessId,
              businessName: body.businessName,
              metrics: body.metrics,
              timestamp: new Date().toISOString(),
            },
          };

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
          });
        } catch (error) {
          console.error("[Kita AI] Endpoint error:", error);
          const fallbackPayload: KitaposAiResponse = {
            success: false,
            message: "AI sedang tidak tersedia, menggunakan analisis internal.",
            data: {},
          };

          return new Response(JSON.stringify(fallbackPayload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      },
      GET: async ({ request }) => {
        const access = await requireBusinessAccess(request);
        if (!access.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              message: access.error,
            }),
            {
              status: access.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Kita AI Assistant Endpoint Active",
            data: { status: "online", businessId: access.businessId },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
