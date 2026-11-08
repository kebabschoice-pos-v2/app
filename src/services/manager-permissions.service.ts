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

export async function getManagerPermissions(
  businessId?: string,
  outletId?: string,
): Promise<ManagerPermissions> {
  // 1. Check local storage cache first
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { ...DEFAULT_MANAGER_PERMISSIONS, ...parsed };
        }
        // Backward compatibility for array format
        if (Array.isArray(parsed)) {
          return {
            ...DEFAULT_MANAGER_PERMISSIONS,
            can_manage_inventory: parsed.includes("inventory"),
            can_view_branch_reports: parsed.includes("reports"),
            can_manage_staff_shift: parsed.includes("staff_schedule"),
            can_edit_menu_recipes: parsed.includes("menu"),
          };
        }
      }
    } catch {}
  }

  // 2. Fetch from Supabase outlets.settings
  try {
    let query = supabase.from("outlets").select("id, settings");
    if (outletId && outletId !== "all") {
      query = query.eq("id", outletId);
    } else if (businessId) {
      query = query.eq("business_id", businessId);
    }
    const { data } = await query.limit(1).maybeSingle();

    if (data?.settings && typeof data.settings === "object") {
      const s = data.settings as any;
      if (s.manager_permissions && typeof s.manager_permissions === "object") {
        const perms = { ...DEFAULT_MANAGER_PERMISSIONS, ...s.manager_permissions };
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
          } catch {}
        }
        return perms;
      }
    }
  } catch (err) {
    console.warn("[manager-permissions] Error fetching permissions:", err);
  }

  return DEFAULT_MANAGER_PERMISSIONS;
}

export async function saveManagerPermissions(
  permissions: ManagerPermissions,
  businessId?: string,
  outletId?: string,
): Promise<void> {
  const merged = { ...DEFAULT_MANAGER_PERMISSIONS, ...permissions };

  // 1. Save to local storage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("permissions:updated", { detail: merged }));
    } catch {}
  }

  // 2. Persist to Supabase outlets
  try {
    let query = supabase.from("outlets").select("id, settings");
    if (outletId && outletId !== "all") {
      query = query.eq("id", outletId);
    } else if (businessId) {
      query = query.eq("business_id", businessId);
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
