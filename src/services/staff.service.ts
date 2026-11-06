import { supabase } from "@/integrations/supabase/client";

export interface StaffItem {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "manager" | "cashier";
  gender?: "male" | "female";
  outlet?: string;
  outlet_id: string | null;
  outlet_name: string;
  outlet_code: string;
  created_at: string;
  status: "active" | "inactive";
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password?: string;
  role: string;
  gender?: "male" | "female";
  outlet_id?: string | null;
  avatar_url?: string | null;
  manager_permissions?: string[];
  owner_gmail_confirmed?: boolean;
  is_outlet_account?: boolean;
}

export function isOutletDeviceAccount(item: any, outlets?: any[]): boolean {
  if (!item) return false;
  if (item.is_outlet_account === true) return true;
  const name = String(item.name || item.full_name || "").toLowerCase().trim();
  if (
    name.startsWith("pos outlet") ||
    name.startsWith("akun login outlet") ||
    name.includes("terminal outlet")
  ) {
    return true;
  }
  const email = String(item.email || "").toLowerCase().trim();
  if (email.includes("@outlet.local")) {
    return true;
  }
  if (outlets && Array.isArray(outlets)) {
    for (const out of outlets) {
      const s = out.settings && typeof out.settings === "object" ? out.settings : {};
      const loginEmail = String(s.outlet_login_email || s.outlet_login_account?.email || "").toLowerCase().trim();
      if (loginEmail && (loginEmail === email || loginEmail === name)) {
        return true;
      }
    }
  }
  return false;
}

async function getAuthHeader(): Promise<HeadersInit> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Sesi pengguna tidak aktif. Silakan login kembali.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Direct Supabase query fallback in case API route cannot be reached in certain environments
 */
async function queryStaffListDirect(): Promise<StaffItem[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return [];
  }

  const callerId = authData.user.id;
  console.log("CURRENT USER ID:", callerId);

  // 1. Find businesses.owner_id
  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", callerId)
    .order("created_at", { ascending: true });

  let businessId: string | null = null;
  let businessIds: string[] = [];

  const firstOwned = ownedBusinesses?.[0];
  if (firstOwned) {
    businessId = firstOwned.id;
    businessIds = (ownedBusinesses || []).map((b) => b.id);
    console.log("BUSINESS FOUND:", businessId);
  } else {
    const { data: memberBusinesses } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", callerId)
      .order("created_at", { ascending: false })
      .limit(1);

    const firstMemberBiz = memberBusinesses?.[0];
    if (firstMemberBiz) {
      businessId = firstMemberBiz.business_id;
      businessIds = [businessId];
      console.log("BUSINESS FOUND:", businessId);
    }
  }

  if (!businessId) {
    console.log("BUSINESS FOUND: NOT_FOUND");
    console.log("STAFF QUERY RESULT:", []);
    return [];
  }

  // 2. Query business_members without outlet_id
  const { data: members, error: mErr } = await supabase
    .from("business_members")
    .select("id, business_id, user_id, role, created_at")
    .in("business_id", businessIds)
    .order("created_at", { ascending: false });

  if (mErr || !members) {
    console.error("[staff.service] Direct member query error:", mErr);
    return [];
  }

  const uniqueMembers: typeof members = [];
  const seenUsers = new Set<string>();
  for (const m of members) {
    if (!seenUsers.has(m.user_id)) {
      seenUsers.add(m.user_id);
      uniqueMembers.push(m);
    }
  }

  const userIds = uniqueMembers.map((m) => m.user_id);

  // 3. Join profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  // 4. Join staff_profiles for outlet_id (safely catch if table does not exist)
  let staffProfiles: any[] = [];
  try {
    const { data: spData, error: spErr } = await supabase
      .from("staff_profiles" as any)
      .select("user_id, outlet_id, full_name, avatar_url")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    if (!spErr && spData) {
      staffProfiles = spData;
    }
  } catch (err) {
    console.warn("[staff.service] staff_profiles query fallback:", err);
  }

  const staffProfileMap = new Map<string, any>(
    staffProfiles.map((sp: any) => [sp.user_id, sp]),
  );

  // 5. Join outlets with settings JSON for assignment resilience
  const { data: outlets } = await supabase
    .from("outlets")
    .select("id, name, code, settings")
    .in("business_id", businessIds);

  const outletList = outlets ?? [];
  const outletMap = new Map(outletList.map((o) => [o.id, o]));

  // Read localStorage fallback map
  let localAssignmentMap: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      if (raw) localAssignmentMap = JSON.parse(raw);
    } catch (e) {
      // ignore
    }
  }

  const staffList: StaffItem[] = uniqueMembers.map((m) => {
    const profile = profileMap.get(m.user_id);
    const staffProfile = staffProfileMap.get(m.user_id);

    let assignedOutletId: string | null = staffProfile?.outlet_id || null;

    // Fallback 1: Check outlets.settings.assigned_staff_ids or manager_user_id
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

    // Fallback 2: Check localStorage map
    if (!assignedOutletId && localAssignmentMap[m.user_id]) {
      assignedOutletId = localAssignmentMap[m.user_id] || null;
    }

    const outlet = assignedOutletId ? outletMap.get(assignedOutletId) : null;
    const outletName =
      outlet?.name || (m.role === "owner" ? "Semua Cabang (HQ)" : "Belum ditentukan");

    return {
      id: m.id,
      user_id: m.user_id,
      name: staffProfile?.full_name || profile?.display_name || "Staff",
      email:
        m.user_id === callerId
          ? authData.user.email || "owner@kebabschoice.com"
          : "staff@kebabschoice.com",
      avatar_url: staffProfile?.avatar_url || profile?.avatar_url || null,
      role: m.role as any,
      outlet: outletName,
      outlet_name: outletName,
      outlet_id: assignedOutletId,
      outlet_code: outlet?.code || "",
      created_at: m.created_at,
      status: "active",
    };
  });

  const merged = await mergeBranchEmployees(staffList);
  const cleanStaff = merged.filter((s) => !isOutletDeviceAccount(s, outletList));
  console.log("STAFF QUERY RESULT:", cleanStaff);
  return cleanStaff;
}

export async function mergeBranchEmployees(existingStaff: StaffItem[]): Promise<StaffItem[]> {
  const mergedMap = new Map<string, StaffItem>();
  for (const s of existingStaff) {
    if (!isOutletDeviceAccount(s)) {
      mergedMap.set(s.user_id || s.id, s);
    }
  }

  // 1. Fetch outlets to inspect settings.outlet_staff_roster
  try {
    const { data: outlets } = await supabase.from("outlets").select("id, name, code, settings");
    if (outlets && Array.isArray(outlets)) {
      for (const out of outlets) {
        const settings =
          out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
            ? (out.settings as any)
            : {};
        const roster: any[] = Array.isArray(settings.outlet_staff_roster)
          ? settings.outlet_staff_roster
          : [];
        for (const emp of roster) {
          const empId = emp.user_id || emp.id;
          if (empId && !mergedMap.has(empId) && !isOutletDeviceAccount(emp, outlets)) {
            mergedMap.set(empId, {
              id: empId,
              user_id: empId,
              name: emp.name || emp.full_name || "Karyawan Cabang",
              email: emp.email || "",
              avatar_url: emp.avatar_url || null,
              role: (emp.role as any) || "cashier",
              gender: emp.gender || "male",
              outlet: out.name,
              outlet_name: out.name,
              outlet_id: out.id,
              outlet_code: out.code || "",
              created_at: emp.created_at || new Date().toISOString(),
              status: emp.status || "active",
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("[staff.service] Error loading outlet_staff_roster:", err);
  }

  // 2. Query staff_profiles where user_id is not yet in mergedMap
  try {
    const { data: spList } = await supabase.from("staff_profiles" as any).select("*");
    const spRows: any[] = Array.isArray(spList) ? spList : [];
    for (const sp of spRows) {
      const spId = sp.user_id || sp.id;
      if (spId && !mergedMap.has(spId) && !isOutletDeviceAccount(sp)) {
        mergedMap.set(spId, {
          id: spId,
          user_id: spId,
          name: sp.full_name || "Karyawan Cabang",
          email: sp.email || "",
          avatar_url: sp.avatar_url || null,
          role: (sp.role as any) || "cashier",
          gender: sp.gender || "male",
          outlet: sp.outlet_name || "Outlet Cabang",
          outlet_name: sp.outlet_name || "Outlet Cabang",
          outlet_id: sp.outlet_id || null,
          outlet_code: "",
          created_at: sp.created_at || sp.updated_at || new Date().toISOString(),
          status: "active",
        });
      }
    }
  } catch (err) {
    console.warn("[staff.service] Error checking staff_profiles for non-auth staff:", err);
  }

  // 3. Fallback to localStorage kebabschoicepos_branch_employees
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_branch_employees");
      if (raw) {
        const localEmps: Record<string, any> = JSON.parse(raw);
        for (const [empId, emp] of Object.entries(localEmps)) {
          if (!mergedMap.has(empId)) {
            mergedMap.set(empId, {
              id: empId,
              user_id: empId,
              name: emp.name || emp.full_name || "Karyawan Cabang",
              email: emp.email || "",
              avatar_url: emp.avatar_url || null,
              role: (emp.role as any) || "cashier",
              outlet: emp.outlet_name || "Outlet Cabang",
              outlet_name: emp.outlet_name || "Outlet Cabang",
              outlet_id: emp.outlet_id || null,
              outlet_code: emp.outlet_code || "",
              created_at: emp.created_at || new Date().toISOString(),
              status: emp.status || "active",
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return Array.from(mergedMap.values());
}

export async function getStaffList(): Promise<StaffItem[]> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch("/api/list-staff", {
      method: "GET",
      headers,
    });

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.staff || [];
      const staffItems: StaffItem[] = list.map((item: any) => ({
        id: item.id || item.user_id,
        user_id: item.user_id,
        name: item.name || "Staff",
        email: item.email || "",
        avatar_url: item.avatar_url || null,
        role: item.role,
        outlet: item.outlet || item.outlet_name || "Semua Cabang (HQ)",
        outlet_name: item.outlet_name || item.outlet || "Semua Cabang (HQ)",
        outlet_id: item.outlet_id || null,
        outlet_code: item.outlet_code || "",
        created_at: item.created_at || new Date().toISOString(),
        status: item.status || "active",
      }));
      const merged = await mergeBranchEmployees(staffItems);
      return merged.filter((s) => !isOutletDeviceAccount(s));
    }

    console.warn(
      `[staff.service] /api/list-staff responded with status ${res.status}, using client fallback`,
    );
    return await queryStaffListDirect();
  } catch (err) {
    console.warn("[staff.service] getStaffList network error, using client fallback:", err);
    return await queryStaffListDirect();
  }
}

export async function createStaffAccount(payload: CreateStaffInput): Promise<any> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch("/api/create-staff", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Gagal mendaftarkan staff baru");
    }

    return json;
  } catch (err) {
    console.error("[staff.service] createStaffAccount error:", err);
    throw err;
  }
}

export interface CreateBranchEmployeeInput {
  name: string;
  outlet_id: string;
  role?: "cashier" | "manager" | "admin" | "owner" | "crew" | string;
  gender?: "male" | "female";
  job_title?: string;
  phone?: string;
  address?: string;
  employment_status?: "Tetap" | "Kontrak" | "Probation" | "Magang";
  base_salary?: number;
  daily_allowance?: number;
  late_deduction?: number;
  absence_deduction?: number;
  default_shift?: string;
  avatar_url?: string | null;
}

export async function createBranchEmployee(input: CreateBranchEmployeeInput): Promise<StaffItem> {
  const employeeId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `emp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const role = input.role || "cashier";
  const jobTitle =
    input.job_title ||
    (role === "cashier"
      ? "Kasir Cabang"
      : role === "manager"
        ? "Store Manager"
        : "Staff Cabang");

  // 1. Resolve business and outlet details
  let businessId = "00000000-0000-0000-0000-000000000000";
  let outletName = "Outlet Cabang";
  let outletCode = "";

  try {
    const { data: outletRow } = await supabase
      .from("outlets")
      .select("id, name, code, business_id, settings")
      .eq("id", input.outlet_id)
      .maybeSingle();

    if (outletRow) {
      if (outletRow.business_id) businessId = outletRow.business_id;
      outletName = outletRow.name || outletName;
      outletCode = outletRow.code || outletCode;

      // Update outlets.settings
      const currSettings: Record<string, any> =
        outletRow.settings &&
        typeof outletRow.settings === "object" &&
        !Array.isArray(outletRow.settings)
          ? (outletRow.settings as Record<string, any>)
          : {};

      const existingRoster: any[] = Array.isArray(currSettings.outlet_staff_roster)
        ? currSettings.outlet_staff_roster
        : [];
      const updatedRoster = [
        ...existingRoster.filter((e) => (e.id || e.user_id) !== employeeId),
        {
          id: employeeId,
          user_id: employeeId,
          name: input.name.trim(),
          role,
          job_title: jobTitle,
          outlet_id: input.outlet_id,
          outlet_name: outletName,
          outlet_code: outletCode,
          phone: input.phone || "",
          address: input.address || "",
          default_shift: input.default_shift || "Shift Pagi",
          employment_status: input.employment_status || "Tetap",
          base_salary: input.base_salary ?? 2000000,
          daily_allowance: input.daily_allowance ?? 25000,
          late_deduction: input.late_deduction ?? 20000,
          absence_deduction: input.absence_deduction ?? 80000,
          created_at: new Date().toISOString(),
          status: "active",
        },
      ];

      const existingStaffIds: string[] = Array.isArray(currSettings.assigned_staff_ids)
        ? currSettings.assigned_staff_ids
        : [];
      const updatedStaffIds = Array.from(new Set([...existingStaffIds, employeeId]));

      const existingHRProfiles: Record<string, any> =
        currSettings.hr_profiles &&
        typeof currSettings.hr_profiles === "object" &&
        !Array.isArray(currSettings.hr_profiles)
          ? currSettings.hr_profiles
          : {};

      const hrProfile = {
        id: employeeId,
        user_id: employeeId,
        business_id: businessId,
        outlet_id: input.outlet_id,
        full_name: input.name.trim(),
        phone: input.phone || "",
        address: input.address || "",
        job_title: jobTitle,
        role,
        employment_status: input.employment_status || "Tetap",
        join_date: new Date().toISOString().split("T")[0],
        base_salary: input.base_salary ?? 2000000,
        daily_allowance: input.daily_allowance ?? 25000,
        late_deduction: input.late_deduction ?? 20000,
        absence_deduction: input.absence_deduction ?? 80000,
        default_shift: input.default_shift || "Shift Pagi",
        avatar_url: input.avatar_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("outlets")
        .update({
          settings: {
            ...currSettings,
            outlet_staff_roster: updatedRoster,
            assigned_staff_ids: updatedStaffIds,
            hr_profiles: {
              ...existingHRProfiles,
              [employeeId]: hrProfile,
            },
          },
        })
        .eq("id", input.outlet_id);

      if (typeof window !== "undefined") {
        try {
          const rawHR = localStorage.getItem("kebabschoicepos_hr_staff_profiles");
          const hrMap = rawHR ? JSON.parse(rawHR) : {};
          hrMap[employeeId] = hrProfile;
          localStorage.setItem("kebabschoicepos_hr_staff_profiles", JSON.stringify(hrMap));
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[createBranchEmployee] outlets.settings update warning:", err);
  }

  const staffItem: StaffItem = {
    id: employeeId,
    user_id: employeeId,
    name: input.name.trim(),
    email: "",
    avatar_url: input.avatar_url || null,
    role: (role as any) || "cashier",
    gender: input.gender || "male",
    outlet: outletName,
    outlet_name: outletName,
    outlet_id: input.outlet_id,
    outlet_code: outletCode,
    created_at: new Date().toISOString(),
    status: "active",
  };

  // 3. LocalStorage backups
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_branch_employees");
      const map = raw ? JSON.parse(raw) : {};
      map[employeeId] = staffItem;
      localStorage.setItem("kebabschoicepos_branch_employees", JSON.stringify(map));

      const rawAssign = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      const assignMap = rawAssign ? JSON.parse(rawAssign) : {};
      assignMap[employeeId] = input.outlet_id;
      localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(assignMap));

      const rawHR = localStorage.getItem("kebabschoicepos_hr_staff_profiles");
      const hrMap = rawHR ? JSON.parse(rawHR) : {};
      hrMap[employeeId] = {
        id: `hr-prof-${employeeId}`,
        user_id: employeeId,
        business_id: businessId,
        outlet_id: input.outlet_id,
        outlet_name: outletName,
        full_name: input.name.trim(),
        phone: input.phone || "",
        address: input.address || "",
        avatar_url: input.avatar_url || null,
        job_title: jobTitle,
        role,
        gender: input.gender || "male",
        employment_status: input.employment_status || "Tetap",
        join_date: new Date().toISOString().split("T")[0],
        base_salary: input.base_salary ?? 2000000,
        daily_allowance: input.daily_allowance ?? 25000,
        late_deduction: input.late_deduction ?? 20000,
        absence_deduction: input.absence_deduction ?? 80000,
        default_shift: input.default_shift || "Shift Pagi",
      };
      localStorage.setItem("kebabschoicepos_hr_staff_profiles", JSON.stringify(hrMap));

      window.dispatchEvent(
        new CustomEvent("outlet:staff-updated", { detail: { outletId: input.outlet_id } }),
      );
      window.dispatchEvent(
        new CustomEvent("hr:profile-updated", { detail: { userId: employeeId } }),
      );
    } catch (e) {
      console.warn("[createBranchEmployee] LocalStorage warning:", e);
    }
  }

  return staffItem;
}

export async function deleteStaffAccount(userId: string): Promise<boolean> {
  // 1. Try deleting via API if it's an auth user
  try {
    const headers = await getAuthHeader();
    await fetch("/api/delete-staff", {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (err) {
    console.warn("[staff.service] API delete-staff warning (may be non-auth staff):", err);
  }

  // 2. Remove from staff_profiles
  try {
    await supabase.from("staff_profiles" as any).delete().eq("user_id", userId);
  } catch (err) {
    console.warn("[staff.service] staff_profiles delete warning:", err);
  }

  // 3. Remove from outlets.settings (assigned_staff_ids and outlet_staff_roster)
  try {
    const { data: outlets } = await supabase.from("outlets").select("id, settings");
    if (outlets && Array.isArray(outlets)) {
      for (const out of outlets) {
        const s: Record<string, any> =
          out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
            ? (out.settings as Record<string, any>)
            : {};
        let modified = false;
        let newStaff = s.assigned_staff_ids;
        let newRoster = s.outlet_staff_roster;

        if (Array.isArray(s.assigned_staff_ids) && s.assigned_staff_ids.includes(userId)) {
          newStaff = s.assigned_staff_ids.filter((id: string) => id !== userId);
          modified = true;
        }
        if (Array.isArray(s.outlet_staff_roster)) {
          const filteredRoster = s.outlet_staff_roster.filter(
            (e: any) => (e.id || e.user_id) !== userId,
          );
          if (filteredRoster.length !== s.outlet_staff_roster.length) {
            newRoster = filteredRoster;
            modified = true;
          }
        }
        if (s.manager_user_id === userId) {
          s.manager_user_id = null;
          modified = true;
        }

        if (modified) {
          await supabase
            .from("outlets")
            .update({
              settings: {
                ...s,
                assigned_staff_ids: newStaff,
                outlet_staff_roster: newRoster,
              },
            })
            .eq("id", out.id);
        }
      }
    }
  } catch (err) {
    console.warn("[staff.service] outlets.settings roster cleanup warning:", err);
  }

  // 4. Remove from localStorage
  if (typeof window !== "undefined") {
    try {
      const rawBranch = localStorage.getItem("kebabschoicepos_branch_employees");
      if (rawBranch) {
        const map = JSON.parse(rawBranch);
        delete map[userId];
        localStorage.setItem("kebabschoicepos_branch_employees", JSON.stringify(map));
      }

      const rawHR = localStorage.getItem("kebabschoicepos_hr_staff_profiles");
      if (rawHR) {
        const hr = JSON.parse(rawHR);
        delete hr[userId];
        localStorage.setItem("kebabschoicepos_hr_staff_profiles", JSON.stringify(hr));
      }

      const rawAssign = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      if (rawAssign) {
        const ass = JSON.parse(rawAssign);
        delete ass[userId];
        localStorage.setItem("kebabschoicepos_staff_outlet_assignments", JSON.stringify(ass));
      }

      window.dispatchEvent(
        new CustomEvent("outlet:staff-updated", { detail: { userId } }),
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
