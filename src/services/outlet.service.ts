import { supabase } from "@/integrations/supabase/client";
import { getStaffList } from "./staff.service";

export interface OutletMemberSummary {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "manager" | "cashier";
  avatar_url?: string | null;
  outlet_id?: string | null;
  outlet_name?: string | null;
  status?: string;
}

export interface OutletItem {
  id: string;
  business_id: string;
  outlet_name: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  timezone: string;
  status: "active" | "inactive";
  active: boolean;
  created_at: string;
  updated_at: string;
  manager: OutletMemberSummary | null;
  staff_count: number;
  staff_list: OutletMemberSummary[];
  [key: string]: unknown;
}

export interface OutletInput {
  outlet_name?: string;
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  timezone?: string;
  status?: "active" | "inactive";
  business_id?: string;
  manager_user_id?: string | null;
  staff_user_ids?: string[];
}

/**
 * Resolves current active business IDs from Supabase auth session
 */
async function resolveCurrentBusinessIds(
  explicitId?: string,
): Promise<{ primaryId: string; allIds: string[] }> {
  if (explicitId) return { primaryId: explicitId, allIds: [explicitId] };

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    throw new Error("Sesi pengguna tidak ditemukan. Silakan login kembali.");
  }

  // 1. Check businesses owned
  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", authData.user.id)
    .order("created_at", { ascending: true });

  const firstOwned = ownedBusinesses?.[0];
  if (firstOwned) {
    const allIds = ownedBusinesses!.map((b) => b.id);
    return { primaryId: firstOwned.id, allIds };
  }

  // 2. Check business_members
  const { data: memberBusinesses } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const firstMember = memberBusinesses?.[0];
  if (firstMember) {
    const bid = firstMember.business_id;
    return { primaryId: bid, allIds: [bid] };
  }

  // 3. Fallback to any business available in development
  const { data: anyBusiness } = await supabase
    .from("businesses")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (anyBusiness?.id) return { primaryId: anyBusiness.id, allIds: [anyBusiness.id] };

  throw new Error("Business ID aktif tidak ditemukan.");
}

function mapOutletRow(
  row: any,
  manager: OutletMemberSummary | null = null,
  staffList: OutletMemberSummary[] = [],
): OutletItem {
  const name = row.name ?? row.outlet_name ?? "Outlet";
  const active = typeof row.active === "boolean" ? row.active : row.status !== "inactive";
  const status: "active" | "inactive" = active ? "active" : "inactive";

  return {
    ...row,
    id: row.id,
    business_id: row.business_id,
    outlet_name: name,
    name: name,
    code: row.code ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    timezone: row.timezone ?? "Asia/Jakarta",
    status,
    active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    manager,
    staff_count: staffList.length,
    staff_list: staffList,
  };
}

/**
 * Fetch all outlets for the current business with assigned managers and staff
 */
export async function getOutletList(businessId?: string): Promise<OutletItem[]> {
  try {
    const { allIds } = await resolveCurrentBusinessIds(businessId);

    // 1. Fetch outlets
    const { data: outletsData, error: outletsErr } = await supabase
      .from("outlets")
      .select("*")
      .in("business_id", allIds)
      .order("created_at", { ascending: false });

    if (outletsErr) {
      console.error("[getOutletList] Outlets error:", outletsErr);
      throw outletsErr;
    }

    const rawOutlets = outletsData ?? [];
    if (rawOutlets.length === 0) return [];

    // Filter out archived/soft-deleted outlets
    const outlets = rawOutlets.filter(
      (o) =>
        !((o.settings as any)?.archived === true || (o.active === false && (o.settings as any)?.deleted_at)),
    );

    // Deduplicate outlets by ID
    const uniqueOutlets: typeof outlets = [];
    const seenOutlets = new Set<string>();
    for (const o of outlets) {
      if (!seenOutlets.has(o.id)) {
        seenOutlets.add(o.id);
        uniqueOutlets.push(o);
      }
    }

    // Read staff assignment mapping from outlets.settings
    const settingsStaffMap = new Map<string, string>(); // userId -> outletId
    const settingsManagerMap = new Map<string, string>(); // outletId -> managerUserId
    for (const o of uniqueOutlets) {
      const s = (o.settings as any) || {};
      if (Array.isArray(s.assigned_staff_ids)) {
        for (const uid of s.assigned_staff_ids) {
          settingsStaffMap.set(uid, o.id);
        }
      }
      if (s.manager_user_id) {
        settingsManagerMap.set(o.id, s.manager_user_id);
      }
    }

    // Read client-side persistence from localStorage as fallback
    const localStaffMap = new Map<string, string>();
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
        if (raw) {
          const obj = JSON.parse(raw);
          for (const [uid, oid] of Object.entries(obj)) {
            if (typeof oid === "string") localStaffMap.set(uid, oid);
          }
        }
      } catch {}
    }

    // 2. Fetch business members for these businesses
    const { data: membersData } = await supabase
      .from("business_members")
      .select("id, business_id, user_id, role, created_at")
      .in("business_id", allIds);

    const members = membersData ?? [];
    const userIds = members.map((m) => m.user_id);

    // 3. Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profilesData ?? []).map((p) => [p.user_id, p]));

    // 4. Safe query to staff_profiles (won't crash if table not deployed / PGRST205)
    let staffProfilesData: any[] = [];
    try {
      const { data } = await supabase
        .from("staff_profiles" as any)
        .select("user_id, outlet_id, full_name, avatar_url")
        .in("business_id", allIds);
      if (data) staffProfilesData = data;
    } catch (spErr) {
      console.warn("[getOutletList] staff_profiles table unavailable, using settings fallback:", spErr);
    }

    const staffProfileMap = new Map<string, any>(
      (staffProfilesData ?? []).map((sp: any) => [sp.user_id, sp]),
    );

    // 5. Map staff members by outlet_id (deduplicated per outlet by user_id)
    const outletStaffMap = new Map<string, OutletMemberSummary[]>();
    const outletManagerMap = new Map<string, OutletMemberSummary>();
    const seenPerOutlet = new Map<string, Set<string>>();

    for (const m of members) {
      if (m.role === "owner") continue;
      const staffProfile = staffProfileMap.get(m.user_id);
      // Resolves from staff_profiles first, then outlets.settings, then localStorage
      const outletId =
        staffProfile?.outlet_id || settingsStaffMap.get(m.user_id) || localStaffMap.get(m.user_id);
      if (!outletId) continue;

      if (!seenPerOutlet.has(outletId)) {
        seenPerOutlet.set(outletId, new Set<string>());
      }
      if (seenPerOutlet.get(outletId)!.has(m.user_id)) continue;
      seenPerOutlet.get(outletId)!.add(m.user_id);

      const profile = profileMap.get(m.user_id);
      let cleanName = (staffProfile?.full_name || profile?.display_name || "").trim();
      if (
        !cleanName ||
        cleanName.toLowerCase() === "karyawan" ||
        cleanName.toLowerCase() === "staff"
      ) {
        cleanName = m.role === "cashier" ? "Kasir Cabang" : "Staf Cabang";
      }

      const summary: OutletMemberSummary = {
        id: m.id,
        user_id: m.user_id,
        name: cleanName,
        email: "staff@kebabschoice.com",
        role: m.role as any,
        avatar_url: staffProfile?.avatar_url || profile?.avatar_url || null,
        outlet_id: outletId,
      };

      const existing = outletStaffMap.get(outletId) || [];
      existing.push(summary);
      outletStaffMap.set(outletId, existing);

      const isExplicitManager = settingsManagerMap.get(outletId) === m.user_id || m.role === "manager";
      if (isExplicitManager && !outletManagerMap.has(outletId)) {
        outletManagerMap.set(outletId, summary);
      }
    }

    return uniqueOutlets.map((row) => {
      const manager = outletManagerMap.get(row.id) || null;
      const staffList = outletStaffMap.get(row.id) || [];
      return mapOutletRow(row, manager, staffList);
    });
  } catch (err) {
    console.error("[getOutletList] Failed:", err);
    throw err;
  }
}

/**
 * Fetch detailed outlet information including manager and all assigned staff
 */
export async function getOutletDetail(id: string): Promise<OutletItem> {
  if (!id) throw new Error("Outlet ID wajib disertakan");

  const { data: outlet, error } = await supabase.from("outlets").select("*").eq("id", id).single();

  if (error || !outlet) {
    console.error("[getOutletDetail] Error:", error);
    throw error || new Error("Outlet tidak ditemukan");
  }

  // 1. Safe query to staff_profiles
  let staffProfiles: any[] = [];
  try {
    const { data } = await (supabase.from("staff_profiles" as any) as any)
      .select("id, user_id, role, outlet_id, full_name, avatar_url")
      .eq("outlet_id", id);
    if (data) staffProfiles = data;
  } catch {
    staffProfiles = [];
  }

  // 2. Fallback to settings.assigned_staff_ids and localStorage
  const assignedStaffIdsFromSettings: string[] = Array.isArray(
    (outlet.settings as any)?.assigned_staff_ids,
  )
    ? (outlet.settings as any).assigned_staff_ids
    : [];

  const localAssignedStaffIds: string[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      if (raw) {
        const obj = JSON.parse(raw);
        for (const [uid, oid] of Object.entries(obj)) {
          if (oid === id) localAssignedStaffIds.push(uid);
        }
      }
    } catch {}
  }

  const allAssignedUserIds = Array.from(
    new Set([
      ...staffProfiles.map((sp: any) => sp.user_id),
      ...assignedStaffIdsFromSettings,
      ...localAssignedStaffIds,
    ]),
  );

  const { data: members } = await supabase
    .from("business_members")
    .select("id, user_id, role, created_at")
    .in("user_id", allAssignedUserIds.length > 0 ? allAssignedUserIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", allAssignedUserIds.length > 0 ? allAssignedUserIds : ["00000000-0000-0000-0000-000000000000"]);

  const memberMap = new Map((members ?? []).map((m) => [m.user_id, m]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const spMap = new Map(staffProfiles.map((sp: any) => [sp.user_id, sp]));

  let manager: OutletMemberSummary | null = null;
  const staffList: OutletMemberSummary[] = [];

  for (const uid of allAssignedUserIds) {
    const m = memberMap.get(uid);
    const p = profileMap.get(uid);
    const sp = spMap.get(uid);

    if (m?.role === "owner") continue;

    const summary: OutletMemberSummary = {
      id: m?.id || sp?.id || uid,
      user_id: uid,
      name: sp?.full_name || p?.display_name || "Staff",
      email: "staff@kebabschoice.com",
      role: (sp?.role || m?.role || "cashier") as any,
      avatar_url: sp?.avatar_url || p?.avatar_url || null,
      outlet_id: id,
    };

    staffList.push(summary);
    const isExplicitManager = (outlet.settings as any)?.manager_user_id === uid || summary.role === "manager";
    if (isExplicitManager && !manager) {
      manager = summary;
    }
  }

  return mapOutletRow(outlet, manager, staffList);
}

/**
 * Fetch all available employees in the business for assignment to an outlet.
 * Directly integrates with Staff Management data so real names, emails, roles,
 * and current outlet assignments are loaded without placeholders like 'Karyawan'.
 */
export async function getAvailableStaff(businessId?: string): Promise<OutletMemberSummary[]> {
  try {
    const rawStaffList = await getStaffList();
    const staffMap = new Map<string, OutletMemberSummary>();

    for (const s of rawStaffList) {
      // Exclude Owner HQ (Owners manage all branches, not single outlet)
      if (s.role === "owner") continue;

      if (!staffMap.has(s.user_id)) {
        let cleanName = (s.name || "").trim();
        if (
          !cleanName ||
          cleanName.toLowerCase() === "karyawan" ||
          cleanName.toLowerCase() === "staff"
        ) {
          if (s.email && s.email.includes("@")) {
            const userPart = (s.email.split("@")[0] ?? "").replace(/[._-]/g, " ");
            cleanName = userPart
              .split(" ")
              .filter(Boolean)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          } else {
            cleanName = s.role === "cashier" ? "Kasir Cabang" : "Staf Cabang";
          }
        }

        staffMap.set(s.user_id, {
          id: s.id || s.user_id,
          user_id: s.user_id,
          name: cleanName,
          email: s.email || "staff@kebabschoice.com",
          role: s.role as any,
          avatar_url: s.avatar_url || null,
          outlet_id: s.outlet_id || null,
          outlet_name: s.outlet_name || s.outlet || "Belum ditugaskan",
          status: s.status || "active",
        });
      }
    }

    return Array.from(staffMap.values());
  } catch (err) {
    console.error("[getAvailableStaff] Error:", err);
    return [];
  }
}

/**
 * Create a new outlet and optionally assign a manager and staff
 */
export async function createOutlet(payload: OutletInput): Promise<OutletItem> {
  const outletName = (payload.outlet_name || payload.name || "").trim();
  if (!outletName) {
    throw new Error("Nama outlet wajib diisi");
  }

  const { primaryId } = await resolveCurrentBusinessIds(payload.business_id);

  // Auto-generate safe code if not provided
  let code = (payload.code || "").trim().toUpperCase();
  if (!code) {
    const prefix =
      outletName
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase() || "OUT";
    const rand = Math.floor(100 + Math.random() * 900);
    code = `${prefix}-${rand}`;
  }

  const isActive = payload.status !== "inactive";

  const insertPayload = {
    business_id: primaryId,
    name: outletName,
    code: code,
    address: payload.address?.trim() || null,
    phone: payload.phone?.trim() || null,
    timezone: payload.timezone?.trim() || "Asia/Jakarta",
    active: isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log("[createOutlet] Inserting outlet:", insertPayload);

  const { data: newOutlet, error } = await supabase
    .from("outlets")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !newOutlet) {
    console.error("[createOutlet] Error:", error);
    throw error || new Error("Gagal membuat cabang outlet");
  }

  // Assign manager if selected
  if (payload.manager_user_id) {
    await assignOutletManager(newOutlet.id, payload.manager_user_id);
  }

  // Assign staff members if selected
  if (payload.staff_user_ids && payload.staff_user_ids.length > 0) {
    await assignOutletEmployees(newOutlet.id, payload.staff_user_ids);
  }

  return mapOutletRow(newOutlet);
}

/**
 * Update outlet details and assignments
 */
export async function updateOutlet(id: string, payload: Partial<OutletInput>): Promise<OutletItem> {
  if (!id) throw new Error("Outlet ID wajib disertakan");

  const updateData: {
    updated_at: string;
    name?: string;
    code?: string;
    address?: string | null;
    phone?: string | null;
    timezone?: string;
    active?: boolean;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (payload.outlet_name !== undefined) updateData.name = payload.outlet_name.trim();
  if (payload.name !== undefined && payload.outlet_name === undefined)
    updateData.name = payload.name.trim();
  if (payload.code !== undefined) updateData.code = payload.code.trim().toUpperCase();
  if (payload.address !== undefined) updateData.address = payload.address.trim() || null;
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim() || null;
  if (payload.timezone !== undefined)
    updateData.timezone = payload.timezone.trim() || "Asia/Jakarta";
  if (payload.status !== undefined) updateData.active = payload.status === "active";

  console.log("[updateOutlet] Updating outlet:", id, updateData);

  const { data, error } = await supabase
    .from("outlets")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateOutlet] Error:", error);
    throw error;
  }

  // If manager assignment is explicitly changed
  if (payload.manager_user_id !== undefined) {
    await assignOutletManager(id, payload.manager_user_id);
  }

  return mapOutletRow(data);
}

/**
 * Assign or reassign a manager to an outlet
 */
export async function assignOutletManager(
  outletId: string,
  managerUserId: string | null,
): Promise<boolean> {
  if (!outletId) throw new Error("Outlet ID wajib disertakan");

  if (!managerUserId) {
    return true;
  }

  // 1. Try updating staff_profiles if table exists (silently catch PGRST205 / 404)
  try {
    const { error } = await supabase
      .from("staff_profiles" as any)
      .update({ outlet_id: outletId, role: "manager" })
      .eq("user_id", managerUserId);

    if (error) {
      console.warn("[assignOutletManager] staff_profiles warning:", error);
    }
  } catch (err) {
    console.warn("[assignOutletManager] staff_profiles catch warning:", err);
  }

  // 2. Try updating business_members role
  try {
    await supabase.from("business_members").update({ role: "manager" }).eq("user_id", managerUserId);
  } catch (err) {
    console.warn("[assignOutletManager] business_members catch warning:", err);
  }

  // 3. Persist manager in outlets.settings.manager_user_id and assigned_staff_ids
  try {
    const { data: outletRow } = await supabase
      .from("outlets")
      .select("settings")
      .eq("id", outletId)
      .single();

    const currSettings: Record<string, any> = (outletRow?.settings && typeof outletRow.settings === "object" && !Array.isArray(outletRow.settings)) ? (outletRow.settings as Record<string, any>) : {};
    const existingStaff: string[] = Array.isArray(currSettings.assigned_staff_ids) ? currSettings.assigned_staff_ids : [];
    const updatedSettings = {
      ...currSettings,
      manager_user_id: managerUserId,
      assigned_staff_ids: Array.from(new Set([...existingStaff, managerUserId])),
    };

    await supabase
      .from("outlets")
      .update({ settings: updatedSettings })
      .eq("id", outletId);
  } catch (err) {
    console.warn("[assignOutletManager] outlets.settings update warning:", err);
  }

  // 4. Update localStorage mapping
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[managerUserId] = outletId;
      localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(map));
    } catch (e) {
      // ignore
    }
  }

  return true;
}

/**
 * Assign employees (cashiers/staff) to a specific outlet.
 * Automatically updates both old outlet and new outlet.
 */
export async function assignOutletEmployees(
  outletId: string,
  newAssignedUserIds: string[],
  previouslyAssignedUserIds: string[] = [],
): Promise<boolean> {
  if (!outletId) throw new Error("Outlet ID wajib disertakan");

  // 1. Unassign staff who were unchecked/removed from this outlet
  const removedUserIds = previouslyAssignedUserIds.filter(
    (uid) => !newAssignedUserIds.includes(uid),
  );

  if (removedUserIds.length > 0) {
    try {
      const { error: unassignError } = await supabase
        .from("staff_profiles" as any)
        .update({ outlet_id: null })
        .in("user_id", removedUserIds)
        .eq("outlet_id", outletId)
        .neq("role", "owner");

      if (unassignError) {
        console.warn("[assignOutletEmployees] Unassign warning:", unassignError);
      }
    } catch (err) {
      console.warn("[assignOutletEmployees] Unassign catch warning:", err);
    }
  }

  // 2. Assign newly selected staff to this outlet (reassigns from their old branch automatically)
  if (newAssignedUserIds.length > 0) {
    try {
      const { error: assignError } = await supabase
        .from("staff_profiles" as any)
        .update({ outlet_id: outletId })
        .in("user_id", newAssignedUserIds)
        .neq("role", "owner");

      if (assignError) {
        console.warn("[assignOutletEmployees] Error assigning staff in staff_profiles (fallback to settings JSON):", assignError);
      }
    } catch (err) {
      console.warn("[assignOutletEmployees] staff_profiles catch warning:", err);
    }
  }

  // 3. Persist assigned staff IDs directly into outlets.settings for resilience
  try {
    const { data: currentOutlet } = await supabase
      .from("outlets")
      .select("business_id, settings")
      .eq("id", outletId)
      .single();

    const currSettings: Record<string, any> = (currentOutlet?.settings && typeof currentOutlet.settings === "object" && !Array.isArray(currentOutlet.settings)) ? (currentOutlet.settings as Record<string, any>) : {};
    const updatedSettings = {
      ...currSettings,
      assigned_staff_ids: newAssignedUserIds,
    };

    await supabase
      .from("outlets")
      .update({ settings: updatedSettings })
      .eq("id", outletId);

    // If business_id is present, remove assigned staff from any OTHER outlets in the same business
    if (currentOutlet?.business_id && newAssignedUserIds.length > 0) {
      const { data: siblingOutlets } = await supabase
        .from("outlets")
        .select("id, settings")
        .eq("business_id", currentOutlet.business_id)
        .neq("id", outletId);

      if (siblingOutlets && siblingOutlets.length > 0) {
        for (const sibling of siblingOutlets) {
          const sibSettings: Record<string, any> = (sibling.settings && typeof sibling.settings === "object" && !Array.isArray(sibling.settings)) ? (sibling.settings as Record<string, any>) : {};
          const siblingStaff: string[] = Array.isArray(sibSettings.assigned_staff_ids) ? sibSettings.assigned_staff_ids : [];
          const hasOverlap = siblingStaff.some((id: string) => newAssignedUserIds.includes(id));
          if (hasOverlap) {
            const filtered = siblingStaff.filter((id: string) => !newAssignedUserIds.includes(id));
            await supabase
              .from("outlets")
              .update({ settings: { ...sibSettings, assigned_staff_ids: filtered } })
              .eq("id", sibling.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[assignOutletEmployees] Error updating outlets.settings:", err);
  }

  // 4. Update localStorage map so changes persist across page reloads
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};

      for (const uid of removedUserIds) {
        if (map[uid] === outletId) {
          delete map[uid];
        }
      }
      for (const uid of newAssignedUserIds) {
        map[uid] = outletId;
      }
      localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(map));
    } catch (e) {
      console.warn("[assignOutletEmployees] LocalStorage error:", e);
    }
  }

  // 5. Dispatch cross-component event so that active outlets/dashboard update in real time
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("outlet:staff-updated", { detail: { outletId } }));
  }

  return true;
}

/**
 * Quick transfer or mutation of an individual staff member to a new outlet (or unassign them).
 * Synchronizes staff_profiles.outlet_id, business_members.outlet_id, and outlets.settings.assigned_staff_ids.
 */
export async function transferStaffToOutlet(
  userId: string,
  targetOutletId: string | null,
): Promise<boolean> {
  if (!userId) throw new Error("User ID wajib disertakan");

  // 1. Try updating staff_profiles
  try {
    const { error: spErr } = await supabase
      .from("staff_profiles" as any)
      .update({ outlet_id: targetOutletId })
      .eq("user_id", userId)
      .neq("role", "owner");

    if (spErr) {
      console.warn("[transferStaffToOutlet] staff_profiles warning:", spErr);
    }
  } catch (err) {
    console.warn("[transferStaffToOutlet] staff_profiles catch warning:", err);
  }

  // 2. Try updating business_members
  try {
    await (supabase
      .from("business_members" as any) as any)
      .update({ outlet_id: targetOutletId })
      .eq("user_id", userId);
  } catch (err) {
    console.warn("[transferStaffToOutlet] business_members catch warning:", err);
  }

  // 3. Update all outlets settings.assigned_staff_ids and outlet_staff_roster
  try {
    const { data: allOutlets } = await supabase
      .from("outlets")
      .select("id, name, code, settings");

    if (allOutlets && allOutlets.length > 0) {
      let targetOutletObj = allOutlets.find((o) => o.id === targetOutletId);
      let staffInfoForRoster: any = null;

      for (const o of allOutlets) {
        const currSettings: Record<string, any> =
          o.settings && typeof o.settings === "object" && !Array.isArray(o.settings)
            ? (o.settings as Record<string, any>)
            : {};
        const staffList: string[] = Array.isArray(currSettings.assigned_staff_ids)
          ? currSettings.assigned_staff_ids
          : [];
        const roster: any[] = Array.isArray(currSettings.outlet_staff_roster)
          ? currSettings.outlet_staff_roster
          : [];

        // Check if roster has this staff
        const foundInRoster = roster.find((e: any) => (e.id || e.user_id) === userId);
        if (foundInRoster) {
          staffInfoForRoster = { ...foundInRoster };
        }

        if (o.id === targetOutletId) {
          let updatedStaff = staffList;
          let updatedRoster = roster;
          let changed = false;

          if (!staffList.includes(userId)) {
            updatedStaff = [...staffList, userId];
            changed = true;
          }

          if (staffInfoForRoster && !roster.some((e: any) => (e.id || e.user_id) === userId)) {
            updatedRoster = [
              ...roster,
              {
                ...staffInfoForRoster,
                outlet_id: targetOutletId,
                outlet_name: o.name,
                outlet_code: o.code || "",
              },
            ];
            changed = true;
          }

          if (changed) {
            await supabase
              .from("outlets")
              .update({
                settings: {
                  ...currSettings,
                  assigned_staff_ids: updatedStaff,
                  outlet_staff_roster: updatedRoster,
                },
              })
              .eq("id", o.id);
          }
        } else {
          let updatedStaff = staffList;
          let updatedRoster = roster;
          let changed = false;

          if (staffList.includes(userId)) {
            updatedStaff = staffList.filter((id) => id !== userId);
            changed = true;
          }

          if (roster.some((e: any) => (e.id || e.user_id) === userId)) {
            updatedRoster = roster.filter((e: any) => (e.id || e.user_id) !== userId);
            changed = true;
          }

          if (changed) {
            await supabase
              .from("outlets")
              .update({
                settings: {
                  ...currSettings,
                  assigned_staff_ids: updatedStaff,
                  outlet_staff_roster: updatedRoster,
                },
              })
              .eq("id", o.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[transferStaffToOutlet] outlets settings warning:", err);
  }

  // 4. Update localStorage cache
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (targetOutletId) {
        map[userId] = targetOutletId;
      } else {
        delete map[userId];
      }
      localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(map));

      // Also update kebabschoicepos_branch_employees
      const rawBranch = localStorage.getItem("kebabschoicepos_branch_employees");
      if (rawBranch) {
        const bMap = JSON.parse(rawBranch);
        if (bMap[userId]) {
          bMap[userId].outlet_id = targetOutletId;
          localStorage.setItem("kebabschoicepos_branch_employees", JSON.stringify(bMap));
        }
      }

      // Also update kebabschoicepos_hr_staff_profiles
      const rawHR = localStorage.getItem("kebabschoicepos_hr_staff_profiles");
      if (rawHR) {
        const hrMap = JSON.parse(rawHR);
        if (hrMap[userId]) {
          hrMap[userId].outlet_id = targetOutletId;
          localStorage.setItem("kebabschoicepos_hr_staff_profiles", JSON.stringify(hrMap));
        }
      }

      window.dispatchEvent(
        new CustomEvent("outlet:staff-updated", { detail: { userId, targetOutletId } }),
      );
      window.dispatchEvent(
        new CustomEvent("hr:profile-updated", { detail: { userId } }),
      );
    } catch (e) {
      // ignore
    }
  }

  return true;
}

/**
 * Toggle active/inactive status of an outlet
 */
export async function toggleOutletStatus(
  id: string,
  currentStatus: "active" | "inactive",
): Promise<OutletItem> {
  const nextStatus = currentStatus === "active" ? "inactive" : "active";
  return await updateOutlet(id, { status: nextStatus });
}

/**
 * Delete an outlet safely
 */
export async function deleteOutlet(id: string): Promise<boolean> {
  if (!id) throw new Error("Outlet ID wajib disertakan");

  // 1. Check if members are assigned to this outlet in staff_profiles
  try {
    const { data: members } = await supabase
      .from("staff_profiles" as any)
      .select("id")
      .eq("outlet_id", id);

    if (members && members.length > 0) {
      // Reassign members to another branch if available
      const { data: otherOutlets } = await supabase
        .from("outlets")
        .select("id")
        .neq("id", id)
        .limit(1);

      const firstOther = otherOutlets?.[0];
      if (firstOther) {
        await supabase
          .from("staff_profiles" as any)
          .update({ outlet_id: firstOther.id })
          .eq("outlet_id", id);
      } else {
        await supabase
          .from("staff_profiles" as any)
          .update({ outlet_id: null })
          .eq("outlet_id", id);
      }
    }
  } catch (e) {
    console.warn("[deleteOutlet] Reassigning staff_profiles warning:", e);
  }

  // 2. Clean child rows that might be directly linked and safe to clean
  try {
    await supabase.from("outlet_menu_items" as any).delete().eq("outlet_id", id);
  } catch (e) {
    // ignore
  }

  // 3. Attempt hard delete from outlets table
  const { error } = await supabase.from("outlets").delete().eq("id", id);

  if (error) {
    console.warn("[deleteOutlet] Hard delete blocked by constraint/FK, executing soft-delete / archive fallback:", error);
    // If foreign key constraint (code 23503) or any constraint error, fallback to soft delete
    try {
      const { data: outletRow } = await supabase
        .from("outlets")
        .select("settings")
        .eq("id", id)
        .single();

      const currSettings: Record<string, any> = (outletRow?.settings && typeof outletRow.settings === "object" && !Array.isArray(outletRow.settings)) ? (outletRow.settings as Record<string, any>) : {};
      const { error: softDeleteError } = await supabase
        .from("outlets")
        .update({
          active: false,
          settings: {
            ...currSettings,
            archived: true,
            archived_at: new Date().toISOString(),
            assigned_staff_ids: [],
          },
        })
        .eq("id", id);

      if (softDeleteError) {
        console.error("[deleteOutlet] Soft delete error:", softDeleteError);
        throw softDeleteError;
      }
    } catch (softErr) {
      console.error("[deleteOutlet] Archive fallback error:", softErr);
      throw softErr;
    }
  }

  // 4. Clean localStorage staff assignments mapping for this outlet
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      if (raw) {
        const map: Record<string, string> = JSON.parse(raw);
        let changed = false;
        for (const uid in map) {
          if (map[uid] === id) {
            delete map[uid];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(map));
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return true;
}

export interface ResolvedStaffOutlet {
  outletId: string;
  outletName: string;
  source: "stored" | "staff_profile" | "business_member" | "assigned" | "fallback";
}

/**
 * Resolves active outlet for staff/cashier with strict 5-tier fallback priority:
 * 1. Pilihan cabang aktif di localStorage 'kebabschoicepos_active_outlet_id'
 * 2. staff_profiles.outlet_id untuk userId yang login
 * 3. business_members.outlet_id untuk userId yang login
 * 4. Mencari di outlets di mana settings.assigned_staff_ids mengandung userId atau settings.manager_user_id === userId
 * 5. Fallback ke outlet pertama milik business_id
 */
export async function resolveActiveStaffOutlet(
  explicitUserId?: string,
): Promise<ResolvedStaffOutlet> {
  let uid = explicitUserId;
  let userEmail: string | undefined;
  if (!uid) {
    try {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id;
      userEmail = data?.user?.email?.toLowerCase();
    } catch {
      // ignore
    }
  } else {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id === uid) {
        userEmail = data?.user?.email?.toLowerCase();
      }
    } catch {
      // ignore
    }
  }

  // Tier 0: Direct Outlet Device Account check (Always strictly binds device to its outlet)
  if (uid || userEmail) {
    try {
      const { data: allOutlets } = await supabase
        .from("outlets")
        .select("id, name, settings")
        .order("created_at", { ascending: true });

      if (allOutlets && allOutlets.length > 0) {
        const matchedOutlet = allOutlets.find((o: any) => {
          const s = o.settings;
          if (!s || typeof s !== "object") return false;
          if (userEmail && s.outlet_login_email && s.outlet_login_email.toLowerCase() === userEmail) {
            return true;
          }
          if (userEmail && s.outlet_login_account?.email && s.outlet_login_account.email.toLowerCase() === userEmail) {
            return true;
          }
          if (uid && s.outlet_login_account?.user_id === uid) {
            return true;
          }
          return false;
        });

        if (matchedOutlet) {
          return {
            outletId: matchedOutlet.id,
            outletName: matchedOutlet.name,
            source: "assigned",
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // If user is authenticated, prioritize official database assignment first
  if (uid) {
    // Check if user is Owner or Admin
    let isOwnerOrAdmin = false;
    try {
      if (typeof window !== "undefined") {
        const simRole = localStorage.getItem("kebabschoicepos_simulated_role");
        if (simRole === "owner" || simRole === "admin") isOwnerOrAdmin = true;
      }
      if (!isOwnerOrAdmin) {
        const { data: memberRow } = await (supabase
          .from("business_members" as any) as any)
          .select("role, outlet_id")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();

        if ((memberRow as any)?.role === "owner" || (memberRow as any)?.role === "admin") {
          isOwnerOrAdmin = true;
        }

        // Check if owner in businesses
        if (!isOwnerOrAdmin) {
          const { data: ownedBiz } = await supabase
            .from("businesses")
            .select("id")
            .eq("owner_id", uid)
            .limit(1)
            .maybeSingle();
          if (ownedBiz) isOwnerOrAdmin = true;
        }
      }
    } catch {
      // ignore
    }

    // For non-owner staff (Cashier/Staff), STRICTLY check database assignment first
    if (!isOwnerOrAdmin) {
      // Tier 1 (Staff Priority): Check staff_profiles table
      try {
        const { data: staffRow } = await supabase
          .from("staff_profiles" as any)
          .select("outlet_id, outlets:outlets(id, name)")
          .or(`user_id.eq.${uid},id.eq.${uid}`)
          .not("outlet_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (staffRow && (staffRow as any).outlet_id) {
          const targetId = (staffRow as any).outlet_id;
          const outName =
            (staffRow as any).outlets?.name ||
            (await supabase.from("outlets").select("name").eq("id", targetId).maybeSingle()).data?.name ||
            "Outlet";
          return {
            outletId: targetId,
            outletName: outName,
            source: "staff_profile",
          };
        }
      } catch {
        // ignore schema missing
      }

      // Tier 2 (Staff Priority): Check business_members table
      try {
        const { data: memberRow } = await supabase
          .from("business_members")
          .select("outlet_id, outlets:outlets(id, name)")
          .eq("user_id", uid)
          .not("outlet_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (memberRow && (memberRow as any).outlet_id) {
          const targetId = (memberRow as any).outlet_id;
          const outName =
            (memberRow as any).outlets?.name ||
            (await supabase.from("outlets").select("name").eq("id", targetId).maybeSingle()).data?.name ||
            "Outlet";
          return {
            outletId: targetId,
            outletName: outName,
            source: "business_member",
          };
        }
      } catch {
        // ignore
      }

      // Tier 3 (Staff Priority): Search in outlets where settings.assigned_staff_ids contains uid or settings.manager_user_id === uid
      try {
        const { data: allOutlets } = await supabase
          .from("outlets")
          .select("id, name, settings")
          .order("created_at", { ascending: true });

        if (allOutlets && allOutlets.length > 0) {
          const matched = allOutlets.find((o: any) => {
            const s = o.settings;
            if (!s || typeof s !== "object") return false;
            if (s.manager_user_id === uid) return true;
            if (Array.isArray(s.assigned_staff_ids) && s.assigned_staff_ids.includes(uid)) return true;
            return false;
          });

          if (matched) {
            return {
              outletId: matched.id,
              outletName: matched.name,
              source: "assigned",
            };
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Tier 4: For Owner/Admin or staff without explicit assigned outlet, check active outlet selection in localStorage
  if (typeof window !== "undefined") {
    try {
      const storedOutletId = localStorage.getItem("kebabschoicepos_active_outlet_id");
      if (storedOutletId && storedOutletId !== "all") {
        const { data: out } = await supabase
          .from("outlets")
          .select("id, name")
          .eq("id", storedOutletId)
          .maybeSingle();
        if (out) {
          return {
            outletId: out.id,
            outletName: out.name,
            source: "stored",
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // Tier 5: Fallback to first outlet
  try {
    const { data: firstOutlet } = await supabase
      .from("outlets")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstOutlet) {
      return {
        outletId: firstOutlet.id,
        outletName: firstOutlet.name,
        source: "fallback",
      };
    }
  } catch {
    // ignore
  }

  return {
    outletId: "default",
    outletName: "Outlet Utama",
    source: "fallback",
  };
}
