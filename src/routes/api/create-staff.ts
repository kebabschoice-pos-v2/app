import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isUuid, outletBelongsToBusinesses, requireBusinessRole } from "@/lib/server-auth";

export const Route = createFileRoute("/api/create-staff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const requestedBusinessId =
            typeof body.business_id === "string" && body.business_id ? body.business_id : null;

          // Verifies the JWT and that the caller is at least Manager in the target business.
          const access = await requireBusinessRole(request, requestedBusinessId, "manager");
          if (!access.ok) {
            console.error("CREATE STAFF REQUEST: Forbidden", access.error);
            return Response.json({ error: access.error }, { status: access.status });
          }

          const creatorId = access.user.id;
          const creatorBusinessId = access.businessId;
          const creatorRole = access.role;

          const {
            name,
            email,
            password,
            role: inputRole = "cashier",
            outlet_id,
            avatar_url,
            manager_permissions,
            owner_gmail_confirmed,
            is_outlet_account,
          } = body;

          // Input Validation
          if (!name || typeof name !== "string" || !name.trim()) {
            return Response.json({ error: "Nama lengkap staff wajib diisi" }, { status: 400 });
          }

          if (!email || typeof email !== "string" || !email.includes("@")) {
            return Response.json({ error: "Format alamat email tidak valid" }, { status: 400 });
          }

          if (!password || typeof password !== "string" || password.length < 6) {
            return Response.json({ error: "Password minimal harus 6 karakter" }, { status: 400 });
          }

          // Role Mapping to existing RBAC enums
          const normalizedInputRole = String(inputRole).toLowerCase().trim();
          const roleMapping: Record<string, "owner" | "admin" | "manager" | "cashier"> = {
            owner: "owner",
            admin: "admin",
            manager: "manager",
            cashier: "cashier",
            staff: "cashier", // Staff maps to cashier
          };

          const mappedRole = roleMapping[normalizedInputRole];
          if (!mappedRole) {
            console.error("CREATE STAFF REQUEST: Invalid role specified", inputRole);
            return Response.json(
              {
                error: `Role '${inputRole}' tidak valid. Pilih Owner, Admin, Manager, Cashier, atau Staff.`,
              },
              { status: 400 },
            );
          }

          // Only a real Owner may create another Owner account.
          if (mappedRole === "owner" && creatorRole !== "owner") {
            console.error("CREATE STAFF REQUEST: Non-owner attempted to create owner", creatorId);
            return Response.json(
              { error: "Hanya Owner yang dapat membuat akun dengan role Owner" },
              { status: 403 },
            );
          }

          // A provided outlet_id must belong to the creator's business.
          if (mappedRole !== "owner" && outlet_id) {
            const requestedOutletId = String(outlet_id);
            const outletAllowed =
              isUuid(requestedOutletId) &&
              (await outletBelongsToBusinesses(requestedOutletId, [creatorBusinessId]));

            if (!outletAllowed) {
              console.error("CREATE STAFF REQUEST: Invalid outlet for business", outlet_id);
              return Response.json(
                { error: "Outlet tidak valid atau bukan milik bisnis Anda" },
                { status: 403 },
              );
            }
          }

          console.log("CREATE STAFF REQUEST:", {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: mappedRole,
            outlet_id: outlet_id || null,
            business_id: creatorBusinessId,
            creator_id: creatorId,
            manager_permissions: Array.isArray(manager_permissions) ? manager_permissions : undefined,
            is_outlet_account: !!is_outlet_account,
          });

          // 1. Create user in Supabase Auth
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password: password,
            email_confirm: true,
            user_metadata: {
              display_name: name.trim(),
              role: mappedRole,
              manager_permissions: Array.isArray(manager_permissions) ? manager_permissions : undefined,
              owner_gmail_confirmed: !!owner_gmail_confirmed,
              is_outlet_account: !!is_outlet_account,
            },
          });

          if (createError || !newUser.user) {
            console.error("CREATE STAFF AUTH RESULT: ERROR", createError?.message);
            const msg = createError?.message?.toLowerCase() || "";
            if (
              msg.includes("already registered") ||
              msg.includes("already been registered") ||
              msg.includes("unique")
            ) {
              return Response.json(
                { error: "Email sudah digunakan oleh akun lain. Silakan gunakan email berbeda." },
                { status: 400 },
              );
            }
            return Response.json(
              { error: createError?.message || "Gagal membuat akun authentication staff" },
              { status: 400 },
            );
          }

          const newUserId = newUser.user.id;
          console.log("CREATE STAFF AUTH RESULT: SUCCESS", newUserId);

          // 2. Insert into profiles table
          const profilePayload = {
            user_id: newUserId,
            display_name: name.trim(),
            avatar_url: avatar_url || null,
            language: "id",
            timezone: "Asia/Jakarta",
          };

          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert(profilePayload, { onConflict: "user_id" });

          if (profileError) {
            console.error("CREATE STAFF PROFILE RESULT: ERROR", profileError.message);
            // Cleanup created auth user on profile failure
            await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => undefined);
            return Response.json(
              { error: `Gagal membuat data profil: ${profileError.message}` },
              { status: 500 },
            );
          }

          console.log("CREATE STAFF PROFILE RESULT: SUCCESS", newUserId);

          // 3. Resolve outlet_id for business_members
          // In database check constraint `business_members_role_outlet_check`:
          // - 'owner' MUST have outlet_id = null
          // - 'admin', 'manager', 'cashier' MUST have a valid outlet_id
          let finalOutletId: string | null = null;

          if (mappedRole !== "owner") {
            if (outlet_id) {
              finalOutletId = String(outlet_id);
            } else {
              // Automatically resolve or fallback to business's primary outlet
              const { data: existingOutlets } = await supabaseAdmin
                .from("outlets")
                .select("id")
                .eq("business_id", creatorBusinessId)
                .order("created_at", { ascending: true })
                .limit(1);

              const firstOutlet = existingOutlets?.[0];
              if (firstOutlet) {
                finalOutletId = firstOutlet.id;
              } else {
                // If business has no outlets yet, automatically generate a Main Outlet
                const { data: defaultOutlet, error: defaultOutletErr } = await supabaseAdmin
                  .from("outlets")
                  .insert({
                    business_id: creatorBusinessId,
                    name: "Main Outlet",
                    code: "MAIN",
                    active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (!defaultOutletErr && defaultOutlet) {
                  finalOutletId = defaultOutlet.id;
                }
              }
            }
          }

          // 4. Insert into business_members table with outlet_id compliance:
          // 'owner' MUST have outlet_id = null
          // 'admin', 'manager', 'cashier' MUST have a valid outlet_id
          const memberPayload: any = {
            business_id: creatorBusinessId,
            user_id: newUserId,
            role: mappedRole,
            outlet_id: mappedRole === "owner" ? null : finalOutletId,
            created_at: new Date().toISOString(),
          };

          const { error: memberError } = await supabaseAdmin
            .from("business_members")
            .insert(memberPayload);

          if (memberError) {
            console.error("CREATE STAFF MEMBER RESULT: ERROR", memberError.message);
            // Cleanup profile and auth user
            try {
              await supabaseAdmin.from("profiles").delete().eq("user_id", newUserId);
            } catch {}
            try {
              await supabaseAdmin.auth.admin.deleteUser(newUserId);
            } catch {}
            return Response.json(
              { error: `Gagal mendaftarkan member bisnis: ${memberError.message}` },
              { status: 500 },
            );
          }

          // Upsert into staff_profiles to persist outlet_id
          await supabaseAdmin.from("staff_profiles" as any).upsert({
            user_id: newUserId,
            business_id: creatorBusinessId,
            outlet_id: finalOutletId,
            full_name: name.trim(),
            role: mappedRole,
            job_title:
              mappedRole === "manager"
                ? "Store Manager"
                : mappedRole === "cashier"
                  ? "Kasir POS"
                  : "Staff Operasional",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          // Persist assigned staff ID, manager permissions, and outlet account into outlets.settings
          if (finalOutletId) {
            try {
              const { data: outRow } = await supabaseAdmin
                .from("outlets")
                .select("settings")
                .eq("id", finalOutletId)
                .maybeSingle();
              const currentSettings = (outRow?.settings as any) || {};
              const existingStaff = Array.isArray(currentSettings.assigned_staff_ids)
                ? currentSettings.assigned_staff_ids
                : [];
              const nextStaff = existingStaff.includes(newUserId)
                ? existingStaff
                : [...existingStaff, newUserId];

              const updatedSettings: Record<string, any> = {
                ...currentSettings,
                assigned_staff_ids: nextStaff,
              };

              // If manager permissions provided, store in manager_permissions map
              if (Array.isArray(manager_permissions)) {
                updatedSettings.manager_permissions = {
                  ...(currentSettings.manager_permissions || {}),
                  [newUserId]: manager_permissions,
                };
              }

              // If creating an outlet device login, record login email
              if (is_outlet_account || mappedRole === "cashier") {
                updatedSettings.outlet_login_email = email.trim().toLowerCase();
              }

              await supabaseAdmin
                .from("outlets")
                .update({
                  settings: updatedSettings,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", finalOutletId);
            } catch (outErr) {
              console.warn("[create-staff] Error updating outlet settings:", outErr);
            }
          }

          console.log("CREATE STAFF MEMBER RESULT: SUCCESS", {
            user_id: newUserId,
            role: mappedRole,
            outlet_id: finalOutletId,
          });

          // 5. Upsert user_roles table
          const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
            {
              user_id: newUserId,
              role: mappedRole,
              created_at: new Date().toISOString(),
            },
            { onConflict: "user_id, role" },
          );

          if (roleError) {
            console.warn("USER ROLE ASSIGN WARNING:", roleError.message);
          }

          return Response.json({
            success: true,
            user: {
              id: newUserId,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              role: mappedRole,
              outlet_id: finalOutletId,
            },
          });
        } catch (err) {
          console.error("CREATE STAFF UNEXPECTED ERROR:", err);
          return Response.json(
            {
              error: err instanceof Error ? err.message : "Terjadi kesalahan internal pada server",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
