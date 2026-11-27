import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * Jembatan Native Android `PaymentAutoConfirm` + Parser Notifikasi Pembayaran QRIS Indonesia
 * (Shopee Partner, GoBiz, DANA, OVO, dsb.) untuk pelunasan otomatis di modal QRIS POS.
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

export interface PaymentAutoConfirmPluginInterface {
  isNotificationAccessEnabled(): Promise<{ enabled: boolean }> | { enabled: boolean };
  openNotificationAccessSettings(): Promise<{ opened: boolean }> | { opened: boolean };
  addListener(
    eventName: "paymentNotificationReceived",
    listenerFunc: (event: PaymentNotificationEvent) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
}

const MONITORED_MERCHANT_PACKAGES = new Set([
  "com.shopee.merchant.id",
  "com.shopee.id",
  "com.shopee.pos",
  "com.airpay.id",
  "com.gojek.resto",
  "id.dana",
  "ovo.id",
]);

const PAYMENT_KEYWORDS = [
  "diterima",
  "berhasil",
  "masuk",
  "dibayar",
  "pembayaran",
  "sukses",
  "received",
  "paid",
];

const PROMO_KEYWORDS = ["cashback", "voucher", "diskon", "promo", "gratis"];

export function isMonitoredPaymentPackage(packageName: string | null | undefined): boolean {
  const clean = String(packageName || "").trim().toLowerCase();
  if (!clean) return false;
  if (MONITORED_MERCHANT_PACKAGES.has(clean)) return true;
  return clean.includes("shopee") || clean.includes("merchant");
}

export function isIncomingPaymentNotificationText(rawText: string | null | undefined): boolean {
  const lower = String(rawText || "").trim().toLowerCase();
  if (!lower) return false;
  for (const promo of PROMO_KEYWORDS) {
    if (lower.includes(promo)) return false;
  }
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Ekstrak nominal Rupiah dari teks notifikasi (mis. "Rp 22.000", "Rp22.000,00", "IDR 22.000" -> 22000).
 * Mengembalikan `null` bila tidak ditemukan angka nominal valid.
 */
export function extractNotificationRupiahAmount(rawText: string | null | undefined): number | null {
  const text = String(rawText || "");
  if (!text) return null;

  const regex = /(?:rp\.?|idr)\s*([0-9][0-9.,]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawNum = (match[1] || "").trim();
    if (!rawNum) continue;
    // Buang desimal sen 2 digit di akhir (cth ",00" atau ".00"), pertahankan ribuan 3 digit (".000")
    const withoutCents = rawNum.replace(/[.,]\d{2}$/, "");
    const digitsOnly = withoutCents.replace(/[^0-9]/g, "");
    if (!digitsOnly) continue;
    const parsed = Number.parseInt(digitsOnly, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
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

function getPaymentAutoConfirmPlugin(): PaymentAutoConfirmPluginInterface | null {
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

      if (!isMonitoredPaymentPackage(pkg)) return;
      if (combined && !isIncomingPaymentNotificationText(combined)) return;

      const resolvedAmount =
        typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0
          ? Math.round(raw.amount)
          : extractNotificationRupiahAmount(combined) ?? 0;
      if (resolvedAmount <= 0) return;

      onPayment({
        packageName: pkg,
        title,
        text,
        amount: resolvedAmount,
        timestamp:
          typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp) && raw.timestamp > 0
            ? raw.timestamp
            : Date.now(),
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
