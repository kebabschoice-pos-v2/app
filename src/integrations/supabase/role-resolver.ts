import { supabase } from "@/integrations/supabase/client";

export type LoginType = "hq" | "pos";
export type AppRole = "owner" | "admin" | "manager" | "cashier" | "staff" | null;

export async function getUserRole(userId: string): Promise<AppRole> {
  const { data: member } = await supabase
    .from("business_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role) return String(member.role).toLowerCase() as AppRole;

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return userRole?.role ? (String(userRole.role).toLowerCase() as AppRole) : null;
}

export function resolveAccessLevel(role: string | null | undefined, loginType: LoginType) {
  const normalizedRole = (role ?? "").toLowerCase();

  const hqRoles = ["owner", "admin"];
  const posRoles = ["cashier", "staff", "manager"];

  if (loginType === "hq") {
    if (hqRoles.includes(normalizedRole)) {
      return { allowed: true, targetRoute: "/dashboard" };
    }

    if (posRoles.includes(normalizedRole)) {
      return {
        allowed: false,
        targetRoute: "/pos",
        errorMessage: "Akun ini hanya memiliki akses POS",
      };
    }

    return { allowed: false, targetRoute: "", errorMessage: "Akses tidak sesuai" };
  }

  if (posRoles.includes(normalizedRole)) {
    return { allowed: true, targetRoute: "/pos" };
  }

  if (hqRoles.includes(normalizedRole)) {
    return {
      allowed: false,
      targetRoute: "/dashboard",
      errorMessage: "Akun ini memiliki akses HQ",
    };
  }

  return { allowed: false, targetRoute: "", errorMessage: "Akses tidak sesuai" };
}

export function isHQRole(role: string | null | undefined) {
  return ["owner", "admin"].includes((role ?? "").toLowerCase());
}

export function isPOSRole(role: string | null | undefined) {
  return ["cashier", "staff", "manager"].includes((role ?? "").toLowerCase());
}
