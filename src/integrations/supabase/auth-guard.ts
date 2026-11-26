import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";

let cachedAuthUser: User | null = null;
let cachedAt = 0;
let listenerRegistered = false;
const AUTH_CACHE_TTL_MS = 30_000;

function ensureAuthCacheListener() {
  if (listenerRegistered || typeof window === "undefined") return;
  listenerRegistered = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      cachedAuthUser = null;
      cachedAt = 0;
    } else if (session?.user) {
      cachedAuthUser = session.user;
      cachedAt = Date.now();
    }
  });
}

/**
 * Resolves the active authenticated user cleanly using in-memory fast path + getSession() first
 * (prevents route transition lag and false redirects when getUser() encounters transient network/abort errors)
 * and safely handles SSR contexts where browser storage is unavailable.
 */
export async function resolveAuthenticatedUser() {
  if (typeof window === "undefined") {
    return null;
  }

  ensureAuthCacheListener();

  if (cachedAuthUser && Date.now() - cachedAt < AUTH_CACHE_TTL_MS) {
    return cachedAuthUser;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      cachedAuthUser = sessionData.session.user;
      cachedAt = Date.now();
      return sessionData.session.user;
    }
  } catch {
    // Fallback to getUser below
  }

  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (!error && userData?.user) {
      cachedAuthUser = userData.user;
      cachedAt = Date.now();
      return userData.user;
    }
  } catch {
    // Re-check local session before concluding unauthenticated
  }

  try {
    const { data: fallbackSession } = await supabase.auth.getSession();
    const fallbackUser = fallbackSession?.session?.user ?? null;
    cachedAuthUser = fallbackUser;
    cachedAt = fallbackUser ? Date.now() : 0;
    return fallbackUser;
  } catch {
    return null;
  }
}
