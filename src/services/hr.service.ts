import { supabase } from "@/integrations/supabase/client";
import { getStaffList, type StaffItem, isOutletDeviceAccount } from "./staff.service";
import { getOutletList, resolveCurrentBusinessIds, type OutletItem } from "./outlet.service";

export interface StaffProfile {
  id: string;
  user_id: string;
  business_id?: string;
  outlet_id: string | null;
  outlet_name?: string;
  full_name: string;
  phone: string;
  address: string;
  avatar_url: string | null;
  job_title: string;
  role: "owner" | "admin" | "manager" | "cashier";
  gender?: "male" | "female";
  employment_status: "Tetap" | "Kontrak" | "Probation" | "Magang";
  join_date: string;
  base_salary: number;
  daily_allowance: number;
  late_deduction: number;
  absence_deduction: number;
  default_shift?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffShift {
  id: string;
  business_id?: string;
  outlet_id: string | null;
  outlet_name?: string;
  shift_name: string;
  start_time: string; // e.g. "08:00"
  end_time: string; // e.g. "16:00"
  grace_period_minutes: number;
  assigned_staff_ids: string[];
  created_at?: string;
}

export interface StaffAttendance {
  id: string;
  business_id?: string;
  outlet_id: string | null;
  outlet_name?: string;
  user_id: string;
  staff_name: string;
  date: string; // YYYY-MM-DD
  check_in_time: string | null;
  check_out_time: string | null;
  type: "in" | "out";
  status: "on_time" | "late" | "early_leave";
  late_minutes?: number;
  device: string;
  face_snapshot_url: string | null;
  notes?: string;
  created_at: string;
}

export interface StaffPayroll {
  id: string;
  business_id?: string;
  outlet_id: string | null;
  outlet_name?: string;
  user_id: string;
  staff_name: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  total_days_present: number;
  total_times_late: number;
  total_days_absent: number;
  allowance_amount: number;
  deduction_amount: number;
  bonus_amount: number;
  net_salary: number;
  status: "draft" | "approved" | "paid";
  payment_date: string | null;
  notes?: string;
  created_at?: string;
}

const LOCAL_STORAGE_PROFILES_KEY = "kebabschoicepos_hr_staff_profiles";
const LOCAL_STORAGE_SHIFTS_KEY = "kebabschoicepos_hr_shifts";
const LOCAL_STORAGE_ATTENDANCES_KEY = "kebabschoicepos_hr_attendances";
const LOCAL_STORAGE_PAYROLLS_KEY = "kebabschoicepos_hr_payrolls";
export const LOCAL_STORAGE_ROSTER_SCHEDULES_KEY = "kebabschoicepos_roster_schedules_v1";

// -------------------------------------------------------------
// 5. WEEKLY ROSTER SCHEDULE INTERFACES & TYPES
// -------------------------------------------------------------

export interface DailyScheduleCell {
  staffName: string;
  userId?: string;
  status: "NORMAL" | "OFF" | "SAKIT" | "IZIN";
  shiftType: "pagi" | "malam" | "off";
  note?: string;
}

export interface WeekSlotRow {
  id: string; // e.g. "slot-pagi-1"
  shiftType: "pagi" | "malam" | "off";
  label: string; // "Shift Pagi #1", "Shift Malam #1", "Libur (OFF)"
  days: Record<string, DailyScheduleCell>; // dateStr "YYYY-MM-DD" -> DailyScheduleCell
}

export interface WeeklyRosterWeek {
  weekNumber: number; // 1 to 5
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  days: {
    dateStr: string;
    dayName: string;
    dayNumber: number;
    dayLabel?: string;
    isToday?: boolean;
    isCurrentMonth: boolean;
  }[];
  rows: WeekSlotRow[];
}

export interface MonthlyRosterSchedule {
  outletId: string;
  outletName: string;
  month: number; // 1-12
  year: number;
  weeks: WeeklyRosterWeek[];
  updatedAt: string;
}

// Default initial shifts: 2 SHIFTS ONLY (Pagi 07:00-16:00 & Malam 13:00-22:00)
export const DEFAULT_SHIFTS: StaffShift[] = [
  {
    id: "shift-pagi",
    outlet_id: null,
    shift_name: "Shift Pagi",
    start_time: "07:00",
    end_time: "16:00",
    grace_period_minutes: 15,
    assigned_staff_ids: [],
  },
  {
    id: "shift-malam",
    outlet_id: null,
    shift_name: "Shift Malam",
    start_time: "13:00",
    end_time: "22:00",
    grace_period_minutes: 15,
    assigned_staff_ids: [],
  },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_PATTERN.test(val);
}

/**
 * Formats a Date into local Indonesian date string "YYYY-MM-DD" (Asia/Jakarta / WIB)
 * so early-morning attendance (e.g. 06:00 WIB) never shifts to yesterday's UTC date.
 */
export function formatLocalDateWIB(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to device local time components (never toISOString() UTC!)
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolves current active business ID (never falls back to an unrelated tenant's business)
 */
async function resolveBusinessId(explicitBusinessId?: string): Promise<string> {
  if (explicitBusinessId && isValidUuid(explicitBusinessId)) {
    return explicitBusinessId;
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user) {
    const { data: owned } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", authData.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (owned?.id) return owned.id;

    const { data: member } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", authData.user.id)
      .limit(1)
      .maybeSingle();

    if (member?.business_id) return member.business_id;
  }

  if (typeof window !== "undefined") {
    const cachedBid = localStorage.getItem("kebabschoicepos_active_business_id");
    if (cachedBid && isValidUuid(cachedBid)) return cachedBid;
  }

  return "";
}

// -------------------------------------------------------------
// 1. HR STAFF PROFILES
// -------------------------------------------------------------

export async function getHRStaffProfiles(businessId?: string): Promise<StaffProfile[]> {
  try {
    const resolvedBid = await resolveBusinessId(businessId);
    let allBizIds: string[] = resolvedBid ? [resolvedBid] : [];
    try {
      const resolvedBiz = await resolveCurrentBusinessIds(businessId || resolvedBid || undefined);
      if (resolvedBiz.allIds.length > 0) allBizIds = resolvedBiz.allIds;
    } catch {}

    const [staffList, outlets] = await Promise.all([
      getStaffList().catch(() => [] as StaffItem[]),
      getOutletList().catch(() => [] as OutletItem[]),
    ]);

    const outletMap = new Map(outlets.map((o) => [o.id, o.outlet_name || o.name]));

    // Check supabase table strictly scoped by user's business IDs
    let dbProfiles: any[] = [];
    if (allBizIds.length === 1 && resolvedBid) {
      try {
        const { data } = await supabase
          .from("staff_profiles" as any)
          .select("*")
          .eq("business_id", resolvedBid);
        if (data && Array.isArray(data)) {
          dbProfiles = data;
        }
      } catch {
        // fallback
      }
    } else if (allBizIds.length > 0) {
      try {
        const { data } = await supabase
          .from("staff_profiles" as any)
          .select("*")
          .in("business_id", allBizIds);
        if (data && Array.isArray(data)) {
          dbProfiles = data;
        }
      } catch {
        // fallback
      }
    }

    let localSaved: Record<string, any> = {};
    if (typeof window !== "undefined") {
      try {
        localSaved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || "{}") || {};
      } catch {
        localSaved = {};
      }
    }

    const profileMap = new Map<string, any>();
    for (const p of dbProfiles) {
      if (p?.user_id) profileMap.set(p.user_id, p);
    }

    // Also pull hr_profiles embedded in outlets.settings
    for (const out of outlets) {
      const s = (out.settings && typeof out.settings === "object" ? out.settings : {}) as Record<string, any>;
      if (s.hr_profiles && typeof s.hr_profiles === "object") {
        for (const [uid, hp] of Object.entries(s.hr_profiles)) {
          if (uid && !profileMap.has(uid)) {
            profileMap.set(uid, hp);
          }
        }
      }
    }

    // Build unified deduplicated human staff list from:
    // 1. getStaffList()
    // 2. outlets.settings.outlet_staff_roster
    // 3. outlets.staff_list
    // 4. dbProfiles (staff_profiles)
    const unifiedStaffMap = new Map<string, StaffItem>();
    const seenNames = new Set<string>();

    const addStaffCandidate = (candidate: StaffItem) => {
      if (!candidate) return;
      const key = candidate.user_id || candidate.id;
      const cleanName = String(candidate.name || "").trim();
      if (!key || !cleanName || isOutletDeviceAccount(candidate, outlets)) return;
      const nameKey = cleanName.toLowerCase();
      if (unifiedStaffMap.has(key) || seenNames.has(nameKey)) return;
      unifiedStaffMap.set(key, candidate);
      seenNames.add(nameKey);
    };

    for (const s of staffList) {
      addStaffCandidate(s);
    }

    for (const out of outlets) {
      const s = (out.settings && typeof out.settings === "object" ? out.settings : {}) as Record<string, any>;
      const roster: any[] = Array.isArray(s.outlet_staff_roster) ? s.outlet_staff_roster : [];
      for (const emp of roster) {
        const empName = String(emp.name || emp.full_name || "").trim();
        if (!empName) continue;
        const empId =
          emp.user_id ||
          emp.id ||
          `emp-${out.id}-${empName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        addStaffCandidate({
          id: empId,
          user_id: empId,
          name: empName,
          email: emp.email || "",
          avatar_url: emp.avatar_url || null,
          role: (emp.role as any) || "cashier",
          gender: emp.gender || "male",
          outlet: out.name,
          outlet_name: out.outlet_name || out.name,
          outlet_id: out.id,
          outlet_code: out.code || "",
          created_at: emp.created_at || new Date().toISOString(),
          status: emp.status || "active",
        });
      }
      for (const st of out.staff_list || []) {
        addStaffCandidate({
          id: st.id || st.user_id,
          user_id: st.user_id || st.id,
          name: st.name,
          email: st.email || "",
          avatar_url: st.avatar_url || null,
          role: st.role || "cashier",
          outlet: out.name,
          outlet_name: out.outlet_name || out.name,
          outlet_id: st.outlet_id || out.id,
          outlet_code: out.code || "",
          created_at: new Date().toISOString(),
          status: "active",
        });
      }
    }

    for (const dbp of dbProfiles) {
      const key = dbp.user_id || dbp.id;
      const nm = String(dbp.full_name || "").trim();
      if (!key || !nm) continue;
      addStaffCandidate({
        id: key,
        user_id: key,
        name: nm,
        email: dbp.email || "",
        avatar_url: dbp.avatar_url || null,
        role: (dbp.role as any) || "cashier",
        gender: dbp.gender || "male",
        outlet: (dbp.outlet_id ? outletMap.get(dbp.outlet_id) : null) || "Semua Cabang (HQ)",
        outlet_name: (dbp.outlet_id ? outletMap.get(dbp.outlet_id) : null) || "Semua Cabang (HQ)",
        outlet_id: dbp.outlet_id || null,
        outlet_code: "",
        created_at: dbp.created_at || new Date().toISOString(),
        status: "active",
      });
    }

    const humanStaffList = Array.from(unifiedStaffMap.values());

    return humanStaffList.map((staff) => {
      const db = profileMap.get(staff.user_id) || {};
      const local = localSaved[staff.user_id] || {};

      const baseSalary = Number(db.base_salary ?? local.base_salary ?? 2000000);
      const dailyAllowance = Number(db.daily_allowance ?? local.daily_allowance ?? 25000);
      const lateDeduction = Number(db.late_deduction ?? local.late_deduction ?? 20000);
      const absenceDeduction = Number(db.absence_deduction ?? local.absence_deduction ?? 80000);

      const jobTitle =
        db.job_title ||
        local.job_title ||
        (staff.role === "manager"
          ? "Store Manager"
          : staff.role === "cashier"
            ? "Kasir POS"
            : "Staff Operasional");

      return {
        id: db.id || `hr-prof-${staff.user_id}`,
        user_id: staff.user_id,
        business_id: db.business_id || resolvedBid || undefined,
        outlet_id: staff.outlet_id || db.outlet_id || null,
        outlet_name:
          (staff.outlet_id ? outletMap.get(staff.outlet_id) : null) ||
          staff.outlet_name ||
          "Semua Cabang (HQ)",
        full_name: db.full_name || staff.name,
        phone: db.phone || local.phone || "081234567890",
        address: db.address || local.address || "Jl. Kebon Jeruk No. 12, Jakarta",
        avatar_url: db.avatar_url || local.avatar_url || staff.avatar_url || null,
        job_title: jobTitle,
        role: staff.role,
        gender: db.gender || local.gender || staff.gender || "male",
        employment_status: db.employment_status || local.employment_status || "Tetap",
        join_date: db.join_date || local.join_date || "2026-01-01",
        base_salary: baseSalary,
        daily_allowance: dailyAllowance,
        late_deduction: lateDeduction,
        absence_deduction: absenceDeduction,
      };
    });
  } catch (err) {
    console.error("[getHRStaffProfiles] Error:", err);
    return [];
  }
}

export async function updateHRStaffProfile(
  userId: string,
  data: Partial<StaffProfile>,
): Promise<boolean> {
  try {
    const businessId = await resolveBusinessId(data.business_id);
    const nowIso = new Date().toISOString();

    // 1. Save to localStorage cache
    if (typeof window !== "undefined") {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || "{}");
      local[userId] = { ...(local[userId] || {}), ...data, updated_at: nowIso };
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(local));
    }

    let persistedToSupabase = false;

    // 2. Persist directly to Supabase staff_profiles table (authoritative DB storage)
    if (businessId && isValidUuid(userId)) {
      const dbPayload: Record<string, any> = {
        user_id: userId,
        business_id: businessId,
        outlet_id: isValidUuid(data.outlet_id) ? data.outlet_id : null,
        full_name: data.full_name || "Karyawan",
        phone: data.phone ?? null,
        address: data.address ?? null,
        avatar_url: data.avatar_url ?? null,
        job_title: data.job_title || "Staff Operasional",
        role: data.role || "cashier",
        employment_status: data.employment_status || "Tetap",
        ...(data.join_date ? { join_date: data.join_date } : {}),
        ...(data.base_salary !== undefined ? { base_salary: Number(data.base_salary) } : {}),
        ...(data.daily_allowance !== undefined ? { daily_allowance: Number(data.daily_allowance) } : {}),
        ...(data.late_deduction !== undefined ? { late_deduction: Number(data.late_deduction) } : {}),
        ...(data.absence_deduction !== undefined ? { absence_deduction: Number(data.absence_deduction) } : {}),
        updated_at: nowIso,
      };

      const { data: existingProf, error: findErr } = await supabase
        .from("staff_profiles" as any)
        .select("id")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!findErr && (existingProf as any)?.id) {
        const { error: updErr } = await supabase
          .from("staff_profiles" as any)
          .update(dbPayload)
          .eq("id", (existingProf as any).id)
          .eq("business_id", businessId);
        if (updErr) {
          console.error("[updateHRStaffProfile] staff_profiles update error:", updErr.message);
        } else {
          persistedToSupabase = true;
        }
      } else {
        const { error: insErr } = await supabase
          .from("staff_profiles" as any)
          .insert({ ...dbPayload, created_at: nowIso });
        if (insErr) {
          console.error("[updateHRStaffProfile] staff_profiles insert error:", insErr.message);
        } else {
          persistedToSupabase = true;
        }
      }
    }

    // 3. Update outlets.settings (both hr_profiles and outlet_staff_roster) strictly scoped by business_id
    if (businessId) {
      const { data: allOutlets, error: outletsErr } = await supabase
        .from("outlets")
        .select("id, settings")
        .eq("business_id", businessId);

      if (!outletsErr && allOutlets && Array.isArray(allOutlets)) {
        for (const out of allOutlets) {
          const s =
            out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
              ? (out.settings as Record<string, any>)
              : {};
          let shouldUpdate = false;
          const updatedRoster = Array.isArray(s.outlet_staff_roster) ? [...s.outlet_staff_roster] : [];
          const idx = updatedRoster.findIndex((e: any) => (e.id || e.user_id) === userId);
          if (idx >= 0) {
            updatedRoster[idx] = {
              ...updatedRoster[idx],
              name: data.full_name || updatedRoster[idx].name,
              full_name: data.full_name || updatedRoster[idx].full_name,
              role: data.role || updatedRoster[idx].role,
              outlet_id: data.outlet_id || updatedRoster[idx].outlet_id,
              job_title: data.job_title || updatedRoster[idx].job_title,
              phone: data.phone || updatedRoster[idx].phone,
              address: data.address || updatedRoster[idx].address,
              avatar_url:
                data.avatar_url !== undefined ? data.avatar_url : updatedRoster[idx].avatar_url,
              employment_status: data.employment_status || updatedRoster[idx].employment_status,
              base_salary: data.base_salary ?? updatedRoster[idx].base_salary,
              daily_allowance: data.daily_allowance ?? updatedRoster[idx].daily_allowance,
              late_deduction: data.late_deduction ?? updatedRoster[idx].late_deduction,
              absence_deduction: data.absence_deduction ?? updatedRoster[idx].absence_deduction,
              default_shift: data.default_shift || updatedRoster[idx].default_shift,
            };
            shouldUpdate = true;
          }

          const existingHR = s.hr_profiles && typeof s.hr_profiles === "object" ? s.hr_profiles : {};
          const updatedHR = {
            ...existingHR,
            [userId]: {
              ...(existingHR[userId] || {}),
              ...data,
              updated_at: nowIso,
            },
          };

          if (shouldUpdate || existingHR[userId] || !persistedToSupabase) {
            const { error: outUpdErr } = await supabase
              .from("outlets")
              .update({
                settings: {
                  ...s,
                  outlet_staff_roster: updatedRoster,
                  hr_profiles: updatedHR,
                },
              })
              .eq("id", out.id)
              .eq("business_id", businessId);
            if (!outUpdErr) {
              persistedToSupabase = true;
            }
          }
        }
      }
    }

    // 4. Update branch employees cache in localStorage
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_branch_employees");
        if (raw) {
          const map = JSON.parse(raw);
          if (map[userId]) {
            map[userId] = {
              ...map[userId],
              name: data.full_name || map[userId].name,
              role: data.role || map[userId].role,
              outlet_id: data.outlet_id || map[userId].outlet_id,
              avatar_url: data.avatar_url !== undefined ? data.avatar_url : map[userId].avatar_url,
            };
            localStorage.setItem("kebabschoicepos_branch_employees", JSON.stringify(map));
          }
        }
      } catch {}
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hr:profile-updated", { detail: { userId } }));
    }

    return persistedToSupabase;
  } catch (err) {
    console.error("[updateHRStaffProfile] Failed to persist staff profile:", err);
    return false;
  }
}

// -------------------------------------------------------------
// 2. WORK SHIFTS
// -------------------------------------------------------------

export async function getStaffShifts(outletId?: string): Promise<StaffShift[]> {
  try {
    // 1. Check outlets.settings.master_shifts in Supabase (scoped by business_id)
    const businessId = await resolveBusinessId();
    try {
      let query = supabase.from("outlets").select("id, settings");
      if (businessId) query = query.eq("business_id", businessId);
      if (outletId) query = query.eq("id", outletId);
      const { data: outRows } = await query;
      if (outRows && outRows.length > 0) {
        for (const out of outRows) {
          const s =
            out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
              ? (out.settings as Record<string, any>)
              : {};
          if (Array.isArray(s.master_shifts) && s.master_shifts.length > 0) {
            const needsMigration =
              s.master_shifts.length > 2 ||
              s.master_shifts.some(
                (ms: any) =>
                  String(ms.shift_name || "").toLowerCase().includes("siang") ||
                  ms.start_time === "08:00",
              );
            if (!needsMigration) {
              return s.master_shifts;
            }
          }
        }
      }
    } catch {
      // fallback
    }

    // 2. Check localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHIFTS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const needsMigration =
              parsed.length > 2 ||
              parsed.some(
                (ms: any) =>
                  String(ms.shift_name || "").toLowerCase().includes("siang") ||
                  ms.start_time === "08:00",
              );
            if (!needsMigration) {
              return parsed;
            }
          }
        } catch {}
      }
    }

    // Auto-migrate to 2 shifts
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_SHIFTS_KEY, JSON.stringify(DEFAULT_SHIFTS));
    }

    // Also persist to outlets.settings.master_shifts in background (scoped by business_id)
    try {
      if (businessId) {
        const { data: allOuts } = await supabase
          .from("outlets")
          .select("id, settings")
          .eq("business_id", businessId);
        if (allOuts && Array.isArray(allOuts)) {
          for (const out of allOuts) {
            const curr =
              out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
                ? (out.settings as Record<string, any>)
                : {};
            await supabase
              .from("outlets")
              .update({ settings: { ...curr, master_shifts: DEFAULT_SHIFTS } as any })
              .eq("id", out.id)
              .eq("business_id", businessId);
          }
        }
      }
    } catch {}

    return DEFAULT_SHIFTS;
  } catch (err) {
    console.error("[getStaffShifts] Error:", err);
    return DEFAULT_SHIFTS;
  }
}

export async function saveStaffShifts(shifts: StaffShift[]): Promise<boolean> {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_SHIFTS_KEY, JSON.stringify(shifts));
    }

    // Persist into outlets.settings.master_shifts via JSONB (strictly scoped by business_id)
    try {
      const businessId = await resolveBusinessId();
      if (businessId) {
        const { data: allOutlets } = await supabase
          .from("outlets")
          .select("id, settings")
          .eq("business_id", businessId);
        if (allOutlets && Array.isArray(allOutlets)) {
          for (const out of allOutlets) {
            const s =
              out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
                ? (out.settings as Record<string, any>)
                : {};
            await supabase
              .from("outlets")
              .update({
                settings: {
                  ...s,
                  master_shifts: shifts,
                } as any,
              })
              .eq("id", out.id)
              .eq("business_id", businessId);
          }
        }
      }
    } catch (dbErr) {
      console.warn("[saveStaffShifts] outlets.settings update warning:", dbErr);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hr:shifts-updated"));
    }

    return true;
  } catch (err) {
    console.error("[saveStaffShifts] Error:", err);
    return false;
  }
}

// -------------------------------------------------------------
// 3. FACE RECOGNITION ATTENDANCE
// -------------------------------------------------------------

/**
 * Evaluates attendance late status and computes minutes late against shift start and grace period.
 * Threshold is (shift_start + grace_period_minutes).
 * If check-in time exceeds the threshold, status is "late" and minutes late is computed.
 */
export function evaluateLateAttendance(
  checkInTimeStr: string,
  shiftStartTimeStr: string,
  gracePeriodMinutes: number = 15,
): {
  status: "on_time" | "late";
  lateMinutes: number;
  minutesPastGrace: number;
} {
  const [cHour = 0, cMin = 0] = checkInTimeStr.split(":").map(Number);
  const [sHour = 0, sMin = 0] = shiftStartTimeStr.split(":").map(Number);
  const checkInMins = cHour * 60 + cMin;
  const shiftMins = sHour * 60 + sMin;
  const thresholdMins = shiftMins + gracePeriodMinutes;

  if (checkInMins > thresholdMins) {
    return {
      status: "late",
      lateMinutes: checkInMins - shiftMins,
      minutesPastGrace: checkInMins - thresholdMins,
    };
  }

  return {
    status: "on_time",
    lateMinutes: 0,
    minutesPastGrace: 0,
  };
}

export function evaluateLateStatus(
  checkInTimeStr: string,
  shiftStartTimeStr: string,
  graceMinutes: number = 15,
): "on_time" | "late" {
  return evaluateLateAttendance(checkInTimeStr, shiftStartTimeStr, graceMinutes).status;
}

export interface RecordAttendanceInput {
  userId: string;
  staffName: string;
  outletId: string;
  outletName: string;
  type: "in" | "out";
  faceSnapshotUrl?: string | null;
  device?: string;
  notes?: string;
  checkTime?: Date;
}

export async function recordAttendance(input: RecordAttendanceInput): Promise<StaffAttendance> {
  const now = input.checkTime || new Date();
  // Use local Indonesian date (Asia/Jakarta / WIB) — NEVER now.toISOString().split("T")[0] (UTC),
  // which shifts 00:00-06:59 WIB morning check-ins back to yesterday's date!
  const dateStr = formatLocalDateWIB(now); // YYYY-MM-DD (WIB / Local)
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  // Evaluate status against shift
  let status: "on_time" | "late" | "early_leave" = "on_time";
  let lateMinutes = 0;
  let matchingShiftInfo: StaffShift | undefined = undefined;

  if (input.type === "in") {
    const shifts = await getStaffShifts(input.outletId);

    // 1. Check if today's roster specifies this staff's shift (Morning vs Night)
    try {
      const todayRoster = await getTodayOutletRoster(input.outletId, now);
      const staffNameLower = input.staffName.trim().toLowerCase();
      const isMorning = todayRoster.morningStaff.some(
        (n) => n.trim().toLowerCase() === staffNameLower,
      );
      const isNight = todayRoster.nightStaff.some(
        (n) => n.trim().toLowerCase() === staffNameLower,
      );

      if (isMorning) {
        matchingShiftInfo = shifts.find((s) => s.shift_name.toLowerCase().includes("pagi")) || {
          id: "shift-pagi",
          outlet_id: input.outletId,
          shift_name: "Shift Pagi",
          start_time: "08:00",
          end_time: "16:00",
          grace_period_minutes: 15,
          assigned_staff_ids: [],
        };
      } else if (isNight) {
        matchingShiftInfo = shifts.find((s) => s.shift_name.toLowerCase().includes("malam")) || {
          id: "shift-malam",
          outlet_id: input.outletId,
          shift_name: "Shift Malam",
          start_time: "16:00",
          end_time: "00:00",
          grace_period_minutes: 15,
          assigned_staff_ids: [],
        };
      }
    } catch {
      // ignore
    }

    // 2. Fallback to assigned shift or default shift
    if (!matchingShiftInfo) {
      matchingShiftInfo =
        shifts.find((s) => s.assigned_staff_ids.includes(input.userId)) || shifts[0];
    }

    if (matchingShiftInfo) {
      const evaluation = evaluateLateAttendance(
        timeFormatted,
        matchingShiftInfo.start_time,
        Number(matchingShiftInfo.grace_period_minutes) || 15,
      );
      status = evaluation.status;
      lateMinutes = evaluation.lateMinutes;
    }
  }

  const device =
    input.device ||
    (typeof navigator !== "undefined"
      ? `${navigator.userAgent.includes("Windows") ? "Windows PC" : navigator.userAgent.includes("Mac") ? "MacBook" : "Mobile Device"} · ${navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser"}`
      : "POS Terminal");

  const businessId = await resolveBusinessId();

  const shiftStartTime = matchingShiftInfo?.start_time || "08:00";
  const graceMinutes = matchingShiftInfo?.grace_period_minutes || 15;
  const notes =
    input.notes ||
    (status === "late"
      ? `Terlambat ${lateMinutes} menit (check-in ${timeFormatted}, shift ${shiftStartTime} + toleransi ${graceMinutes}m)`
      : `Hadir tepat waktu (${timeFormatted})`);

  const record: StaffAttendance = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    business_id: businessId,
    outlet_id: input.outletId,
    outlet_name: input.outletName,
    user_id: input.userId,
    staff_name: input.staffName,
    date: dateStr,
    check_in_time: input.type === "in" ? now.toISOString() : null,
    check_out_time: input.type === "out" ? now.toISOString() : null,
    type: input.type,
    status,
    late_minutes: lateMinutes,
    device,
    face_snapshot_url: input.faceSnapshotUrl || null,
    notes,
    created_at: now.toISOString(),
  };

  // 1. Try Supabase first (checking error & falling back to core schema columns if late_minutes is absent)
  if (businessId) {
    try {
      const safeOutletUuid = isValidUuid(input.outletId) ? input.outletId : null;
      let { data: insertedAtt, error: attErr } = await supabase
        .from("staff_attendances" as any)
        .insert({
          business_id: businessId,
          outlet_id: safeOutletUuid,
          user_id: input.userId,
          staff_name: input.staffName,
          date: dateStr,
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          type: record.type,
          status: record.status,
          late_minutes: record.late_minutes,
          device: record.device,
          face_snapshot_url: record.face_snapshot_url,
          notes: record.notes,
          created_at: record.created_at,
        })
        .select("id")
        .maybeSingle();

      if (attErr) {
        console.warn("[recordAttendance] Retrying staff_attendances insert with core schema columns:", attErr.message);
        const retryRes = await supabase
          .from("staff_attendances" as any)
          .insert({
            business_id: businessId,
            outlet_id: safeOutletUuid,
            user_id: input.userId,
            staff_name: input.staffName,
            date: dateStr,
            check_in_time: record.check_in_time,
            check_out_time: record.check_out_time,
            type: record.type,
            status: record.status,
            device: record.device,
            face_snapshot_url: record.face_snapshot_url,
            notes: record.notes,
            created_at: record.created_at,
          })
          .select("id")
          .maybeSingle();
        insertedAtt = retryRes.data;
        attErr = retryRes.error;
      }

      if (attErr) {
        console.error("[recordAttendance] Gagal menyimpan absensi ke Supabase staff_attendances:", attErr.message);
      } else if ((insertedAtt as any)?.id) {
        record.id = (insertedAtt as any).id;
      }
    } catch (err) {
      console.warn("[recordAttendance] Supabase sync warning:", err);
    }
  }

  // 2. Persist to localStorage cache (with authoritative DB id when available)
  if (typeof window !== "undefined") {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ATTENDANCES_KEY) || "[]");
    saved.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_ATTENDANCES_KEY, JSON.stringify(saved));
  }

  // 3. Dispatch global event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hr:attendance-recorded", { detail: record }));
  }

  return record;
}

export async function getAttendanceList(filter?: {
  date?: string;
  userId?: string;
  outletId?: string;
  month?: number;
  year?: number;
}): Promise<StaffAttendance[]> {
  let list: StaffAttendance[] = [];

  // 1. Try Supabase (strictly scoped by business_id)
  try {
    const businessId = await resolveBusinessId();
    if (businessId) {
      let query = supabase
        .from("staff_attendances" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (filter?.date) query = query.eq("date", filter.date);
      if (filter?.userId) query = query.eq("user_id", filter.userId);
      if (filter?.outletId && filter.outletId !== "all") query = query.eq("outlet_id", filter.outletId);

      const { data, error } = await query;
      if (!error && data && Array.isArray(data) && data.length > 0) {
      list = (data as any[]).map((d: any) => ({
        id: d.id,
        business_id: d.business_id,
        outlet_id: d.outlet_id,
        outlet_name: d.outlet_name || "Outlet Cabang",
        user_id: d.user_id,
        staff_name: d.staff_name,
        date: d.date,
        check_in_time: d.check_in_time,
        check_out_time: d.check_out_time,
        type: d.type || "in",
        status: d.status || "on_time",
        late_minutes: Number(d.late_minutes) || 0,
        device: d.device || "POS Device",
        face_snapshot_url: d.face_snapshot_url,
        notes: d.notes,
        created_at: d.created_at,
      }));
      }
    }
  } catch {
    // fallback
  }

  // 2. Fallback to localStorage and merge
  if (typeof window !== "undefined") {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ATTENDANCES_KEY) || "[]");
    if (Array.isArray(local) && local.length > 0) {
      const seenIds = new Set(list.map((item) => item.id));
      for (const item of local) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          list.push(item);
        }
      }
    }
  }

  // 3. Filter if needed
  if (filter?.month !== undefined || filter?.year !== undefined) {
    list = list.filter((item) => {
      const d = new Date(item.created_at);
      const matchMonth = filter.month === undefined || d.getMonth() + 1 === filter.month;
      const matchYear = filter.year === undefined || d.getFullYear() === filter.year;
      return matchMonth && matchYear;
    });
  }

  if (filter?.userId) {
    list = list.filter((i) => i.user_id === filter.userId);
  }
  if (filter?.outletId) {
    list = list.filter((i) => i.outlet_id === filter.outletId);
  }

  return list;
}

// -------------------------------------------------------------
// 4. PAYROLL LINKED WITH ATTENDANCE
// -------------------------------------------------------------

export interface PayrollCalculationResult {
  userId: string;
  staffName: string;
  outletName: string;
  outletId: string | null;
  periodMonth: number;
  periodYear: number;
  baseSalary: number;
  totalDaysPresent: number;
  totalTimesLate: number;
  totalDaysAbsent: number;
  dailyAllowance: number;
  allowanceAmount: number;
  lateDeduction: number;
  absenceDeduction: number;
  totalLateDeductions: number;
  totalAbsenceDeductions: number;
  totalDeductions: number;
  bonusAmount: number;
  netSalary: number;
}

/**
 * Calculates payroll for a staff member strictly based on attendance records
 * Example:
 * Base: Rp2.000.000
 * Present: 25 days
 * Late: 3 times (3 * Rp20.000 = Rp60.000)
 * Absent: 1 day (1 * Rp80.000 = Rp80.000)
 * Total deductions: Rp140.000
 * Allowance: 25 * Rp25.000 = Rp625.000
 * Net: Rp2.000.000 + Rp625.000 - Rp140.000 = Rp2.485.000
 */
export async function calculateStaffPayroll(
  userId: string,
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear(),
  bonusAmount: number = 0,
  preloadedData?: {
    profiles?: StaffProfile[];
    attendances?: StaffAttendance[];
    roster?: MonthlyRosterSchedule;
  },
): Promise<PayrollCalculationResult> {
  const profiles = preloadedData?.profiles || (await getHRStaffProfiles());
  const staff = profiles.find((p) => p.user_id === userId);

  const baseSalary = Number(staff?.base_salary) || 2000000;
  const dailyAllowance = Number(staff?.daily_allowance) || 25000;
  const lateDeduction = Number(staff?.late_deduction) || 20000;
  const absenceDeduction = Number(staff?.absence_deduction) || 80000;

  // Fetch attendances for this user and month
  const attendances = preloadedData?.attendances
    ? preloadedData.attendances.filter((a) => a.user_id === userId)
    : await getAttendanceList({ userId, month, year });
  const checkIns = attendances.filter((a) => a.type === "in");

  // Distinct days present
  const presentDays = new Set(checkIns.map((a) => a.date));
  const totalDaysPresent = presentDays.size;

  // Count late arrivals
  const totalTimesLate = checkIns.filter((a) => a.status === "late").length;

  // Standard working days in month (standard 26 days or derived from scheduled roster)
  let standardWorkingDays = 26;
  try {
    const roster =
      preloadedData?.roster ||
      (await getRosterSchedule(staff?.outlet_id || "all", month, year));
    if (roster && roster.weeks && roster.weeks.length > 0) {
      let scheduledWorkDays = 0;
      const staffNameLower = (staff?.full_name || "").toLowerCase();

      for (const week of roster.weeks) {
        for (const row of week.rows) {
          for (const [, cell] of Object.entries(row.days)) {
            if (
              cell.staffName &&
              cell.staffName.toLowerCase() === staffNameLower &&
              cell.status === "NORMAL" &&
              cell.shiftType !== "off"
            ) {
              scheduledWorkDays++;
            }
          }
        }
      }
      if (scheduledWorkDays > 0) {
        standardWorkingDays = scheduledWorkDays;
      }
    }
  } catch {
    // fallback to standard 26
  }

  const totalDaysAbsent = Math.max(0, standardWorkingDays - totalDaysPresent);

  const allowanceAmount = Math.round(totalDaysPresent * dailyAllowance);
  const totalLateDeductions = Math.round(totalTimesLate * lateDeduction);
  const totalAbsenceDeductions = Math.round(totalDaysAbsent * absenceDeduction);
  const totalDeductions = Math.round(totalLateDeductions + totalAbsenceDeductions);

  const safeBonus = Number(bonusAmount) || 0;
  const netSalary = Math.max(
    0,
    Math.round(baseSalary + allowanceAmount + safeBonus - totalDeductions),
  );

  return {
    userId,
    staffName: staff?.full_name || "Karyawan",
    outletName: staff?.outlet_name || "Semua Cabang",
    outletId: staff?.outlet_id || null,
    periodMonth: month,
    periodYear: year,
    baseSalary,
    totalDaysPresent,
    totalTimesLate,
    totalDaysAbsent,
    dailyAllowance,
    allowanceAmount,
    lateDeduction,
    absenceDeduction,
    totalLateDeductions,
    totalAbsenceDeductions,
    totalDeductions,
    bonusAmount: safeBonus,
    netSalary,
  };
}

export async function generateMonthlyPayrollList(
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear(),
  outletId?: string,
  explicitBusinessId?: string,
): Promise<StaffPayroll[]> {
  const businessId = await resolveBusinessId(explicitBusinessId);
  const [profiles, allAttendances] = await Promise.all([
    getHRStaffProfiles(businessId),
    getAttendanceList({ month, year, outletId }),
  ]);

  const targetProfiles =
    outletId && outletId !== "all"
      ? profiles.filter((p) => p.outlet_id === outletId)
      : profiles;

  // 1. Read authoritative payroll records from Supabase staff_payrolls table (strictly scoped by business_id)
  let dbPayrolls: StaffPayroll[] = [];
  if (businessId) {
    try {
      let pq = supabase
        .from("staff_payrolls" as any)
        .select("*")
        .eq("business_id", businessId)
        .eq("period_month", month)
        .eq("period_year", year);
      if (outletId && outletId !== "all" && isValidUuid(outletId)) {
        pq = pq.eq("outlet_id", outletId);
      }
      const { data, error } = await pq;
      if (!error && Array.isArray(data)) {
        dbPayrolls = data as unknown as StaffPayroll[];
      }
    } catch (err) {
      console.warn("[generateMonthlyPayrollList] staff_payrolls read warning:", err);
    }
  }

  // 2. Offline localStorage cache fallback
  const localSaved: StaffPayroll[] =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_PAYROLLS_KEY) || "[]")
      : [];

  const rosterCache = new Map<string, MonthlyRosterSchedule | null>();
  const payrolls: StaffPayroll[] = [];

  for (const staff of targetProfiles) {
    if (staff.role === "owner") continue; // Owners do not get staff payrolls

    const outletKey = staff.outlet_id || "all";
    if (!rosterCache.has(outletKey)) {
      try {
        const r = await getRosterSchedule(outletKey, month, year);
        rosterCache.set(outletKey, r);
      } catch {
        rosterCache.set(outletKey, null);
      }
    }
    const cachedRoster = rosterCache.get(outletKey) || undefined;

    const calc = await calculateStaffPayroll(staff.user_id, month, year, 0, {
      profiles,
      attendances: allAttendances,
      roster: cachedRoster,
    });

    const existingDb = dbPayrolls.find(
      (p) =>
        p.user_id === staff.user_id &&
        Number(p.period_month) === month &&
        Number(p.period_year) === year,
    );
    const existingLocal = localSaved.find(
      (p: StaffPayroll) =>
        p.user_id === staff.user_id && p.period_month === month && p.period_year === year,
    );
    const existing = existingDb || existingLocal;

    const bonus =
      Number(existing ? existing.bonus_amount : calc.totalDaysPresent >= 25 ? 150000 : 0) || 0;
    const netSalary = Math.max(
      0,
      Math.round(calc.baseSalary + calc.allowanceAmount + bonus - calc.totalDeductions),
    );

    const payrollItem: StaffPayroll = {
      id: existingDb?.id || existing?.id || `pr-${staff.user_id}-${month}-${year}`,
      business_id: businessId,
      outlet_id: staff.outlet_id,
      outlet_name: staff.outlet_name || "Semua Cabang (HQ)",
      user_id: staff.user_id,
      staff_name: staff.full_name,
      period_month: month,
      period_year: year,
      base_salary: calc.baseSalary,
      total_days_present: calc.totalDaysPresent,
      total_times_late: calc.totalTimesLate,
      total_days_absent: calc.totalDaysAbsent,
      allowance_amount: calc.allowanceAmount,
      deduction_amount: calc.totalDeductions,
      bonus_amount: bonus,
      net_salary: netSalary,
      status: (existing?.status as StaffPayroll["status"]) || "draft",
      payment_date: existing?.payment_date || null,
      notes: existing?.notes || `Gaji ${staff.full_name} periode ${month}/${year}`,
    };

    // 3. Persist / sync payroll row to Supabase staff_payrolls table so it syncs across devices & MoneyAllocationPage
    if (businessId) {
      try {
        const dbRowPayload = {
          business_id: businessId,
          outlet_id: isValidUuid(payrollItem.outlet_id) ? payrollItem.outlet_id : null,
          user_id: payrollItem.user_id,
          staff_name: payrollItem.staff_name,
          period_month: payrollItem.period_month,
          period_year: payrollItem.period_year,
          base_salary: payrollItem.base_salary,
          total_days_present: payrollItem.total_days_present,
          total_times_late: payrollItem.total_times_late,
          total_days_absent: payrollItem.total_days_absent,
          allowance_amount: payrollItem.allowance_amount,
          deduction_amount: payrollItem.deduction_amount,
          bonus_amount: payrollItem.bonus_amount,
          net_salary: payrollItem.net_salary,
          status: payrollItem.status,
          payment_date: payrollItem.payment_date,
          notes: payrollItem.notes,
          updated_at: new Date().toISOString(),
        };

        if (existingDb && isValidUuid(existingDb.id)) {
          await supabase
            .from("staff_payrolls" as any)
            .update(dbRowPayload)
            .eq("id", existingDb.id)
            .eq("business_id", businessId);
          payrollItem.id = existingDb.id;
        } else {
          const { data: insertedPr, error: insPrErr } = await supabase
            .from("staff_payrolls" as any)
            .insert({ ...dbRowPayload, created_at: new Date().toISOString() })
            .select("id")
            .maybeSingle();
          if (!insPrErr && (insertedPr as any)?.id) {
            payrollItem.id = (insertedPr as any).id;
          }
        }
      } catch (prSyncErr) {
        console.warn("[generateMonthlyPayrollList] staff_payrolls sync warning:", prSyncErr);
      }
    }

    payrolls.push(payrollItem);
  }

  // 4. Update offline cache in localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_PAYROLLS_KEY, JSON.stringify(payrolls));
  }

  return payrolls;
}

export async function updatePayrollStatus(
  payrollId: string,
  status: "draft" | "approved" | "paid",
  bonusAmount?: number,
): Promise<boolean> {
  const businessId = await resolveBusinessId();
  const nowIso = new Date().toISOString();
  let targetItem: StaffPayroll | null = null;

  if (typeof window !== "undefined") {
    const list: StaffPayroll[] = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_PAYROLLS_KEY) || "[]",
    );
    const idx = list.findIndex((p) => p.id === payrollId);
    if (idx !== -1 && list[idx]) {
      const item = list[idx]!;
      item.status = status;
      if (status === "paid") {
        item.payment_date = nowIso;
      }
      if (bonusAmount !== undefined) {
        const safeBonus = Number(bonusAmount) || 0;
        item.bonus_amount = safeBonus;
        item.net_salary = Math.max(
          0,
          Math.round(
            Number(item.base_salary || 0) +
              Number(item.allowance_amount || 0) +
              safeBonus -
              Number(item.deduction_amount || 0),
          ),
        );
      }
      targetItem = item;
      localStorage.setItem(LOCAL_STORAGE_PAYROLLS_KEY, JSON.stringify(list));
    }
  }

  // Persist status & bonus update directly to Supabase staff_payrolls table
  let persistedDb = false;
  if (businessId) {
    try {
      let existingDbRow: any = null;
      if (isValidUuid(payrollId)) {
        const { data } = await supabase
          .from("staff_payrolls" as any)
          .select("*")
          .eq("id", payrollId)
          .eq("business_id", businessId)
          .maybeSingle();
        existingDbRow = data;
      } else if (targetItem) {
        const { data } = await supabase
          .from("staff_payrolls" as any)
          .select("*")
          .eq("business_id", businessId)
          .eq("user_id", targetItem.user_id)
          .eq("period_month", targetItem.period_month)
          .eq("period_year", targetItem.period_year)
          .maybeSingle();
        existingDbRow = data;
      }

      const sourceRow = existingDbRow || targetItem;
      if (sourceRow) {
        const safeBonus =
          bonusAmount !== undefined
            ? Number(bonusAmount) || 0
            : Number(sourceRow.bonus_amount || 0);
        const computedNet = Math.max(
          0,
          Math.round(
            Number(sourceRow.base_salary || 0) +
              Number(sourceRow.allowance_amount || 0) +
              safeBonus -
              Number(sourceRow.deduction_amount || 0),
          ),
        );

        const updatePayload: Record<string, any> = {
          status,
          bonus_amount: safeBonus,
          net_salary: computedNet,
          updated_at: nowIso,
          ...(status === "paid" ? { payment_date: nowIso } : {}),
        };

        if (existingDbRow?.id) {
          const { error: updErr } = await supabase
            .from("staff_payrolls" as any)
            .update(updatePayload)
            .eq("id", existingDbRow.id)
            .eq("business_id", businessId);
          if (updErr) {
            console.error("[updatePayrollStatus] staff_payrolls update error:", updErr.message);
          } else {
            persistedDb = true;
          }
        } else if (targetItem) {
          const { data: inserted, error: insErr } = await supabase
            .from("staff_payrolls" as any)
            .insert({
              business_id: businessId,
              outlet_id: isValidUuid(targetItem.outlet_id) ? targetItem.outlet_id : null,
              user_id: targetItem.user_id,
              staff_name: targetItem.staff_name,
              period_month: targetItem.period_month,
              period_year: targetItem.period_year,
              base_salary: targetItem.base_salary,
              total_days_present: targetItem.total_days_present,
              total_times_late: targetItem.total_times_late,
              total_days_absent: targetItem.total_days_absent,
              allowance_amount: targetItem.allowance_amount,
              deduction_amount: targetItem.deduction_amount,
              bonus_amount: safeBonus,
              net_salary: computedNet,
              status,
              payment_date: status === "paid" ? nowIso : targetItem.payment_date,
              notes: targetItem.notes,
              created_at: nowIso,
              updated_at: nowIso,
            })
            .select("id")
            .maybeSingle();
          if (insErr) {
            console.error("[updatePayrollStatus] staff_payrolls insert error:", insErr.message);
          } else {
            persistedDb = true;
            if ((inserted as any)?.id && targetItem) {
              targetItem.id = (inserted as any).id;
            }
          }
        }
      }
    } catch (dbErr) {
      console.error("[updatePayrollStatus] Supabase error:", dbErr);
    }
  }

  if (typeof window !== "undefined" && targetItem) {
    window.dispatchEvent(new CustomEvent("hr:payroll-updated", { detail: targetItem }));
  }

  return persistedDb || Boolean(targetItem);
}

// -------------------------------------------------------------
// 6. WEEKLY ROSTER SCHEDULE ENGINE & PERSISTENCE
// -------------------------------------------------------------

/**
 * Builds 5 weekly ranges covering Monday to Sunday for the specified year & month.
 */
export function buildWeeksForMonth(year: number, month: number): WeeklyRosterWeek[] {
  const firstDate = new Date(year, month - 1, 1);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Find Monday of the week containing day 1
  const dayOfWeek = firstDate.getDay(); // 0 is Sun, 1 is Mon
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startMonday = new Date(year, month - 1, 1 + diffToMonday);

  const weeks: WeeklyRosterWeek[] = [];
  const current = new Date(startMonday);
  let weekNum = 1;

  while (weekNum <= 5) {
    const daysInWeek: {
      dateStr: string;
      dayName: string;
      dayNumber: number;
      dayLabel: string;
      isToday: boolean;
      isCurrentMonth: boolean;
    }[] = [];

    const weekStartY = current.getFullYear();
    const weekStartM = String(current.getMonth() + 1).padStart(2, "0");
    const weekStartD = String(current.getDate()).padStart(2, "0");
    const weekStartStr = `${weekStartY}-${weekStartM}-${weekStartD}`;

    for (let c = 0; c < 7; c++) {
      const y = current.getFullYear();
      const mNum = current.getMonth() + 1;
      const m = String(mNum).padStart(2, "0");
      const dNum = current.getDate();
      const d = String(dNum).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const isCurMonth = mNum === month && y === year;
      const isPastMonth = y < year || (y === year && mNum < month);
      const dayLabel = isCurMonth
        ? `${dNum} ${monthNames[mNum - 1]}`
        : `${dNum} ${monthNames[mNum - 1]} (Bln ${isPastMonth ? "Lalu" : "Depan"})`;

      daysInWeek.push({
        dateStr,
        dayName: dayNames[current.getDay()]!,
        dayNumber: dNum,
        dayLabel,
        isToday: dateStr === todayLocalStr,
        isCurrentMonth: isCurMonth,
      });

      current.setDate(current.getDate() + 1);
    }

    const weekEndStr = daysInWeek[6]!.dateStr;
    weeks.push({
      weekNumber: weekNum++,
      startDate: weekStartStr,
      endDate: weekEndStr,
      days: daysInWeek,
      rows: [],
    });
  }

  return weeks;
}

export interface RosterStaffInput {
  name: string;
  gender?: "male" | "female";
}

/**
 * Generates an automatic balanced rotation schedule for an outlet.
 * Uses weekly rolling day off algorithm (+1 day per week), anti-clopening penalty,
 * and smart female-in-morning shift balancing with 100% real staff.
 */
export function generateAutomaticRoster(
  outletId: string,
  outletName: string,
  month: number,
  year: number,
  staffInputs: (string | RosterStaffInput)[] = [],
): MonthlyRosterSchedule {
  const normalizedStaff: RosterStaffInput[] = (staffInputs || [])
    .map((s) => (typeof s === "string" ? { name: s.trim(), gender: "male" as const } : s))
    .filter((s) => s.name && s.name.trim().length > 0 && s.name !== "-");

  const weeks = buildWeeksForMonth(year, month);

  const defaultSlotTemplates = [
    { id: "slot-pagi-1", shiftType: "pagi" as const, label: "Shift Pagi #1 (07:00 - 16:00)" },
    { id: "slot-pagi-2", shiftType: "pagi" as const, label: "Shift Pagi #2 (07:00 - 16:00)" },
    { id: "slot-malam-1", shiftType: "malam" as const, label: "Shift Malam #1 (13:00 - 22:00)" },
    { id: "slot-malam-2", shiftType: "malam" as const, label: "Shift Malam #2 (13:00 - 22:00)" },
    { id: "slot-malam-3", shiftType: "malam" as const, label: "Shift Malam #3 (13:00 - 22:00)" },
    { id: "slot-malam-4", shiftType: "malam" as const, label: "Shift Malam #4 (13:00 - 22:00)" },
    { id: "slot-off-1", shiftType: "off" as const, label: "Libur (OFF)" },
  ];

  if (normalizedStaff.length > 7) {
    for (let extra = 8; extra <= normalizedStaff.length; extra++) {
      if (extra % 2 === 0) {
        defaultSlotTemplates.splice(defaultSlotTemplates.length - 1, 0, {
          id: `slot-malam-${extra - 3}`,
          shiftType: "malam" as const,
          label: `Shift Malam #${extra - 3} (13:00 - 22:00)`,
        });
      } else {
        defaultSlotTemplates.push({
          id: `slot-off-${extra - 6}`,
          shiftType: "off" as const,
          label: `Libur (OFF #${extra - 6})`,
        });
      }
    }
  }

  // Fair rotation tracking
  const pagiCount: Record<string, number> = {};
  const malamCount: Record<string, number> = {};
  const prevShift: Record<string, "pagi" | "malam" | "off"> = {};
  const genderMap: Record<string, "male" | "female"> = {};

  // Hydrate gender map from inputs, localStorage fallback if missing
  normalizedStaff.forEach((s) => {
    pagiCount[s.name] = 0;
    malamCount[s.name] = 0;
    prevShift[s.name] = "off";
    genderMap[s.name] = s.gender || "male";
  });

  if (typeof window !== "undefined") {
    try {
      const rawBranch = localStorage.getItem("kebabschoicepos_branch_employees");
      if (rawBranch) {
        const parsed = JSON.parse(rawBranch);
        if (Array.isArray(parsed)) {
          for (const b of parsed) {
            if (b.name && b.gender && genderMap[b.name]) {
              genderMap[b.name] = b.gender;
            }
          }
        }
      }
      const rawHr = localStorage.getItem("kebabschoicepos_hr_staff_profiles");
      if (rawHr) {
        const parsed = JSON.parse(rawHr);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p.full_name && p.gender && genderMap[p.full_name]) {
              genderMap[p.full_name] = p.gender;
            }
          }
        }
      }
    } catch {}
  }

  weeks.forEach((week, weekIdx) => {
    week.rows = defaultSlotTemplates.map((slot) => ({
      id: `${week.weekNumber}-${slot.id}`,
      shiftType: slot.shiftType,
      label: slot.label,
      days: {},
    }));

    // For each day (0 = Monday, ..., 6 = Sunday)
    week.days.forEach((day, dayIdx) => {
      // Days outside the target month: set to "-"
      if (!day.isCurrentMonth) {
        week.rows.forEach((row) => {
          row.days[day.dateStr] = {
            staffName: "-",
            status: "NORMAL",
            shiftType: row.shiftType,
          };
        });
        return;
      }

      if (normalizedStaff.length === 0) {
        week.rows.forEach((row) => {
          row.days[day.dateStr] = {
            staffName: "-",
            status: "NORMAL",
            shiftType: row.shiftType,
          };
        });
        return;
      }

      // Rolling Libur +1 Hari Tiap Ganti Minggu
      const offStaffIdx = (dayIdx - weekIdx + normalizedStaff.length * 10) % normalizedStaff.length;
      const offStaff = normalizedStaff[offStaffIdx] || normalizedStaff[0]!;

      // Working staff today
      const workingStaff = normalizedStaff.filter((s) => s.name !== offStaff.name);

      // Score morning candidates: (pagiCount * 100) + anti-clopening penalty (+60) + round-robin jitter
      const sortedForPagi = workingStaff.map((worker, idx) => {
        const currentPagi = pagiCount[worker.name] || 0;
        const penalty = prevShift[worker.name] === "malam" ? 60 : 0;
        const jitter = (dayIdx + idx) % 7;
        const score = currentPagi * 100 + penalty + jitter;
        return {
          worker,
          score,
          pagiCount: currentPagi,
          gender: genderMap[worker.name] || worker.gender || "male",
        };
      });

      sortedForPagi.sort((a, b) => a.score - b.score);

      // Top 2 candidates for pagi
      const pagiWorkers = sortedForPagi.slice(0, 2);

      // ATURAN WAJIB GENDER SHIFT PAGI:
      // If female staff exists among working staff, ensure at least one female is in pagiWorkers
      const hasFemaleWorking = workingStaff.some(
        (w) => (genderMap[w.name] || w.gender) === "female",
      );
      const isBothPagiMale = pagiWorkers.every((p) => p.gender !== "female");

      if (hasFemaleWorking && isBothPagiMale && pagiWorkers.length > 1) {
        const availableFemales = sortedForPagi
          .slice(2)
          .filter((sw) => sw.gender === "female");

        if (availableFemales.length > 0) {
          availableFemales.sort((a, b) => a.score - b.score);
          const bestFemale = availableFemales[0]!;
          // Swap second pagi worker with the best female candidate
          pagiWorkers[1] = bestFemale;
        }
      }

      const pagi1 = pagiWorkers[0]?.worker;
      const pagi2 = pagiWorkers[1]?.worker;
      const morningNames = new Set(pagiWorkers.map((pw) => pw.worker.name));

      // Staff remaining for night shift
      const nightWorkers = workingStaff.filter((w) => !morningNames.has(w.name));

      // Update counters & previous shift state
      if (pagi1) {
        pagiCount[pagi1.name] = (pagiCount[pagi1.name] || 0) + 1;
        prevShift[pagi1.name] = "pagi";
      }
      if (pagi2) {
        pagiCount[pagi2.name] = (pagiCount[pagi2.name] || 0) + 1;
        prevShift[pagi2.name] = "pagi";
      }
      nightWorkers.forEach((nw) => {
        malamCount[nw.name] = (malamCount[nw.name] || 0) + 1;
        prevShift[nw.name] = "malam";
      });
      prevShift[offStaff.name] = "off";
      let morningIdx = 0;
      let nightIdx = 0;
      let offSlotPointer = 0;

      week.rows.forEach((row) => {
        if (row.shiftType === "off") {
          const currentOffIdx = (offStaffIdx + offSlotPointer) % normalizedStaff.length;
          const assignedOffStaff = normalizedStaff[currentOffIdx] || offStaff;
          offSlotPointer++;
          row.days[day.dateStr] = {
            staffName: assignedOffStaff.name,
            status: "OFF",
            shiftType: "off",
            note: "Jadwal Libur Mingguan",
          };
        } else if (row.shiftType === "pagi") {
          const assigned = morningIdx === 0 ? pagi1 : pagi2;
          morningIdx++;
          row.days[day.dateStr] = {
            staffName: assigned?.name || "Staff",
            status: "NORMAL",
            shiftType: "pagi",
          };
        } else {
          const assigned = nightWorkers[nightIdx % Math.max(1, nightWorkers.length)];
          nightIdx++;
          row.days[day.dateStr] = {
            staffName: assigned?.name || "Staff",
            status: "NORMAL",
            shiftType: "malam",
          };
        }
      });
    });
  });

  return {
    outletId: outletId || "all",
    outletName: outletName || "Semua Cabang (HQ)",
    month,
    year,
    weeks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Retrieves the saved roster schedule for an outlet & month, or auto-generates if none exists.
 * Synchronizes with Supabase outlets.settings.roster_schedules to ensure multi-device sync.
 */
export async function getRosterSchedule(
  outletId: string,
  month: number,
  year: number,
  defaultStaffNames?: string[],
): Promise<MonthlyRosterSchedule> {
  const storeKey = `${outletId || "all"}_${year}_${month}`;
  const allKey = `all_${year}_${month}`;

  // 1. Try reading from Supabase first for multi-device sync
  try {
    let targetOutletQuery = supabase.from("outlets").select("id, settings");
    if (outletId && outletId !== "all") {
      targetOutletQuery = targetOutletQuery.eq("id", outletId);
    }
    const { data: outletsData } = await targetOutletQuery;
    for (const outRow of outletsData || []) {
      const rosterSchedules = (outRow.settings as any)?.roster_schedules;
      if (rosterSchedules) {
        const cloudSchedule =
          rosterSchedules[storeKey] || (outletId !== "all" ? rosterSchedules[allKey] : null);
        if (cloudSchedule) {
          if (typeof window !== "undefined") {
            try {
              const allSchedules = JSON.parse(
                localStorage.getItem(LOCAL_STORAGE_ROSTER_SCHEDULES_KEY) || "{}",
              );
              allSchedules[storeKey] = cloudSchedule;
              localStorage.setItem(LOCAL_STORAGE_ROSTER_SCHEDULES_KEY, JSON.stringify(allSchedules));
            } catch {}
          }
          return cloudSchedule;
        }
      }
    }
  } catch (sbReadErr) {
    console.warn("[getRosterSchedule] Supabase read error:", sbReadErr);
  }

  // 2. Fallback to localStorage
  if (typeof window !== "undefined") {
    try {
      const allSchedules = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_ROSTER_SCHEDULES_KEY) || "{}",
      );
      if (allSchedules[storeKey]) {
        return allSchedules[storeKey];
      }
      if (outletId !== "all" && allSchedules[allKey]) {
        return allSchedules[allKey];
      }
    } catch {
      // ignore
    }
  }

  // 3. Resolve real staff names from database
  let staffNames = defaultStaffNames;
  if (!staffNames || staffNames.length === 0) {
    try {
      const rawStaff = await getStaffList();
      const activeStaff = rawStaff.filter(
        (s) => s.status !== "inactive" && s.name && s.name.trim().length > 0,
      );
      if (outletId && outletId !== "all") {
        const branchStaff = activeStaff.filter((s) => s.outlet_id === outletId);
        if (branchStaff.length > 0) {
          staffNames = branchStaff.map((s) => s.name.trim());
        }
      }
      if (!staffNames || staffNames.length === 0) {
        if (activeStaff.length > 0) {
          staffNames = activeStaff.map((s) => s.name.trim());
        }
      }
    } catch {
      // ignore
    }
  }

  if (!staffNames || staffNames.length === 0) {
    try {
      const profiles = await getHRStaffProfiles();
      const filtered =
        outletId && outletId !== "all"
          ? profiles.filter((p) => p.outlet_id === outletId)
          : profiles;
      if (filtered.length > 0) {
        staffNames = filtered.map((p) => p.full_name);
      }
    } catch {
      // ignore
    }
  }

  const generated = generateAutomaticRoster(outletId, "Outlet Cabang", month, year, staffNames);
  await saveRosterSchedule(generated);
  return generated;
}

/**
 * Saves a roster schedule to localStorage, dispatches global event, and synchronizes with Supabase.
 */
export async function saveRosterSchedule(schedule: MonthlyRosterSchedule): Promise<void> {
  const storeKey = `${schedule.outletId || "all"}_${schedule.year}_${schedule.month}`;
  const nowIso = new Date().toISOString();
  const scheduleToSave = {
    ...schedule,
    updatedAt: nowIso,
  };

  if (typeof window !== "undefined") {
    try {
      const allSchedules = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_ROSTER_SCHEDULES_KEY) || "{}",
      );
      allSchedules[storeKey] = scheduleToSave;
      localStorage.setItem(LOCAL_STORAGE_ROSTER_SCHEDULES_KEY, JSON.stringify(allSchedules));
      window.dispatchEvent(new CustomEvent("hr:roster-updated", { detail: scheduleToSave }));
    } catch (err) {
      console.warn("[saveRosterSchedule] localStorage error:", err);
    }
  }

  // Synchronize with Supabase outlets.settings.roster_schedules
  try {
    let targetOutletQuery = supabase.from("outlets").select("id, settings");
    if (schedule.outletId && schedule.outletId !== "all") {
      targetOutletQuery = targetOutletQuery.eq("id", schedule.outletId);
    }
    const { data: targetOutlets } = await targetOutletQuery;
    if (targetOutlets && targetOutlets.length > 0) {
      for (const outletToUpdate of targetOutlets) {
        const curSettings = (outletToUpdate.settings as any) || {};
        const curRosters = curSettings.roster_schedules || {};
        const updatedSettings = {
          ...curSettings,
          roster_schedules: {
            ...curRosters,
            [storeKey]: scheduleToSave,
            [`${outletToUpdate.id}_${schedule.year}_${schedule.month}`]: scheduleToSave,
          },
        };
        await supabase
          .from("outlets")
          .update({ settings: updatedSettings, updated_at: nowIso })
          .eq("id", outletToUpdate.id);
      }
    }
  } catch (sbErr) {
    console.warn("[saveRosterSchedule] Supabase sync warning:", sbErr);
  }
}

/**
 * Returns today's roster breakdown (Morning, Night, Off/Leave) for a specific outlet.
 */
export async function getTodayOutletRoster(
  outletId?: string | null,
  date: Date = new Date(),
): Promise<{
  morningStaff: string[];
  nightStaff: string[];
  offOrLeaveStaff: { name: string; status: "OFF" | "SAKIT" | "IZIN"; note?: string }[];
}> {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const padM = String(month).padStart(2, "0");
  const padD = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${padM}-${padD}`;

  const morningStaff: string[] = [];
  const nightStaff: string[] = [];
  const offOrLeaveStaff: { name: string; status: "OFF" | "SAKIT" | "IZIN"; note?: string }[] = [];

  try {
    const schedule = await getRosterSchedule(outletId || "all", month, year);
    if (schedule && schedule.weeks) {
      for (const week of schedule.weeks) {
        for (const row of week.rows) {
          const cell = row.days[dateStr];
          if (!cell || !cell.staffName) continue;

          if (
            cell.shiftType === "off" ||
            cell.status === "OFF" ||
            cell.status === "SAKIT" ||
            cell.status === "IZIN"
          ) {
            offOrLeaveStaff.push({
              name: cell.staffName,
              status: (cell.status as any) || "OFF",
              note: cell.note,
            });
          } else if (cell.shiftType === "pagi") {
            if (!morningStaff.includes(cell.staffName)) {
              morningStaff.push(cell.staffName);
            }
          } else if (cell.shiftType === "malam") {
            if (!nightStaff.includes(cell.staffName)) {
              nightStaff.push(cell.staffName);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[getTodayOutletRoster] Error reading roster:", err);
  }

  // Fallback defaults so POS is never empty, utilizing real staff when available
  if (morningStaff.length === 0 && nightStaff.length === 0) {
    try {
      const rawStaff = await getStaffList();
      const active = rawStaff.filter(
        (s) => s.status !== "inactive" && s.name && s.name.trim().length > 0,
      );
      const branch =
        outletId && outletId !== "all" ? active.filter((s) => s.outlet_id === outletId) : active;
      const chosen = branch.length > 0 ? branch : active;
      if (chosen.length > 0) {
        const names = chosen.map((s) => s.name.trim());
        const morning = names.slice(0, Math.ceil(names.length / 2));
        const night = names.slice(Math.ceil(names.length / 2));
        morningStaff.push(...morning);
        nightStaff.push(...(night.length > 0 ? night : morning));
      }
    } catch {}
  }

  return { morningStaff, nightStaff, offOrLeaveStaff };
}
