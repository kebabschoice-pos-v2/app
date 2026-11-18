import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isUuid, requireBusinessAccess } from "@/lib/server-auth";

export const Route = createFileRoute("/api/delete-staff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireBusinessAccess(request);
          if (!access.ok) {
            return Response.json({ error: access.error }, { status: access.status });
          }

          const callerId = access.user.id;

          const body = await request.json();
          const { user_id: targetUserId } = body;

          if (!targetUserId) {
            return Response.json({ error: "ID user staff wajib disertakan" }, { status: 400 });
          }

          if (!isUuid(String(targetUserId))) {
            return Response.json({ error: "ID user staff tidak valid" }, { status: 400 });
          }

          if (targetUserId === callerId) {
            return Response.json(
              { error: "Anda tidak dapat menghapus akun Anda sendiri" },
              { status: 400 },
            );
          }

          // Only Owner/Admin of a business may delete staff inside that business.
          const { data: ownedBusinesses } = await supabaseAdmin
            .from("businesses")
            .select("id")
            .eq("owner_id", callerId);

          const adminBusinessIds = new Set<string>(
            (ownedBusinesses ?? [])
              .map((b) => b.id)
              .filter((id): id is string => !!id && access.businessIds.includes(id)),
          );

          const { data: callerMemberships } = await supabaseAdmin
            .from("business_members")
            .select("business_id, role")
            .eq("user_id", callerId)
            .in("business_id", access.businessIds);

          for (const m of callerMemberships ?? []) {
            const role = String(m.role || "").toLowerCase();
            if ((role === "owner" || role === "admin") && m.business_id) {
              adminBusinessIds.add(m.business_id);
            }
          }

          const scopedBusinessIds = Array.from(adminBusinessIds);

          if (scopedBusinessIds.length === 0) {
            return Response.json(
              { error: "Hanya Owner atau Admin yang dapat menghapus staff" },
              { status: 403 },
            );
          }

          // Target must be a member (or owner) of a business the caller administers.
          const { data: targetMemberships } = await supabaseAdmin
            .from("business_members")
            .select("business_id, role")
            .eq("user_id", targetUserId)
            .in("business_id", scopedBusinessIds);

          const { data: targetOwnedBusinesses } = await supabaseAdmin
            .from("businesses")
            .select("id")
            .eq("owner_id", targetUserId)
            .in("id", scopedBusinessIds);

          const targetBusinessIds = new Set<string>([
            ...(targetMemberships ?? [])
              .map((m) => m.business_id)
              .filter((id): id is string => !!id),
            ...(targetOwnedBusinesses ?? [])
              .map((b) => b.id)
              .filter((id): id is string => !!id),
          ]);

          if (targetBusinessIds.size === 0) {
            return Response.json(
              { error: "Staff tidak ditemukan di dalam bisnis Anda" },
              { status: 403 },
            );
          }

          const ownsBusinessInScope = (targetOwnedBusinesses ?? []).length > 0;
          const isOwnerMember = (targetMemberships ?? []).some(
            (m) => String(m.role || "").toLowerCase() === "owner",
          );
          if (ownsBusinessInScope || isOwnerMember) {
            return Response.json(
              { error: "Tidak dapat menghapus pemilik bisnis" },
              { status: 403 },
            );
          }

          // Remove tenant-scoped rows only inside the caller's administered businesses.
          const { error: memberDeleteError } = await supabaseAdmin
            .from("business_members")
            .delete()
            .eq("user_id", targetUserId)
            .in("business_id", scopedBusinessIds);

          if (memberDeleteError) {
            console.error("[delete-staff] business_members delete error:", memberDeleteError);
            return Response.json({ error: "Gagal menghapus keanggotaan staff" }, { status: 500 });
          }

          await supabaseAdmin
            .from("staff_profiles" as any)
            .delete()
            .eq("user_id", targetUserId)
            .in("business_id", scopedBusinessIds);

          // Global per-user rows may only be removed once the user belongs to no business at all.
          const { data: remainingMemberships } = await supabaseAdmin
            .from("business_members")
            .select("id")
            .eq("user_id", targetUserId)
            .limit(1);

          const { data: remainingOwned } = await supabaseAdmin
            .from("businesses")
            .select("id")
            .eq("owner_id", targetUserId)
            .limit(1);

          const stillRegistered =
            (remainingMemberships ?? []).length > 0 || (remainingOwned ?? []).length > 0;

          if (!stillRegistered) {
            await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
            await supabaseAdmin.from("profiles").delete().eq("user_id", targetUserId);
          }

          // Remove targetUserId from outlets.settings.assigned_staff_ids (scoped outlets only)
          try {
            const { data: scopedOutlets } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .in("business_id", scopedBusinessIds);

            for (const out of scopedOutlets ?? []) {
              const s = (out.settings as any) || {};
              if (
                Array.isArray(s.assigned_staff_ids) &&
                s.assigned_staff_ids.includes(targetUserId)
              ) {
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
