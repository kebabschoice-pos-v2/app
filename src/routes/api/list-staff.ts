import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/list-staff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

          // 1. Current User -> Get Auth User ID & Email
          const callerId = authData.user.id;
          const callerEmail = (authData.user.email || "").toLowerCase();
          console.log("CURRENT USER ID:", callerId, "EMAIL:", callerEmail);

          // 2. Global check: check if caller belongs to an outlet directly (via outlet_login_email / outlet_login_account)
          const { data: allOutletsGlobal } = await supabaseAdmin
            .from("outlets")
            .select("id, name, code, business_id, settings")
            .order("created_at", { ascending: true });

          let directOutletMatch: any = null;
          if (allOutletsGlobal && allOutletsGlobal.length > 0) {
            for (const out of allOutletsGlobal) {
              const s = (out.settings && typeof out.settings === "object") ? (out.settings as any) : {};
              const loginEmail = (s.outlet_login_email || s.outlet_login_account?.email || "").toLowerCase();
              const isAssigned = Array.isArray(s.assigned_staff_ids) && s.assigned_staff_ids.includes(callerId);
              const isManager = s.manager_user_id === callerId;
              const isAccountUser = s.outlet_login_account?.user_id === callerId;

              if ((callerEmail && loginEmail === callerEmail) || isAccountUser || isAssigned || isManager) {
                directOutletMatch = out;
                break;
              }
            }
          }

          let businessId: string | null = null;
          let businessIds: string[] = [];

          if (directOutletMatch && directOutletMatch.business_id) {
            businessId = directOutletMatch.business_id;
            businessIds = [directOutletMatch.business_id];
            console.log("BUSINESS RESOLVED VIA OUTLET MATCH:", businessId, "OUTLET:", directOutletMatch.id);

            // Cleanup stray dummy businesses created for this outlet account if any
            try {
              const { data: strayBiz } = await supabaseAdmin
                .from("businesses")
                .select("id, name")
                .eq("owner_id", callerId)
                .ilike("name", "%Flagship Cafe%");
              if (strayBiz && strayBiz.length > 0) {
                for (const sb of strayBiz) {
                  try {
                    await supabaseAdmin.from("businesses").delete().eq("id", sb.id);
                  } catch {}
                }
              }
            } catch {}
          } else {
            // Check non-owner membership in business_members first
            const { data: nonOwnerMemberships } = await (supabaseAdmin
              .from("business_members" as any)
              .select("business_id, role, outlet_id")
              .eq("user_id", callerId)
              .neq("role", "owner")
              .order("created_at", { ascending: false })
              .limit(1) as any);

            if (nonOwnerMemberships && nonOwnerMemberships.length > 0 && nonOwnerMemberships[0]) {
              const bId = nonOwnerMemberships[0].business_id;
              if (bId) {
                businessId = bId;
                businessIds = [bId];
              }
              console.log("BUSINESS RESOLVED VIA MEMBER ROLE:", businessId);
            } else {
              // Check owned businesses
              const { data: ownedBusinesses } = await supabaseAdmin
                .from("businesses")
                .select("id, name")
                .eq("owner_id", callerId)
                .order("created_at", { ascending: true });

              if (ownedBusinesses && ownedBusinesses.length > 0) {
                const nonDummy = ownedBusinesses.find((b) => !b.name.includes("Flagship Cafe"));
                const chosen = nonDummy || ownedBusinesses[0];
                if (chosen) {
                  businessId = chosen.id;
                  businessIds = ownedBusinesses.map((b) => b.id);
                  console.log("BUSINESS FOUND VIA OWNER:", businessId);
                }
              } else {
                // Fallback: check any membership
                const { data: memberships } = await supabaseAdmin
                  .from("business_members")
                  .select("business_id, role")
                  .eq("user_id", callerId)
                  .order("created_at", { ascending: false })
                  .limit(1);

                if (memberships && memberships.length > 0 && memberships[0]) {
                  const bId = memberships[0].business_id;
                  if (bId) {
                    businessId = bId;
                    businessIds = [bId];
                  }
                  console.log("BUSINESS FOUND VIA MEMBERSHIP:", businessId);
                }
              }
            }
          }

          if (!businessId) {
            console.log("BUSINESS FOUND: NOT_FOUND");
            console.log("STAFF QUERY RESULT:", []);
            return Response.json([], { status: 200 });
          }

          // 3. Query business_members
          const { data: members, error: membersErr } = await supabaseAdmin
            .from("business_members")
            .select("id, business_id, user_id, role, created_at")
            .in("business_id", businessIds)
            .order("created_at", { ascending: false });

          if (membersErr) {
            console.error("[list-staff] business_members query error:", membersErr);
            return Response.json({ error: membersErr.message }, { status: 500 });
          }

          // Deduplicate by user_id
          const uniqueMembers: typeof members = [];
          const seenUsers = new Set<string>();
          for (const m of members ?? []) {
            if (!seenUsers.has(m.user_id)) {
              seenUsers.add(m.user_id);
              uniqueMembers.push(m);
            }
          }

          const userIds = uniqueMembers.map((m) => m.user_id);

          // 4. Join profiles
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

          const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

          // 5. Join staff_profiles for outlet_id
          let staffProfiles: any[] = [];
          try {
            const { data: spData, error: spErr } = await supabaseAdmin
              .from("staff_profiles" as any)
              .select("user_id, outlet_id, full_name, avatar_url")
              .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

            if (!spErr && spData) {
              staffProfiles = spData;
            }
          } catch (spCatch) {
            console.warn("[list-staff] staff_profiles catch warning:", spCatch);
          }

          const staffProfileMap = new Map<string, any>(
            staffProfiles.map((sp: any) => [sp.user_id, sp]),
          );

          // 6. Join outlets with settings JSON
          const { data: outlets } = await supabaseAdmin
            .from("outlets")
            .select("id, name, code, settings")
            .in("business_id", businessIds);

          const outletList = outlets ?? [];
          const outletMap = new Map(outletList.map((o) => [o.id, o]));

          // 7. Fetch auth users to get emails securely
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 100,
          });

          const emailMap = new Map((usersData?.users ?? []).map((u) => [u.id, u.email]));

          // 8. Build staff list from members + outlets.settings.outlet_staff_roster
          const staffMap = new Map<string, any>();

          for (const m of uniqueMembers) {
            const profile = profileMap.get(m.user_id);
            const staffProfile = staffProfileMap.get(m.user_id);

            let assignedOutletId: string | null = staffProfile?.outlet_id || null;

            if (!assignedOutletId) {
              for (const out of outletList) {
                const setObj = (out.settings && typeof out.settings === "object") ? (out.settings as any) : {};
                const assignedIds: string[] = Array.isArray(setObj.assigned_staff_ids) ? setObj.assigned_staff_ids : [];
                if (assignedIds.includes(m.user_id) || setObj.manager_user_id === m.user_id) {
                  assignedOutletId = out.id;
                  break;
                }
              }
            }

            const outlet = assignedOutletId ? outletMap.get(assignedOutletId) : null;
            const email = emailMap.get(m.user_id) || "";
            const name = staffProfile?.full_name || profile?.display_name || email.split("@")[0] || "Staff";
            const outletName =
              outlet?.name || (m.role === "owner" ? "Semua Cabang (HQ)" : "Belum ditentukan");

            // STRICT FILTER: Exclude device accounts from human staff list
            const isDeviceAccount =
              name.toLowerCase().startsWith("pos outlet") ||
              name.toLowerCase().includes("terminal outlet") ||
              name.toLowerCase().startsWith("akun login outlet") ||
              email.toLowerCase().includes("@outlet.local");

            if (!isDeviceAccount) {
              staffMap.set(m.user_id, {
                id: m.id,
                user_id: m.user_id,
                name,
                email,
                role: m.role,
                outlet: outletName,
                outlet_name: outletName,
                outlet_id: assignedOutletId,
                outlet_code: outlet?.code || "",
                avatar_url: staffProfile?.avatar_url || profile?.avatar_url || null,
                created_at: m.created_at,
                status: "active" as const,
                gender: "male" as const,
              });
            }
          }

          // Merge branch employees from outlets.settings.outlet_staff_roster
          for (const out of outletList) {
            const setObj = (out.settings && typeof out.settings === "object") ? (out.settings as any) : {};
            const roster: any[] = Array.isArray(setObj.outlet_staff_roster) ? setObj.outlet_staff_roster : [];
            for (const emp of roster) {
              const empId =
                emp.user_id ||
                emp.id ||
                `emp-${out.id}-${(emp.name || emp.full_name || "").toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
              if (!empId) continue;

              const empName = emp.name || emp.full_name || "Karyawan Cabang";
              const isDeviceAccount =
                emp.is_outlet_account === true ||
                empName.toLowerCase().startsWith("pos outlet") ||
                empName.toLowerCase().includes("terminal outlet") ||
                empName.toLowerCase().startsWith("akun login outlet") ||
                String(emp.email || "").toLowerCase().includes("@outlet.local");

              if (isDeviceAccount) continue;

              if (!staffMap.has(empId)) {
                staffMap.set(empId, {
                  id: empId,
                  user_id: empId,
                  name: empName,
                  email: emp.email || "",
                  role: emp.role || "cashier",
                  outlet: out.name,
                  outlet_name: out.name,
                  outlet_id: out.id,
                  outlet_code: out.code || "",
                  avatar_url: emp.avatar_url || null,
                  created_at: emp.created_at || new Date().toISOString(),
                  status: emp.status || "active",
                  gender: emp.gender || "male",
                });
              }
            }
          }

          const staffList = Array.from(staffMap.values());

          console.log("STAFF QUERY RESULT:", staffList);

          return Response.json(staffList, { status: 200 });
        } catch (err) {
          console.error("[list-staff] Error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Gagal memuat daftar staff" },
            { status: 500 },
          );
        }
      },
    },
  },
});
