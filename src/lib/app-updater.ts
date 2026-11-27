import { registerPlugin } from "@capacitor/core";

interface NativeVersionBridge {
  getAppVersion?():
    | Promise<{ versionName?: string; versionCode?: number }>
    | { versionName?: string; versionCode?: number };
  openDownloadUrl?(options: { url: string }): Promise<{ opened?: boolean }> | { opened?: boolean };
}

export interface ApkDownloadProgressEvent {
  percent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
}

interface NativePluginListenerHandle {
  remove: () => Promise<void> | void;
}

interface NativeAppUpdateBridge {
  downloadAndInstallApk?(options: { url: string }):
    | Promise<{
        installedPrompted?: boolean;
        percent?: number;
        downloadedBytes?: number;
        totalBytes?: number;
      }>
    | {
        installedPrompted?: boolean;
        percent?: number;
        downloadedBytes?: number;
        totalBytes?: number;
      };
  addListener?(
    eventName: "apkDownloadProgress",
    listenerFunc: (event: ApkDownloadProgressEvent) => void,
  ): Promise<NativePluginListenerHandle> | NativePluginListenerHandle;
}

function isNativeApkEnvironment(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

let cachedBridgeProxy: NativeVersionBridge | null = null;
let cachedAppUpdateProxy: NativeAppUpdateBridge | null = null;

function getPaymentAutoConfirmPlugin(): NativeVersionBridge | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as any).Capacitor;
    if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) {
      return null;
    }
    const direct = cap.Plugins?.PaymentAutoConfirm as NativeVersionBridge | undefined;
    if (direct) return direct;

    const registered =
      (Array.isArray(cap.PluginHeaders) &&
        cap.PluginHeaders.some((h: any) => h?.name === "PaymentAutoConfirm")) ||
      (typeof cap.isPluginAvailable === "function" &&
        Boolean(cap.isPluginAvailable("PaymentAutoConfirm")));
    if (!registered) return null;

    if (!cachedBridgeProxy) {
      cachedBridgeProxy = registerPlugin<NativeVersionBridge>("PaymentAutoConfirm");
    }
    return cachedBridgeProxy;
  } catch {
    return null;
  }
}

function getAppUpdatePlugin(): NativeAppUpdateBridge | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as any).Capacitor;
    if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) {
      return null;
    }
    const direct = cap.Plugins?.AppUpdate as NativeAppUpdateBridge | undefined;
    if (direct) return direct;

    const registered =
      (Array.isArray(cap.PluginHeaders) &&
        cap.PluginHeaders.some((h: any) => h?.name === "AppUpdate")) ||
      (typeof cap.isPluginAvailable === "function" &&
        Boolean(cap.isPluginAvailable("AppUpdate")));
    if (!registered) return null;

    if (!cachedAppUpdateProxy) {
      cachedAppUpdateProxy = registerPlugin<NativeAppUpdateBridge>("AppUpdate");
    }
    return cachedAppUpdateProxy;
  } catch {
    return null;
  }
}

/**
 * Sistem Notifikasi & Pengunduh Update `.apk` In-App di Tablet Android (GitHub Releases).
 *
 * - Mengecek endpoint publik `https://api.github.com/repos/kebabschoice-pos-v2/app/releases/latest`
 *   satu kali saat aplikasi dibuka di dalam `.apk` Capacitor, atau kapan saja saat tombol
 *   `Cek Update Aplikasi` di halaman `Profil` ditekan.
 * - Membaca `versionName` & `versionCode` native dari `PaymentAutoConfirm.getAppVersion()`
 *   (dengan fallback aman `"1.0.0"` pada `.apk` generasi awal yang belum memiliki method tersebut).
 * - Mengunduh `KebabsChoicePOS.apk` langsung di background melalui plugin native `AppUpdate`
 *   sambil menampilkan progress bar `0%–100%` di dalam aplikasi, lalu membuka installer Android
 *   secara langsung tanpa membuka browser (dan fallback aman ke `openApkDownloadUrl` bila dijalankan
 *   dari `.apk` versi lama sebelum `AppUpdate` terdaftar).
 */

export const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/kebabschoice-pos-v2/app/releases/latest";

export const FALLBACK_INSTALLED_APK_VERSION = "1.0.0";

export interface AppUpdateState {
  checked: boolean;
  checking: boolean;
  isNative: boolean;
  hasUpdate: boolean;
  installedVersion: string;
  installedVersionCode: number;
  latestVersion: string;
  tagName: string;
  downloadUrl: string;
  releaseName: string;
  publishedAt: string;
  downloading: boolean;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  installTriggered: boolean;
  error: string | null;
}

const initialUpdateState: AppUpdateState = {
  checked: false,
  checking: false,
  isNative: false,
  hasUpdate: false,
  installedVersion: FALLBACK_INSTALLED_APK_VERSION,
  installedVersionCode: 1,
  latestVersion: "",
  tagName: "",
  downloadUrl: "",
  releaseName: "",
  publishedAt: "",
  downloading: false,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  installTriggered: false,
  error: null,
};

let currentState: AppUpdateState = { ...initialUpdateState };
let hasAutoCheckedOnce = false;
let inflightPromise: Promise<AppUpdateState> | null = null;
const listeners = new Set<(state: AppUpdateState) => void>();

function emitUpdateState(next: Partial<AppUpdateState>): AppUpdateState {
  currentState = { ...currentState, ...next };
  for (const fn of listeners) {
    try {
      fn(currentState);
    } catch {
      // Jangan biarkan listener error mengganggu komponen lain
    }
  }
  return currentState;
}

export function getAppUpdateState(): AppUpdateState {
  return { ...currentState, isNative: isNativeApkEnvironment() || currentState.isNative };
}

export function subscribeAppUpdateState(
  listener: (state: AppUpdateState) => void,
): () => void {
  listeners.add(listener);
  try {
    listener(getAppUpdateState());
  } catch {}
  return () => {
    listeners.delete(listener);
  };
}

export function formatApkBytes(bytes: number | null | undefined): string {
  const safe = Number(bytes) || 0;
  if (safe <= 0) return "";
  if (safe < 1024 * 1024) {
    return `${Math.max(1, Math.round(safe / 1024))} KB`;
  }
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalisasi string versi/tag GitHub Release menjadi format numerik bersih.
 * Contoh: `"apk-v2.0.15"` -> `"2.0.15"`, `"v2.0.3"` -> `"2.0.3"`, `"1.0"` -> `"1.0"`.
 */
export function normalizeAppVersion(raw: string | null | undefined): string {
  const clean = String(raw || "").trim();
  if (!clean) return "";
  const strippedPrefix = clean.replace(/^(?:apk[-_]?v?|release[-_]?v?|v)/i, "").trim();
  const semverMatch = strippedPrefix.match(/(\d+(?:\.\d+)*)/);
  return semverMatch?.[1] ?? strippedPrefix;
}

/**
 * Bandingkan dua versi aplikasi (mis. `"2.0.12"` vs `"1.0.0"`).
 * Mengembalikan:
 * - `1` bila `remoteVersion > installedVersion` (ada update lebih baru)
 * - `0` bila setara (`"1.0"` vs `"1.0.0"` dianggap `0`)
 * - `-1` bila `remoteVersion < installedVersion`
 */
export function compareAppVersions(
  remoteVersion: string | null | undefined,
  installedVersion: string | null | undefined,
): number {
  const normRemote = normalizeAppVersion(remoteVersion);
  const normInstalled = normalizeAppVersion(installedVersion);
  if (!normRemote && !normInstalled) return 0;
  if (normRemote && !normInstalled) return 1;
  if (!normRemote && normInstalled) return -1;

  const remoteParts = normRemote.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const installedParts = normInstalled.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const maxLen = Math.max(remoteParts.length, installedParts.length);

  for (let i = 0; i < maxLen; i += 1) {
    const r = remoteParts[i] ?? 0;
    const c = installedParts[i] ?? 0;
    if (r > c) return 1;
    if (r < c) return -1;
  }
  return 0;
}

/**
 * Baca `versionName` & `versionCode` dari plugin native Android `PaymentAutoConfirm.getAppVersion()`.
 * Pada `.apk` lama yang belum memiliki method tersebut, aman kembali ke `1.0.0`.
 */
export async function getInstalledApkVersion(): Promise<{
  versionName: string;
  versionCode: number;
  isNative: boolean;
}> {
  const isNative = isNativeApkEnvironment();
  if (!isNative) {
    return {
      versionName: FALLBACK_INSTALLED_APK_VERSION,
      versionCode: 0,
      isNative: false,
    };
  }

  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (plugin && typeof plugin.getAppVersion === "function") {
      const res = await Promise.resolve(plugin.getAppVersion());
      const vName = normalizeAppVersion(res?.versionName) || FALLBACK_INSTALLED_APK_VERSION;
      const vCode = Math.max(1, Math.round(Number(res?.versionCode) || 1));
      return {
        versionName: vName,
        versionCode: vCode,
        isNative: true,
      };
    }
  } catch {
    // `.apk` versi awal belum memiliki `getAppVersion` -> gunakan fallback 1.0.0 agar banner update tetap muncul!
  }

  return {
    versionName: FALLBACK_INSTALLED_APK_VERSION,
    versionCode: 1,
    isNative: true,
  };
}

/**
 * Ekstrak informasi rilis & URL download `.apk` (`browser_download_url`) dari payload GitHub Releases API.
 */
export function parseGitHubReleaseUpdate(
  releasePayload: any,
  installedVersion: string,
  installedVersionCode = 1,
): Omit<
  AppUpdateState,
  | "checking"
  | "isNative"
  | "downloading"
  | "downloadProgress"
  | "downloadedBytes"
  | "totalBytes"
  | "installTriggered"
> {
  const safeInstalled = normalizeAppVersion(installedVersion) || FALLBACK_INSTALLED_APK_VERSION;
  if (!releasePayload || typeof releasePayload !== "object" || releasePayload.draft) {
    return {
      checked: true,
      hasUpdate: false,
      installedVersion: safeInstalled,
      installedVersionCode,
      latestVersion: "",
      tagName: "",
      downloadUrl: "",
      releaseName: "",
      publishedAt: "",
      error: null,
    };
  }

  const tagName = String(releasePayload.tag_name || "").trim();
  const releaseName = String(releasePayload.name || tagName || "").trim();
  const latestVersion = normalizeAppVersion(tagName || releaseName);
  const publishedAt = String(releasePayload.published_at || "").trim();

  const assets: any[] = Array.isArray(releasePayload.assets) ? releasePayload.assets : [];
  const preferredApkAsset =
    assets.find(
      (a) =>
        String(a?.name || "").toLowerCase() === "kebabschoicepos.apk" &&
        typeof a?.browser_download_url === "string" &&
        a.browser_download_url.trim().length > 0,
    ) ||
    assets.find(
      (a) =>
        String(a?.name || "")
          .toLowerCase()
          .endsWith(".apk") &&
        typeof a?.browser_download_url === "string" &&
        a.browser_download_url.trim().length > 0,
    );

  const downloadUrl = String(
    preferredApkAsset?.browser_download_url || releasePayload.html_url || "",
  ).trim();

  const hasUpdate = Boolean(
    latestVersion &&
      downloadUrl &&
      compareAppVersions(latestVersion, safeInstalled) > 0,
  );

  return {
    checked: true,
    hasUpdate,
    installedVersion: safeInstalled,
    installedVersionCode,
    latestVersion,
    tagName,
    downloadUrl,
    releaseName,
    publishedAt,
    error: null,
  };
}

/**
 * Cek ketersediaan update `.apk` ke GitHub Releases (`kebabschoice-pos-v2/app/releases/latest`).
 * - Saat `options.force` tidak diset, hanya berjalan otomatis 1x per sesi di dalam `.apk` Capacitor.
 * - Saat `options.force === true` (tombol `Cek Update Aplikasi` di Profil), selalu melakukan cek ulang.
 */
export async function checkForAppUpdate(options?: {
  force?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<AppUpdateState> {
  const force = Boolean(options?.force);
  const isNative = isNativeApkEnvironment();

  if (!isNative) {
    return emitUpdateState({
      checked: true,
      checking: false,
      isNative: false,
      hasUpdate: false,
      error: null,
    });
  }

  if (!force && hasAutoCheckedOnce && currentState.checked) {
    return getAppUpdateState();
  }

  if (inflightPromise && !force) {
    return inflightPromise;
  }

  hasAutoCheckedOnce = true;

  const runCheck = async (): Promise<AppUpdateState> => {
    const installed = await getInstalledApkVersion();
    emitUpdateState({
      checking: true,
      isNative: true,
      installedVersion: installed.versionName,
      installedVersionCode: installed.versionCode,
      error: null,
    });

    const fetcher = options?.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
    if (!fetcher) {
      return emitUpdateState({
        checked: true,
        checking: false,
        error: "Fitur jaringan tidak tersedia di perangkat ini.",
      });
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      const response = await fetcher(GITHUB_LATEST_RELEASE_API, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (response.status === 404) {
        return emitUpdateState({
          checked: true,
          checking: false,
          isNative: true,
          hasUpdate: false,
          installedVersion: installed.versionName,
          installedVersionCode: installed.versionCode,
          error: null,
        });
      }

      if (!response.ok) {
        return emitUpdateState({
          checked: true,
          checking: false,
          isNative: true,
          installedVersion: installed.versionName,
          installedVersionCode: installed.versionCode,
          error: `Gagal memeriksa update (HTTP ${response.status})`,
        });
      }

      const json = await response.json();
      const parsed = parseGitHubReleaseUpdate(
        json,
        installed.versionName,
        installed.versionCode,
      );
      return emitUpdateState({
        ...parsed,
        checking: false,
        isNative: true,
      });
    } catch (err: any) {
      return emitUpdateState({
        checked: true,
        checking: false,
        isNative: true,
        installedVersion: installed.versionName,
        installedVersionCode: installed.versionCode,
        error: err?.name === "AbortError" ? "Waktu cek update habis" : "Tidak dapat terhubung ke server update",
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      inflightPromise = null;
    }
  };

  inflightPromise = runCheck();
  return inflightPromise;
}

/**
 * Buka URL download `.apk` (`browser_download_url`) di browser sistem tablet Android (fallback untuk `.apk` lama).
 */
export async function openApkDownloadUrl(downloadUrl: string): Promise<boolean> {
  const cleanUrl = String(downloadUrl || "").trim();
  if (!cleanUrl) return false;

  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (plugin && typeof plugin.openDownloadUrl === "function") {
      const res = await Promise.resolve(plugin.openDownloadUrl({ url: cleanUrl }));
      if (res?.opened) return true;
    }
  } catch {
    // Lanjut ke fallback window.open -> ditangkap PosWebChromeClient.onCreateWindow di MainActivity.java
  }

  try {
    if (typeof window !== "undefined") {
      const opened = window.open(cleanUrl, "_blank", "noopener,noreferrer");
      if (opened) return true;
      window.location.assign(cleanUrl);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Unduh file `.apk` langsung di dalam aplikasi (menampilkan progress bar `0%–100%`) lalu luncurkan
 * dialog Update Android secara otomatis begitu mencapai `100%` tanpa membuka browser.
 * Bila dijalankan dari `.apk` generasi awal yang belum memiliki plugin native `AppUpdate`,
 * otomatis fallback ke `openApkDownloadUrl`.
 */
export async function downloadAndInstallApkUpdate(downloadUrl?: string): Promise<{
  ok: boolean;
  mode: "native_installer" | "browser_fallback" | "already_downloading" | "error";
  error?: string;
}> {
  const cleanUrl = String(downloadUrl || currentState.downloadUrl || "").trim();
  if (!cleanUrl) {
    return {
      ok: false,
      mode: "error",
      error: "URL pembaruan APK tidak tersedia.",
    };
  }

  if (currentState.downloading) {
    return {
      ok: false,
      mode: "already_downloading",
    };
  }

  const plugin = getAppUpdatePlugin();
  if (!plugin || typeof plugin.downloadAndInstallApk !== "function") {
    const opened = await openApkDownloadUrl(cleanUrl);
    return {
      ok: opened,
      mode: opened ? "browser_fallback" : "error",
      ...(opened ? {} : { error: "Gagal membuka pengunduh pembaruan." }),
    };
  }

  let listenerHandle: NativePluginListenerHandle | null = null;
  let unsubscribed = false;

  emitUpdateState({
    downloading: true,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    installTriggered: false,
    error: null,
  });

  try {
    if (typeof plugin.addListener === "function") {
      const maybeHandle = plugin.addListener("apkDownloadProgress", (event) => {
        if (unsubscribed) return;
        const pct = Math.max(
          0,
          Math.min(100, Math.round(Number(event?.percent) || 0)),
        );
        const dlBytes = Math.max(0, Math.round(Number(event?.downloadedBytes) || 0));
        const totBytes = Math.max(0, Math.round(Number(event?.totalBytes) || 0));
        emitUpdateState({
          downloading: true,
          downloadProgress: pct,
          downloadedBytes: dlBytes,
          totalBytes: totBytes,
        });
      });

      if (maybeHandle && typeof (maybeHandle as Promise<NativePluginListenerHandle>).then === "function") {
        listenerHandle = await (maybeHandle as Promise<NativePluginListenerHandle>);
      } else {
        listenerHandle = (maybeHandle as NativePluginListenerHandle) || null;
      }
    }

    const res = await Promise.resolve(plugin.downloadAndInstallApk({ url: cleanUrl }));
    const finalDl = Math.max(
      currentState.downloadedBytes,
      Math.round(Number(res?.downloadedBytes) || 0),
    );
    const finalTotal = Math.max(
      currentState.totalBytes,
      Math.round(Number(res?.totalBytes) || finalDl),
    );

    emitUpdateState({
      downloading: false,
      downloadProgress: 100,
      downloadedBytes: finalDl,
      totalBytes: finalTotal,
      installTriggered: true,
      error: null,
    });

    return {
      ok: true,
      mode: "native_installer",
    };
  } catch (err: any) {
    const errMsg =
      typeof err?.message === "string" && err.message.trim().length > 0
        ? err.message.trim()
        : "Gagal mengunduh pembaruan aplikasi.";
    emitUpdateState({
      downloading: false,
      error: errMsg,
    });
    return {
      ok: false,
      mode: "error",
      error: errMsg,
    };
  } finally {
    unsubscribed = true;
    if (listenerHandle && typeof listenerHandle.remove === "function") {
      try {
        await Promise.resolve(listenerHandle.remove());
      } catch {}
    }
  }
}

export function resetAppUpdateStateForTests(): void {
  currentState = { ...initialUpdateState };
  hasAutoCheckedOnce = false;
  inflightPromise = null;
  cachedBridgeProxy = null;
  cachedAppUpdateProxy = null;
}
