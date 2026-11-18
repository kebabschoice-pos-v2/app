import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { outletBelongsToBusinesses, requireBusinessAccess } from "@/lib/server-auth";

export const Route = createFileRoute("/api/receipt-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const requestedBusinessId = url.searchParams.get("businessId");
          const outletId = url.searchParams.get("outletId");

          // Verifies the JWT and that the requested business belongs to the caller.
          const access = await requireBusinessAccess(request, requestedBusinessId);
          if (!access.ok) {
            return Response.json({ error: access.error }, { status: access.status });
          }

          const activeBusinessId = access.businessId;

          if (outletId && !(await outletBelongsToBusinesses(outletId, [activeBusinessId]))) {
            return Response.json(
              { error: "Anda tidak memiliki akses ke outlet ini" },
              { status: 403 },
            );
          }

          // Fetch business info
          const { data: bus } = await supabaseAdmin
            .from("businesses")
            .select("id, name, logo, address, phone")
            .eq("id", activeBusinessId)
            .maybeSingle();

          const defaultSettings = {
            business_id: activeBusinessId,
            outlet_id: outletId || null,
            store_name: bus?.name || "Kebab's Choice",
            business_name: bus?.name || "Kebab's Choice",
            receipt_header: "Selamat datang di Kebab's Choice! Nikmati sajian kebab autentik kami.",
            receipt_footer: "Terima kasih atas kunjungan Anda. Kritik & Saran: wa.me/0859106660608",
            logo_url: bus?.logo || null,
            show_business_name: true,
            show_address: true,
            show_phone: true,
            show_tax: true,
            paper_size: "58mm",
            address: bus?.address || "Jl. Kebabs Raya No. 1, Jakarta",
            phone: bus?.phone || "0859-1066-60608",
            updated_at: new Date().toISOString(),
          };

          // 1. Try querying `receipt_settings` table
          let sourceTable = "outlets.settings";
          try {
            let query = supabaseAdmin
              .from("receipt_settings" as any)
              .select("*")
              .eq("business_id", activeBusinessId);

            if (outletId) {
              query = query.eq("outlet_id", outletId);
            } else {
              query = query.is("outlet_id", null);
            }

            const { data: rsData, error: rsErr } = await query.maybeSingle();
            if (!rsErr && rsData) {
              sourceTable = "receipt_settings";
              console.log("RECEIPT FETCH TABLE:", sourceTable);
              console.log("DATABASE RESPONSE:", "SUCCESS", rsData);
              return Response.json({
                success: true,
                sourceTable,
                data: {
                  ...defaultSettings,
                  ...((rsData as any) || {}),
                  business_name: bus?.name || defaultSettings.business_name,
                },
              });
            }
          } catch {
            // receipt_settings table not in schema cache yet, fall back to outlets
          }

          // 2. Fallback to `outlets` table
          if (outletId) {
            const { data: outletData } = await supabaseAdmin
              .from("outlets")
              .select("id, name, address, phone, settings")
              .eq("id", outletId)
              .maybeSingle();

            if (outletData) {
              sourceTable = "outlets.settings";
              const outletSettings = (outletData.settings as any)?.receipt || {};
              const merged = {
                ...defaultSettings,
                ...outletSettings,
                business_id: activeBusinessId,
                outlet_id: outletId,
                address: outletData.address || outletSettings.address || defaultSettings.address,
                phone: outletData.phone || outletSettings.phone || defaultSettings.phone,
                store_name:
                  outletSettings.store_name || outletData.name || defaultSettings.store_name,
              };
              console.log("RECEIPT FETCH TABLE:", sourceTable);
              console.log("DATABASE RESPONSE:", "SUCCESS", merged);
              return Response.json({ success: true, sourceTable, data: merged });
            }
          } else {
            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("id, name, address, phone, settings")
              .eq("business_id", activeBusinessId)
              .order("created_at", { ascending: true })
              .limit(1);

            if (outlets && outlets.length > 0 && outlets[0]) {
              sourceTable = "outlets.settings";
              const o = outlets[0];
              const outletSettings = (o.settings as any)?.receipt || {};
              const merged = {
                ...defaultSettings,
                ...outletSettings,
                business_id: activeBusinessId,
                outlet_id: null,
                address: o.address || outletSettings.address || defaultSettings.address,
                phone: o.phone || outletSettings.phone || defaultSettings.phone,
                store_name: outletSettings.store_name || o.name || defaultSettings.store_name,
              };
              console.log("RECEIPT FETCH TABLE:", sourceTable);
              console.log("DATABASE RESPONSE:", "SUCCESS", merged);
              return Response.json({ success: true, sourceTable, data: merged });
            }
          }

          console.log("RECEIPT FETCH TABLE:", sourceTable);
          console.log("DATABASE RESPONSE:", "SUCCESS (default)", defaultSettings);
          return Response.json({ success: true, sourceTable, data: defaultSettings });
        } catch (err) {
          console.error("[api/receipt-settings] GET error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const targetBusinessId = body.business_id;
          const targetOutletId = body.outlet_id || null;

          if (!targetBusinessId) {
            return Response.json({ error: "business_id wajib disertakan" }, { status: 400 });
          }

          // Verifies the JWT and that the target business belongs to the caller.
          const access = await requireBusinessAccess(request, targetBusinessId);
          if (!access.ok) {
            return Response.json({ error: access.error }, { status: access.status });
          }

          if (
            targetOutletId &&
            !(await outletBelongsToBusinesses(targetOutletId, [access.businessId]))
          ) {
            return Response.json(
              { error: "Anda tidak memiliki akses ke outlet ini" },
              { status: 403 },
            );
          }

          const cleanPayload = {
            store_name: body.store_name?.trim() || "Kebab's Choice",
            receipt_header: body.receipt_header?.trim() || "",
            receipt_footer: body.receipt_footer?.trim() || "",
            logo_url: body.logo_url ?? null,
            phone: body.phone?.trim() || null,
            address: body.address?.trim() || null,
            show_business_name: body.show_business_name !== false,
            show_address: body.show_address !== false,
            show_phone: body.show_phone !== false,
            show_tax: body.show_tax !== false,
            paper_size: body.paper_size || "58mm",
            updated_at: new Date().toISOString(),
          };

          console.log("RECEIPT SAVE PAYLOAD:", cleanPayload);

          let savedToTable = false;

          // 1. Try persisting to `receipt_settings` table
          try {
            const { error: rsErr } = await supabaseAdmin.from("receipt_settings" as any).upsert(
              {
                business_id: targetBusinessId,
                outlet_id: targetOutletId,
                ...cleanPayload,
              },
              { onConflict: "business_id,outlet_id" },
            );

            if (!rsErr) {
              savedToTable = true;
              console.log("RECEIPT FETCH TABLE: receipt_settings (saved)");
            }
          } catch {
            // Table doesn't exist yet, proceed to outlet settings
          }

          // 2. Persist to `outlets.settings.receipt`
          if (targetOutletId) {
            const { data: curOutlet } = await supabaseAdmin
              .from("outlets")
              .select("settings")
              .eq("id", targetOutletId)
              .single();

            const existingSettings = (curOutlet?.settings as any) || {};
            await supabaseAdmin
              .from("outlets")
              .update({
                settings: {
                  ...existingSettings,
                  receipt: cleanPayload,
                },
                address: cleanPayload.address || existingSettings.address,
                phone: cleanPayload.phone || existingSettings.phone,
              })
              .eq("id", targetOutletId);
          } else {
            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .eq("business_id", targetBusinessId);

            if (!outlets || outlets.length === 0) {
              await supabaseAdmin.from("outlets").insert({
                business_id: targetBusinessId,
                name: cleanPayload.store_name || "Main Outlet",
                code: "MAIN",
                settings: { receipt: cleanPayload },
                address: cleanPayload.address,
                phone: cleanPayload.phone,
              });
            } else {
              for (const o of outlets) {
                const existingSettings = (o.settings as any) || {};
                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: {
                      ...existingSettings,
                      receipt: cleanPayload,
                    },
                    address: cleanPayload.address || existingSettings?.address,
                    phone: cleanPayload.phone || existingSettings?.phone,
                  })
                  .eq("id", o.id);
              }
            }
          }

          console.log("DATABASE RESPONSE: SUCCESS", cleanPayload);

          return Response.json({
            success: true,
            savedToTable,
            data: {
              ...cleanPayload,
              business_id: targetBusinessId,
              outlet_id: targetOutletId,
            },
          });
        } catch (err) {
          console.error("[api/receipt-settings] POST error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
