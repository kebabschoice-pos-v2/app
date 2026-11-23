import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_MANAGER_PERMISSIONS,
  getManagerPermissions,
  type ManagerPermissions,
} from "@/services/manager-permissions.service";

export type LoginType = "hq" | "pos";
export type AppRole = "owner" | "admin" | "manager" | "cashier" | "staff" | "pos" | null;

export type HQRouteKey =
  | "dashboard"
  | "orders"
  | "analytics"
  | "performance-outlet"
  | "performance-menu"
  | "insight-analytics"
  | "customers"
  | "money-allocation"
  | "inventory"
  | "purchase-orders"
  | "stock-opname"
  | "stock-transfer"
  | "suppliers"
  | "waste"
  | "menu"
  | "staff"
  | "outlets"
  | "business-profile"
  | "receipt-settings"
  | "printer-settings"
  | "tax"
  | "payment"
  | "integration"
  | "security";

const OWNER_ADMIN_ROLES = ["owner", "admin"];
const HQ_ROLES = ["owner", "admin", "manager"];
const POS_ROLES = ["cashier", "staff", "pos", "manager"];
const STRICT_POS_ONLY_ROLES = ["cashier", "staff", "pos"];

/**
 * Resolves the authenticated user's role safely using `.limit(1)` (never `.maybeSingle()`,
 * which errors with PGRST116 when a user has multi-business memberships).
 */
export async function getUserRole(userId: string): Promise<AppRole> {
  const activeBusinessId =
    typeof window !== "undefined"
      ? localStorage.getItem("kebabschoicepos_active_business_id")
      : null;

  if (activeBusinessId) {
    const { data: scopedMembers } = await supabase
      .from("business_members")
      .select("role")
      .eq("user_id", userId)
      .eq("business_id", activeBusinessId)
      .limit(1);

    const scopedRole = scopedMembers?.[0]?.role;
    if (scopedRole) return String(scopedRole).toLowerCase() as AppRole;
  }

  const { data: members } = await supabase
    .from("business_members")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const memberRole = members?.[0]?.role;
  if (memberRole) return String(memberRole).toLowerCase() as AppRole;

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const fallbackRole = userRoles?.[0]?.role;
  if (fallbackRole) return String(fallbackRole).toLowerCase() as AppRole;

  // Direct business ownership fallback
  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  if (ownedBusinesses && ownedBusinesses.length > 0) {
    return "owner";
  }

  // Outlet device account fallback (outlets.settings.outlet_login_email / outlet_login_account)
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userEmailLower = authData?.user?.email?.trim().toLowerCase() || "";
    const { data: outletRows } = await supabase
      .from("outlets")
      .select("id, settings")
      .limit(50);

    if (outletRows && outletRows.length > 0) {
      const matchedOutlet = outletRows.find((o: any) => {
        const s = o?.settings;
        if (!s || typeof s !== "object") return false;
        if (
          userEmailLower &&
          s.outlet_login_email &&
          String(s.outlet_login_email).trim().toLowerCase() === userEmailLower
        ) {
          return true;
        }
        if (
          userEmailLower &&
          s.outlet_login_account?.email &&
          String(s.outlet_login_account.email).trim().toLowerCase() === userEmailLower
        ) {
          return true;
        }
        if (userId && s.outlet_login_account?.user_id === userId) {
          return true;
        }
        return false;
      });
      if (matchedOutlet) {
        return "cashier";
      }
    }
  } catch {}

  return null;
}

/**
 * True for Owner & Admin (unrestricted HQ + system/business settings).
 */
export function isOwnerOrAdminRole(role: string | null | undefined): boolean {
  return OWNER_ADMIN_ROLES.includes((role ?? "").toLowerCase());
}

/**
 * True for roles allowed to enter HQ modules: owner, admin, and manager
 * (manager route access is further gated by manager-permissions.service.ts toggles).
 * Cashier / pos / staff are strictly excluded.
 */
export function isHQRole(role: string | null | undefined): boolean {
  return HQ_ROLES.includes((role ?? "").toLowerCase());
}

/**
 * True for roles allowed to operate POS terminals (cashier, staff, pos, manager).
 */
export function isPOSRole(role: string | null | undefined): boolean {
  return POS_ROLES.includes((role ?? "").toLowerCase());
}

/**
 * True for roles strictly confined to POS (never allowed into HQ modules).
 */
export function isStrictPOSOnlyRole(role: string | null | undefined): boolean {
  return STRICT_POS_ONLY_ROLES.includes((role ?? "").toLowerCase());
}

/**
 * Maps every HQ route to the ManagerPermissions toggle controlled by Owner in
 * `/staff` -> Tab "Hak Akses Manager".
 */
export function canManagerAccessHQRoute(
  routeKey: HQRouteKey | string,
  permissions: ManagerPermissions = DEFAULT_MANAGER_PERMISSIONS,
): boolean {
  switch (routeKey) {
    // Owner/Admin-only business & system configuration pages
    case "business-profile":
    case "receipt-settings":
    case "printer-settings":
    case "tax":
    case "payment":
    case "integration":
    case "outlets":
    case "security":
      return false;

    // Inventory & procurement modules
    case "inventory":
    case "purchase-orders":
    case "stock-opname":
    case "stock-transfer":
    case "suppliers":
    case "waste":
      return permissions.can_manage_inventory === true;

    // Staff, attendance & shift management
    case "staff":
      return permissions.can_manage_staff_shift === true;

    // Branch reports, orders & analytics
    case "dashboard":
    case "orders":
    case "analytics":
    case "performance-outlet":
    case "performance-menu":
    case "insight-analytics":
    case "customers":
      return permissions.can_view_branch_reports === true;

    // Money Allocation / Ingredient Pockets
    case "money-allocation":
      return (
        permissions.can_spend_ingredient_pockets === true ||
        permissions.can_view_owner_net_profit === true
      );

    // Menu & Recipe BOM management
    case "menu":
      return permissions.can_edit_menu_recipes === true;

    default:
      return false;
  }
}

/**
 * Evaluates whether a given role + manager permissions can access a specific HQ route.
 */
export function canRoleAccessHQRoute(
  role: string | null | undefined,
  routeKey: HQRouteKey | string,
  permissions: ManagerPermissions = DEFAULT_MANAGER_PERMISSIONS,
): boolean {
  const normalized = (role ?? "").toLowerCase();
  if (OWNER_ADMIN_ROLES.includes(normalized)) return true;
  if (normalized === "manager") return canManagerAccessHQRoute(routeKey, permissions);
  return false;
}

/**
 * Returns the first HQ route a manager is allowed to open based on active toggles,
 * falling back to `/pos` if all HQ toggles are turned OFF.
 */
export function getDefaultManagerHQRoute(
  permissions: ManagerPermissions = DEFAULT_MANAGER_PERMISSIONS,
): string {
  if (permissions.can_view_branch_reports) return "/dashboard";
  if (permissions.can_manage_inventory) return "/inventory";
  if (permissions.can_manage_staff_shift) return "/staff";
  if (permissions.can_spend_ingredient_pockets || permissions.can_view_owner_net_profit) {
    return "/money-allocation";
  }
  if (permissions.can_edit_menu_recipes) return "/menu";
  return "/pos";
}

export function resolveAccessLevel(role: string | null | undefined, loginType: LoginType) {
  const normalizedRole = (role ?? "").toLowerCase();

  if (loginType === "hq") {
    if (HQ_ROLES.includes(normalizedRole)) {
      return { allowed: true, targetRoute: "/dashboard" };
    }

    if (STRICT_POS_ONLY_ROLES.includes(normalizedRole)) {
      return {
        allowed: false,
        targetRoute: "/pos",
        errorMessage: "Akun ini hanya memiliki akses POS",
      };
    }

    return { allowed: false, targetRoute: "", errorMessage: "Akses tidak sesuai" };
  }

  // loginType === "pos"
  if (POS_ROLES.includes(normalizedRole)) {
    return { allowed: true, targetRoute: "/pos" };
  }

  if (OWNER_ADMIN_ROLES.includes(normalizedRole)) {
    return {
      allowed: false,
      targetRoute: "/dashboard",
      errorMessage: "Akun ini memiliki akses HQ",
    };
  }

  return { allowed: false, targetRoute: "", errorMessage: "Akses tidak sesuai" };
}

/**
 * Unified async route guard for TanStack Router HQ `beforeLoad` hooks.
 * - Owner / Admin: always allowed
 * - Manager: allowed when the corresponding `manager-permissions.service.ts` toggle is ON
 * - Cashier / Staff / POS: strictly blocked and redirected to `/pos`
 */
export async function checkHQRouteAccess(routeKey: HQRouteKey): Promise<{
  allowed: boolean;
  role: AppRole;
  redirectTo: string;
}> {
  if (typeof window === "undefined") {
    return { allowed: true, role: null, redirectTo: "/pos" };
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return { allowed: false, role: null, redirectTo: "/auth" };
  }

  const role = await getUserRole(user.id);
  if (!isHQRole(role)) {
    return {
      allowed: false,
      role,
      redirectTo: isPOSRole(role) ? "/pos" : "/auth",
    };
  }

  if (isOwnerOrAdminRole(role)) {
    return { allowed: true, role, redirectTo: "/dashboard" };
  }

  // Manager: enforce live Owner toggle permissions
  const activeBusinessId = localStorage.getItem("kebabschoicepos_active_business_id") || undefined;
  const activeOutletId =
    localStorage.getItem("kebabschoicepos_active_outlet_id") ||
    localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
    undefined;
  const perms = await getManagerPermissions(activeBusinessId, activeOutletId);

  if (canManagerAccessHQRoute(routeKey, perms)) {
    return { allowed: true, role, redirectTo: "/dashboard" };
  }

  return {
    allowed: false,
    role,
    redirectTo: getDefaultManagerHQRoute(perms),
  };
}
