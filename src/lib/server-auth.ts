import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Central server-side authorization helpers.
 *
 * Every API route that touches tenant data must go through these helpers so that:
 *  - the caller presents a real Supabase JWT (no "any header means valid" shortcuts),
 *  - the requested business_id actually belongs to the caller (owner or business member),
 *  - the requested outlet_id belongs to one of the caller's businesses.
 */

export interface ServerUser {
  id: string;
  email?: string | null;
}

export type AuthResult<T> = ({ ok: true } & T) | { ok: false; error: string; status: number };

export type BusinessRole = "owner" | "admin" | "manager" | "cashier" | "staff";

const ROLE_RANK: Record<BusinessRole, number> = {
  owner: 40,
  admin: 30,
  manager: 20,
  cashier: 10,
  staff: 0,
};

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Verifies the caller's Supabase JWT. Rejects missing/expired/forged tokens.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthResult<{ user: ServerUser }>> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, error: "Authorization token missing", status: 401 };
  }

  const env = getSupabaseEnv();
  if (!env) {
    return { ok: false, error: "Supabase configuration missing", status: 500 };
  }

  const authClient = createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false, error: "Session tidak valid", status: 401 };
  }

  return {
    ok: true,
    user: { id: authData.user.id, email: authData.user.email ?? null },
  };
}

/**
 * Collects every business the user owns or is a member of.
 */
export async function resolveUserBusinessIds(
  userId: string,
  requestedBusinessId?: string | null,
): Promise<{ primaryId: string; allIds: string[] }> {
  const { data: owned } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const ownedIds = (owned || []).map((b) => b.id).filter(Boolean);

  const { data: members } = await supabaseAdmin
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId);

  const memberIds = (members || []).map((m) => m.business_id).filter(Boolean);

  const allIds = Array.from(new Set([...ownedIds, ...memberIds]));

  const primaryId =
    requestedBusinessId && allIds.includes(requestedBusinessId)
      ? requestedBusinessId
      : allIds[0] || "";

  return { primaryId, allIds };
}

/**
 * Authenticates the caller and authorizes access to one business.
 * When `requestedBusinessId` is provided it MUST belong to the caller.
 */
export async function requireBusinessAccess(
  request: Request,
  requestedBusinessId?: string | null,
): Promise<AuthResult<{ user: ServerUser; businessId: string; businessIds: string[] }>> {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth;

  const { primaryId, allIds } = await resolveUserBusinessIds(
    auth.user.id,
    requestedBusinessId || null,
  );

  if (requestedBusinessId) {
    if (!allIds.includes(requestedBusinessId)) {
      return {
        ok: false,
        error: "Anda tidak memiliki akses ke bisnis ini",
        status: 403,
      };
    }
    return { ok: true, user: auth.user, businessId: requestedBusinessId, businessIds: allIds };
  }

  if (!primaryId) {
    return { ok: false, error: "Bisnis tidak ditemukan untuk akun ini", status: 403 };
  }

  return { ok: true, user: auth.user, businessId: primaryId, businessIds: allIds };
}

/**
 * Resolves the caller's effective role inside a business.
 * Business ownership always wins over a business_members row.
 */
export async function resolveBusinessRole(
  userId: string,
  businessId: string,
): Promise<BusinessRole | null> {
  const { data: owned } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (owned) return "owner";

  const { data: member } = await supabaseAdmin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = String((member as any)?.role || "").toLowerCase();
  if (!role) return null;
  if (role in ROLE_RANK) return role as BusinessRole;
  return "staff";
}

export function hasRoleAtLeast(role: BusinessRole | null, minimum: BusinessRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Authorizes the caller for a business AND requires a minimum role.
 */
export async function requireBusinessRole(
  request: Request,
  requestedBusinessId: string | null | undefined,
  minimum: BusinessRole,
): Promise<AuthResult<{ user: ServerUser; businessId: string; role: BusinessRole }>> {
  const access = await requireBusinessAccess(request, requestedBusinessId);
  if (!access.ok) return access;

  const role = await resolveBusinessRole(access.user.id, access.businessId);
  if (!hasRoleAtLeast(role, minimum)) {
    return {
      ok: false,
      error: "Anda tidak memiliki izin untuk tindakan ini",
      status: 403,
    };
  }

  return {
    ok: true,
    user: access.user,
    businessId: access.businessId,
    role: role as BusinessRole,
  };
}

/**
 * Returns outlet ids that belong to the given businesses.
 */
export async function resolveOutletIds(businessIds: string[]): Promise<string[]> {
  if (businessIds.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("outlets")
    .select("id")
    .in("business_id", businessIds);
  return (data || []).map((o) => o.id).filter(Boolean);
}

/**
 * True when the outlet belongs to one of the caller's businesses.
 * Outlet-less payloads (null / "all" / temporary ids) are rejected by callers that require one.
 */
export async function outletBelongsToBusinesses(
  outletId: string | null | undefined,
  businessIds: string[],
): Promise<boolean> {
  if (!outletId) return false;
  if (businessIds.length === 0) return false;
  const { data } = await supabaseAdmin
    .from("outlets")
    .select("id, business_id")
    .eq("id", outletId)
    .maybeSingle();
  if (!data) return false;
  return businessIds.includes((data as any).business_id);
}
