import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * Jembatan Native Android `PaymentAutoConfirm` + Parser Notifikasi Pembayaran QRIS Indonesia
 * (Shopee Partner, GoBiz, DANA, OVO, dsb.) untuk pelunasan otomatis di modal QRIS POS.
 */

export interface PaymentNotificationEvent {
  packageName: string;
  title: string;
  text: string;
  amount: number;
  timestamp: number;
}

export interface PaymentAutoConfirmPluginInterface {
  isNotificationAccessEnabled(): Promise<{ enabled: boolean }>;
  openNotificationAccessSettings(): Promise<{ opened: boolean }>;
  addListener(
    eventName: "paymentNotificationReceived",
    listenerFunc: (event: PaymentNotificationEvent) => void,
  ): Promise<PluginListenerHandle>;
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

function getPaymentAutoConfirmPlugin(): PaymentAutoConfirmPluginInterface | null {
  if (typeof window === "undefined") return null;
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;

  const direct = cap?.Plugins?.PaymentAutoConfirm as
    | PaymentAutoConfirmPluginInterface
    | undefined;
  if (direct) return direct;

  if (!cachedPluginProxy) {
    cachedPluginProxy =
      registerPlugin<PaymentAutoConfirmPluginInterface>("PaymentAutoConfirm");
  }
  return cachedPluginProxy;
}

export function isNativeApkEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export async function isNotificationAccessEnabledNative(): Promise<boolean> {
  const plugin = getPaymentAutoConfirmPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.isNotificationAccessEnabled();
    return Boolean(res?.enabled);
  } catch {
    return false;
  }
}

export async function openNotificationAccessSettingsNative(): Promise<boolean> {
  const plugin = getPaymentAutoConfirmPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.openNotificationAccessSettings();
    return Boolean(res?.opened !== false);
  } catch {
    return false;
  }
}

/**
 * Dengarkan event `paymentNotificationReceived` dari service native Android `PaymentNotificationListener`.
 * Aman dipanggil di browser biasa (no-op untuk bridge native).
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
    if (disposed || !raw) return;
    const pkg = String(raw.packageName || "com.shopee.merchant.id");
    const title = String(raw.title || "");
    const text = String(raw.text || "");
    const combined = `${title} ${text}`.trim();

    if (!isMonitoredPaymentPackage(pkg)) return;
    if (combined && !isIncomingPaymentNotificationText(combined)) return;

    const resolvedAmount =
      typeof raw.amount === "number" && raw.amount > 0
        ? Math.round(raw.amount)
        : extractNotificationRupiahAmount(combined) ?? 0;
    if (resolvedAmount <= 0) return;

    onPayment({
      packageName: pkg,
      title,
      text,
      amount: resolvedAmount,
      timestamp:
        typeof raw.timestamp === "number" && raw.timestamp > 0 ? raw.timestamp : Date.now(),
    });
  };

  const plugin = getPaymentAutoConfirmPlugin();
  if (plugin && typeof plugin.addListener === "function") {
    plugin
      .addListener("paymentNotificationReceived", (evt) => {
        deliverIfValid(evt);
      })
      .then((handle) => {
        if (disposed) {
          void handle?.remove?.();
        } else {
          listenerHandle = handle;
        }
      })
      .catch(() => {});
  }

  const handleWindowSimulation = (e: Event) => {
    const detail = (e as CustomEvent<PaymentNotificationEvent>).detail;
    deliverIfValid(detail);
  };
  window.addEventListener("paymentNotificationReceived", handleWindowSimulation);

  return () => {
    disposed = true;
    window.removeEventListener("paymentNotificationReceived", handleWindowSimulation);
    if (listenerHandle && typeof listenerHandle.remove === "function") {
      void listenerHandle.remove();
    }
  };
}
