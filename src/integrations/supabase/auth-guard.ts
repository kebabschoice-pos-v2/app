import { supabase } from "./client";

/**
 * Resolves the active authenticated user cleanly using getSession() first
 * (prevents false redirects when getUser() encounters transient network/abort errors)
 * and safely handles SSR contexts where browser storage is unavailable.
 */
export async function resolveAuthenticatedUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }
  } catch {
    // Fallback to getUser below
  }

  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (!error && userData?.user) {
      return userData.user;
    }
  } catch {
    // Re-check local session before concluding unauthenticated
  }

  try {
    const { data: fallbackSession } = await supabase.auth.getSession();
    return fallbackSession?.session?.user ?? null;
  } catch {
    return null;
  }
}
