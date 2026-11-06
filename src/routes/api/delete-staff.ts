import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/delete-staff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authorization = request.headers.get("authorization");
          const token = authorization?.replace(/^Bearer\s+/i, "");

          if (!token) {
            return Response.json({ error: "Authorization token missing" }, { status: 401 });
          }

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey =
            process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabaseKey) {
            return Response.json({ error: "Supabase config missing" }, { status: 500 });
          }

          const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: authData, error: authError } = await authClient.auth.getUser(token);
          if (authError || !authData.user) {
            return Response.json({ error: "Session tidak valid" }, { status: 401 });
          }

          const callerId = authData.user.id;

          let isAuthorized = false;

          // Check if owner of any business
          const { data: ownedBusinesses } = await supabaseAdmin
            .from("businesses")
            .select("id")
            .eq("owner_id", callerId)
            .limit(1);

          if (ownedBusinesses && ownedBusinesses.length > 0) {
            isAuthorized = true;
          } else {
            const { data: callerMembers } = await supabaseAdmin
              .from("business_members")
              .select("role")
              .eq("user_id", callerId);

            isAuthorized = (callerMembers ?? []).some((m) =>
              ["owner", "admin"].includes(String(m.role || "").toLowerCase()),
            );
          }

          if (!isAuthorized) {
            return Response.json(
              { error: "Hanya Owner atau Admin yang dapat menghapus staff" },
              { status: 403 },
            );
          }

          const body = await request.json();
          const { user_id: targetUserId } = body;

          if (!targetUserId) {
            return Response.json({ error: "ID user staff wajib disertakan" }, { status: 400 });
          }

          if (targetUserId === callerId) {
            return Response.json(
              { error: "Anda tidak dapat menghapus akun Anda sendiri" },
              { status: 400 },
            );
          }

          // Delete from business_members
          await supabaseAdmin.from("business_members").delete().eq("user_id", targetUserId);

          // Delete from staff_profiles
          await supabaseAdmin
            .from("staff_profiles" as any)
            .delete()
            .eq("user_id", targetUserId);

          // Delete from user_roles
          await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);

          // Delete from profiles
          await supabaseAdmin.from("profiles").delete().eq("user_id", targetUserId);

          // Remove targetUserId from outlets.settings.assigned_staff_ids
          try {
            const { data: allOutlets } = await supabaseAdmin.from("outlets").select("id, settings");
            for (const out of allOutlets || []) {
              const s = (out.settings as any) || {};
              if (Array.isArray(s.assigned_staff_ids) && s.assigned_staff_ids.includes(targetUserId)) {
                const filtered = s.assigned_staff_ids.filter((id: string) => id !== targetUserId);
                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...s, assigned_staff_ids: filtered },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", out.id);
              }
            }
          } catch (outErr) {
            console.warn("[delete-staff] Error cleaning outlet settings:", outErr);
          }

          console.log(
            `[delete-staff] Successfully deleted user ${targetUserId} by caller ${callerId}`,
          );

          return Response.json({ success: true, deleted_id: targetUserId });
        } catch (err) {
          console.error("[delete-staff] Error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Gagal menghapus staff" },
            { status: 500 },
          );
        }
      },
    },
  },
});
