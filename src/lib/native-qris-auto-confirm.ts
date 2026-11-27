import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * Jembatan Native Android `PaymentAutoConfirm` + Parser Notifikasi Pembayaran QRIS Indonesia
 * (Shopee Partner, ShopeePay, GoPay/GoBiz, DANA, OVO, BCA, BRI, Mandiri, BNI, SeaBank, dsb.)
 * untuk pelunasan otomatis di modal QRIS POS, log diagnostik 5 notifikasi terakhir, & info versi APK.
 *
 * CATATAN PENTING ARSITEKTUR CAPACITOR ANDROID:
 * - Objek plugin yang diinjeksi `JSExport.java` ke `window.Capacitor.Plugins.PaymentAutoConfirm`
 *   memiliki `addListener(eventName, cb)` yang memanggil `window.Capacitor.addListener(...)` dan
 *   mengembalikan `{ remove: async () => ... }` secara SINKRON (bukan Promise!).
 * - Sebaliknya, proxy `registerPlugin("PaymentAutoConfirm")` dari `@capacitor/core` mengembalikan
 *   `Promise<PluginListenerHandle>`.
 * - Seluruh pemanggilan di modul ini mendukung KEDUA bentuk return (sinkron maupun Promise) serta
 *   dibungkus `try / catch` ketat agar tidak pernah melempar uncaught error ke React ErrorBoundary,
 *   baik di `.apk` versi baru, `.apk` versi lama (Live URL), maupun di browser biasa.
 */

export interface PaymentNotificationEvent {
  packageName: string;
  title: string;
  text: string;
  amount: number;
  timestamp: number;
}

export interface RecentNotificationLogItem {
  packageName: string;
  title: string;
  text: string;
  parsedAmount: number;
  matched: boolean;
  timestamp: number;
}

export interface NativeAppVersionInfo {
  versionName: string;
  versionCode: number;
  packageName?: string;
}

export interface PaymentAutoConfirmPluginInterface {
  isNotificationAccessEnabled(): Promise<{ enabled: boolean }> | { enabled: boolean };
  openNotificationAccessSettings(): Promise<{ opened: boolean }> | { opened: boolean };
  getRecentNotifications?():
    | Promise<{ notifications: RecentNotificationLogItem[] }>
    | { notifications: RecentNotificationLogItem[] };
  getAppVersion?(): Promise<NativeAppVersionInfo> | NativeAppVersionInfo;
  openDownloadUrl?(options: { url: string }): Promise<{ opened: boolean }> | { opened: boolean };
  addListener(
    eventName: "paymentNotificationReceived",
    listenerFunc: (event: PaymentNotificationEvent) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
}

const MONITORED_MERCHANT_PACKAGES = new Set([
  "com.shopee.merchant.id",
  "com.shopee.partner",
  "com.shopee.partner.id",
  "com.shopee.id",
  "com.shopee.pos",
  "com.airpay.id",
  "com.gojek.resto",
  "com.gojek.gopaymerchant",
  "com.gojek.app",
  "id.dana",
  "id.dana.bisnis",
  "ovo.id",
  "com.bca",
  "com.bca.merchant",
  "id.co.bri.brimo",
  "id.co.bri.brimerchant",
  "bmri.livinmerchant",
  "src.com.bni",
  "id.co.seabank.app",
]);

const MONITORED_PACKAGE_TOKENS = [
  "shopee",
  "airpay",
  "spay",
  "gopay",
  "dana",
  "ovo",
  "qris",
  "merchant",
  "bca",
  "bri",
  "mandiri",
  "bni",
  "seabank",
];

const PAYMENT_KEYWORDS = [
  "transaksi berhasil",
  "diterima",
  "menerima",
  "terima",
  "berhasil",
  "masuk",
  "dibayar",
  "pembayaran",
  "sukses",
  "received",
  "paid",
  "payment",
  "qris",
];

const PROMO_KEYWORDS = ["cashback", "voucher", "diskon", "promo", "gratis"];

const MAX_FALLBACK_RECENT_LOGS = 5;
const fallbackRecentLogs: RecentNotificationLogItem[] = [];

function pushFallbackRecentLog(entry: RecentNotificationLogItem): void {
  const head = fallbackRecentLogs[0];
  if (
    head &&
    head.packageName === entry.packageName &&
    head.title === entry.title &&
    head.text === entry.text &&
    Math.abs(entry.timestamp - head.timestamp) < 2500
  ) {
    return;
  }
  fallbackRecentLogs.unshift(entry);
  if (fallbackRecentLogs.length > MAX_FALLBACK_RECENT_LOGS) {
    fallbackRecentLogs.length = MAX_FALLBACK_RECENT_LOGS;
  }
}

export function isMonitoredPaymentPackage(packageName: string | null | undefined): boolean {
  const clean = String(packageName || "").trim().toLowerCase();
  if (!clean || clean === "com.kebabschoice.pos") return false;
  if (MONITORED_MERCHANT_PACKAGES.has(clean)) return true;
  return MONITORED_PACKAGE_TOKENS.some((token) => clean.includes(token));
}

export function isIncomingPaymentNotificationText(rawText: string | null | undefined): boolean {
  const lower = String(rawText || "").trim().toLowerCase();
  if (!lower) return false;
  for (const promo of PROMO_KEYWORDS) {
    if (lower.includes(promo)) return false;
  }
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseNormalizedRupiahToken(rawToken: string): number | null {
  const trimmed = String(rawToken || "").trim();
  if (!trimmed) return null;
  // Buang desimal sen 2 digit di akhir (cth ",00" atau ".00"), pertahankan ribuan 3 digit (".000" / ",000")
  const withoutCents = trimmed.replace(/[.,]\d{2}$/, "");
  const digitsOnly = withoutCents.replace(/[^0-9]/g, "");
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

/**
 * Ekstrak nominal Rupiah dari teks notifikasi:
 * mendukung `Rp9.900`, `Rp 9.900`, `Rp9,900`, `Rp 9.900,00`, `IDR 9.900`, `9.900`, dsb.
 * Mengembalikan `null` bila tidak ditemukan angka nominal valid.
 */
export function extractNotificationRupiahAmount(rawText: string | null | undefined): number | null {
  const text = String(rawText || "");
  if (!text) return null;

  // Prioritas 1: nominal dengan awalan mata uang Rp / IDR
  const prefixedRegex = /(?:rp\.?|idr)\s*([0-9]+(?:[.,][0-9]+)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixedRegex.exec(text)) !== null) {
    const parsed = parseNormalizedRupiahToken(match[1] || "");
    if (parsed !== null) {
      return parsed;
    }
  }

  // Prioritas 2: angka ribuan bertitik/koma tanpa awalan Rp (mis. "9.900", "9,900", "22.000,00")
  const bareGroupedRegex = /(?:^|[^0-9.,:/-])([1-9][0-9]{0,2}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?)(?![0-9])/g;
  while ((match = bareGroupedRegex.exec(text)) !== null) {
    const parsed = parseNormalizedRupiahToken(match[1] || "");
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

/**
 * Validasi & ekstrak event notifikasi pembayaran masuk (menolak promo/cashback/voucher).
 */
export function parseShopeePartnerNotification(input: {
  packageName?: string;
  title?: string;
  text?: string;
  timestamp?: number;
}): PaymentNotificationEvent | null {
  if (!input || typeof input !== "object") return null;
  const packageName = String(input.packageName ?? "com.shopee.merchant.id").trim();
  if (!isMonitoredPaymentPackage(packageName)) {
    return null;
  }
  const title = String(input.title || "").trim();
  const text = String(input.text || "").trim();
  const combined = `${title} ${text}`.trim();
  if (!isIncomingPaymentNotificationText(combined)) {
    return null;
  }
  const amount = extractNotificationRupiahAmount(combined);
  if (!amount || amount <= 0) {
    return null;
  }
  return {
    packageName,
    title,
    text,
    amount,
    timestamp:
      typeof input.timestamp === "number" && input.timestamp > 0 ? input.timestamp : Date.now(),
  };
}

let cachedPluginProxy: PaymentAutoConfirmPluginInterface | null = null;

function isPaymentAutoConfirmPluginRegistered(cap: any): boolean {
  try {
    if (!cap) return false;
    if (cap.Plugins && cap.Plugins.PaymentAutoConfirm) {
      return true;
    }
    if (
      Array.isArray(cap.PluginHeaders) &&
      cap.PluginHeaders.some((h: any) => h?.name === "PaymentAutoConfirm")
    ) {
      return true;
    }
    if (typeof cap.isPluginAvailable === "function") {
      return Boolean(cap.isPluginAvailable("PaymentAutoConfirm"));
    }
  } catch {
    return false;
  }
  return false;
}

export function getPaymentAutoConfirmPlugin(): PaymentAutoConfirmPluginInterface | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as any).Capacitor;
    if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) {
      return null;
    }

    // Di `.apk` versi lama yang belum memuat `PaymentAutoConfirmPlugin.java` (mode Live URL Vercel),
    // jangan panggil `registerPlugin` agar tidak membuat proxy unimplemented yang melempar exception.
    if (!isPaymentAutoConfirmPluginRegistered(cap)) {
      return null;
    }

    const direct = cap.Plugins?.PaymentAutoConfirm as
      | PaymentAutoConfirmPluginInterface
      | undefined;
    if (direct) return direct;

    if (!cachedPluginProxy) {
      cachedPluginProxy =
        registerPlugin<PaymentAutoConfirmPluginInterface>("PaymentAutoConfirm");
    }
    return cachedPluginProxy;
  } catch {
    return null;
  }
}

function safeRemoveListenerHandle(handle: unknown): void {
  if (!handle || typeof (handle as PluginListenerHandle).remove !== "function") {
    return;
  }
  try {
    const maybePromise = (handle as PluginListenerHandle).remove();
    if (maybePromise && typeof (maybePromise as Promise<void>).catch === "function") {
      (maybePromise as Promise<void>).catch(() => {});
    }
  } catch {
    // Jangan pernah biarkan error cleanup meledak ke siklus unmount React
  }
}

export function isNativeApkEnvironment(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export async function isNotificationAccessEnabledNative(): Promise<boolean> {
  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (!plugin || typeof plugin.isNotificationAccessEnabled !== "function") {
      return false;
    }
    const res = await Promise.resolve(plugin.isNotificationAccessEnabled());
    return Boolean(res?.enabled);
  } catch {
    return false;
  }
}

export async function openNotificationAccessSettingsNative(): Promise<boolean> {
  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (!plugin || typeof plugin.openNotificationAccessSettings !== "function") {
      return false;
    }
    const res = await Promise.resolve(plugin.openNotificationAccessSettings());
    return Boolean(res?.opened !== false);
  } catch {
    return false;
  }
}

/**
 * Ambil 5 riwayat notifikasi terakhir dari memori `PaymentNotificationListener`
 * untuk ditampilkan pada panel Diagnostik di menu Profil tablet.
 */
export async function getRecentNotificationsNative(): Promise<RecentNotificationLogItem[]> {
  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (plugin && typeof plugin.getRecentNotifications === "function") {
      const res = await Promise.resolve(plugin.getRecentNotifications());
      if (Array.isArray(res?.notifications)) {
        return res.notifications.slice(0, MAX_FALLBACK_RECENT_LOGS).map((item) => ({
          packageName: String(item?.packageName || ""),
          title: String(item?.title || ""),
          text: String(item?.text || ""),
          parsedAmount: Math.max(0, Math.round(Number(item?.parsedAmount) || 0)),
          matched: Boolean(item?.matched),
          timestamp: Number(item?.timestamp) > 0 ? Number(item.timestamp) : Date.now(),
        }));
      }
    }
  } catch {
    // Fallback aman untuk `.apk` versi lama yang belum memiliki method `getRecentNotifications`
  }
  return [...fallbackRecentLogs];
}

/**
 * Dengarkan event `paymentNotificationReceived` dari service native Android `PaymentNotificationListener`.
 * Mendukung penuh:
 * - Return sinkron `{ remove }` dari `window.Capacitor.Plugins.PaymentAutoConfirm.addListener` (`JSExport.java`)
 * - Return asinkron `Promise<{ remove }>` dari `@capacitor/core` `registerPlugin`
 * - Fallback aman (no-op) di browser biasa atau `.apk` lama tanpa pernah melempar error ke React.
 */
export function subscribePaymentNotifications(
  onPayment: (event: PaymentNotificationEvent) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let disposed = false;
  let listenerHandle: PluginListenerHandle | null = null;

  const deliverIfValid = (raw: Partial<PaymentNotificationEvent> | null | undefined) => {
    try {
      if (disposed || !raw || typeof raw !== "object") return;
      const pkg = String(raw.packageName || "com.shopee.merchant.id");
      const title = String(raw.title || "");
      const text = String(raw.text || "");
      const combined = `${title} ${text}`.trim();
      const ts =
        typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp) && raw.timestamp > 0
          ? raw.timestamp
          : Date.now();

      const pkgOk = isMonitoredPaymentPackage(pkg);
      const textOk = !combined || isIncomingPaymentNotificationText(combined);
      const resolvedAmount =
        typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0
          ? Math.round(raw.amount)
          : extractNotificationRupiahAmount(combined) ?? 0;
      const matched = pkgOk && textOk && resolvedAmount > 0;

      pushFallbackRecentLog({
        packageName: pkg,
        title,
        text,
        parsedAmount: resolvedAmount > 0 ? resolvedAmount : 0,
        matched,
        timestamp: ts,
      });

      if (!matched) return;

      onPayment({
        packageName: pkg,
        title,
        text,
        amount: resolvedAmount,
        timestamp: ts,
      });
    } catch {
      // Jangan pernah biarkan kegagalan parsing / callback menjatuhkan WebView atau React
    }
  };

  try {
    const plugin = getPaymentAutoConfirmPlugin();
    if (plugin && typeof plugin.addListener === "function") {
      const registration = plugin.addListener("paymentNotificationReceived", (evt) => {
        deliverIfValid(evt);
      });

      if (registration && typeof (registration as Promise<PluginListenerHandle>).then === "function") {
        (registration as Promise<PluginListenerHandle>)
          .then((handle) => {
            if (disposed) {
              safeRemoveListenerHandle(handle);
            } else {
              listenerHandle = handle ?? null;
            }
          })
          .catch(() => {});
      } else if (registration && typeof (registration as PluginListenerHandle).remove === "function") {
        if (disposed) {
          safeRemoveListenerHandle(registration);
        } else {
          listenerHandle = registration as PluginListenerHandle;
        }
      }
    }
  } catch {
    // Abaikan kegagalan registrasi plugin native agar UI Modal QRIS tetap berjalan normal
  }

  const handleWindowSimulation = (e: Event) => {
    try {
      const detail = (e as CustomEvent<PaymentNotificationEvent>)?.detail;
      deliverIfValid(detail);
    } catch {}
  };

  try {
    window.addEventListener("paymentNotificationReceived", handleWindowSimulation);
  } catch {}

  return () => {
    disposed = true;
    try {
      window.removeEventListener("paymentNotificationReceived", handleWindowSimulation);
    } catch {}
    const handleToClean = listenerHandle;
    listenerHandle = null;
    safeRemoveListenerHandle(handleToClean);
  };
}
