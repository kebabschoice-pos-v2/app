import { supabase } from "@/integrations/supabase/client";

export interface ManagerPermissions {
  can_manage_inventory: boolean; // Default: true
  can_manage_staff_shift: boolean; // Default: true
  can_view_branch_reports: boolean; // Default: true
  can_spend_ingredient_pockets: boolean; // Default: true
  can_edit_menu_recipes: boolean; // Default: false
  can_view_owner_net_profit: boolean; // Default: false
  branch_scope?: "single" | "all"; // Default: "single"
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  can_manage_inventory: true,
  can_manage_staff_shift: true,
  can_view_branch_reports: true,
  can_spend_ingredient_pockets: true,
  can_edit_menu_recipes: false,
  can_view_owner_net_profit: false,
  branch_scope: "single",
};

const STORAGE_KEY = "kebabschoicepos_manager_permissions";

async function resolvePermissionsBusinessId(explicitBusinessId?: string): Promise<string | undefined> {
  if (explicitBusinessId) return explicitBusinessId;
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("kebabschoicepos_active_business_id");
    if (cached) return cached;
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) return undefined;
    const { data: owned } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", uid)
      .order("created_at", { ascending: true })
      .limit(1);
    if (owned?.[0]?.id) return owned[0].id;

    const { data: member } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", uid)
      .limit(1);
    if (member?.[0]?.business_id) return member[0].business_id;
  } catch {}
  return undefined;
}

export function normalizeManagerPermissions(raw: unknown): ManagerPermissions {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...DEFAULT_MANAGER_PERMISSIONS, ...(raw as Partial<ManagerPermissions>) };
  }
  if (Array.isArray(raw)) {
    return {
      ...DEFAULT_MANAGER_PERMISSIONS,
      can_manage_inventory: raw.includes("inventory"),
      can_view_branch_reports: raw.includes("reports"),
      can_manage_staff_shift: raw.includes("staff_schedule") || raw.includes("payroll"),
      can_spend_ingredient_pockets: raw.includes("money_allocation") || raw.includes("inventory"),
      can_edit_menu_recipes: raw.includes("menu"),
    };
  }
  return { ...DEFAULT_MANAGER_PERMISSIONS };
}

export function getCachedManagerPermissions(): ManagerPermissions {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeManagerPermissions(JSON.parse(stored));
      }
    } catch {}
  }
  return { ...DEFAULT_MANAGER_PERMISSIONS };
}

export async function getManagerPermissions(
  businessId?: string,
  outletId?: string,
): Promise<ManagerPermissions> {
  const resolvedBizId = await resolvePermissionsBusinessId(businessId);

  // 1. Fetch authoritative permissions from Supabase outlets.settings (business-scoped)
  //    so Owner ON/OFF toggles apply immediately on Manager sessions across devices.
  try {
    if ((outletId && outletId !== "all") || resolvedBizId) {
      let query = supabase.from("outlets").select("id, settings");
      if (outletId && outletId !== "all") {
        query = query.eq("id", outletId);
        if (resolvedBizId) query = query.eq("business_id", resolvedBizId);
      } else if (resolvedBizId) {
        query = query.eq("business_id", resolvedBizId);
      }
      const { data: rows } = await query.order("created_at", { ascending: true }).limit(1);
      const firstRow = rows?.[0];

      if (firstRow?.settings && typeof firstRow.settings === "object") {
        const s = firstRow.settings as any;
        if (s.manager_permissions && typeof s.manager_permissions === "object") {
          const perms = normalizeManagerPermissions(s.manager_permissions);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
            } catch {}
          }
          return perms;
        }
      }
    }
  } catch (err) {
    console.warn("[manager-permissions] Error fetching permissions:", err);
  }

  // 2. Fallback to localStorage cache (offline or before first save)
  return getCachedManagerPermissions();
}

export async function saveManagerPermissions(
  permissions: ManagerPermissions,
  businessId?: string,
  outletId?: string,
): Promise<void> {
  const merged = { ...DEFAULT_MANAGER_PERMISSIONS, ...permissions };
  const resolvedBizId = await resolvePermissionsBusinessId(businessId);

  // 1. Save to local storage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("permissions:updated", { detail: merged }));
    } catch {}
  }

  // 2. Persist to Supabase outlets (strictly business-scoped)
  try {
    if ((!outletId || outletId === "all") && !resolvedBizId) {
      console.warn("[manager-permissions] Skipped unscoped outlets update (missing businessId)");
      return;
    }

    let query = supabase.from("outlets").select("id, settings");
    if (outletId && outletId !== "all") {
      query = query.eq("id", outletId);
      if (resolvedBizId) query = query.eq("business_id", resolvedBizId);
    } else if (resolvedBizId) {
      query = query.eq("business_id", resolvedBizId);
    }

    const { data: outlets } = await query;
    if (outlets && outlets.length > 0) {
      for (const out of outlets) {
        const currSettings = (out.settings as any) || {};
        await supabase
          .from("outlets")
          .update({
            settings: {
              ...currSettings,
              manager_permissions: merged,
            },
          })
          .eq("id", out.id);
      }
    }
  } catch (err) {
    console.warn("[manager-permissions] Error persisting to Supabase:", err);
  }
}
