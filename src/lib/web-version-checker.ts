export const WEB_VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const WEB_VERSION_MIN_CHECK_GAP_MS = 15 * 1000;

export interface WebVersionPayload {
  buildId: string;
  builtAt: string;
}

/**
 * Mengambil `/web-version.json?t=<timestamp>` dari server tanpa cache browser/CDN
 * untuk mendeteksi deploy web baru secara ringan.
 */
export async function fetchServerWebVersion(options?: {
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<WebVersionPayload | null> {
  const fetcher = options?.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!fetcher) return null;

  const ts = typeof options?.now === "number" ? options.now : Date.now();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

  try {
    const response = await fetcher(`/web-version.json?t=${ts}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) return null;

    const json = await response.json();
    const buildId = typeof json?.buildId === "string" ? json.buildId.trim() : "";
    if (!buildId) return null;

    return {
      buildId,
      builtAt: typeof json?.builtAt === "string" ? json.builtAt.trim() : "",
    };
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function hasNewerWebBuild(
  initialBuildId: string | null | undefined,
  serverBuildId: string | null | undefined,
): boolean {
  const initialClean = String(initialBuildId || "").trim();
  const serverClean = String(serverBuildId || "").trim();
  if (!initialClean || !serverClean) return false;
  return initialClean !== serverClean;
}
