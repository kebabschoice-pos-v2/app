import { registerPlugin } from "@capacitor/core";

/**
 * Jembatan ke plugin native Android `WhatsAppLauncher` (aktif di dalam .apk Capacitor).
 * Di web/PWA fungsi-fungsi ini aman dipanggil tanpa efek samping.
 */

export interface OpenWhatsAppOptions {
  package?: "auto" | "com.whatsapp" | "com.whatsapp.w4b";
  clearTask?: boolean;
}

export interface OpenWhatsAppResult {
  opened: boolean;
  package?: string;
}

interface WhatsAppLauncherPlugin {
  openWhatsApp(options?: OpenWhatsAppOptions): Promise<OpenWhatsAppResult>;
  isInstalled(): Promise<{ whatsapp: boolean; whatsappBusiness: boolean }>;
}

type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: {
      WhatsAppLauncher?: WhatsAppLauncherPlugin;
    };
  };
};

const WhatsAppLauncher = registerPlugin<WhatsAppLauncherPlugin>("WhatsAppLauncher");

export function isCapacitorAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  return !!cap?.isNativePlatform?.() && (cap.getPlatform?.() ?? "android") === "android";
}

/** Buka HALAMAN UTAMA (daftar chat) WhatsApp secara instan (1 tap) via plugin native. */
export async function openWhatsAppHomeNative(
  preferredPackage: "auto" | "com.whatsapp" | "com.whatsapp.w4b" = "auto",
): Promise<OpenWhatsAppResult> {
  try {
    const directPlugin =
      typeof window !== "undefined"
        ? (window as unknown as CapacitorWindow).Capacitor?.Plugins?.WhatsAppLauncher
        : undefined;
    const plugin = directPlugin ?? WhatsAppLauncher;
    return await plugin.openWhatsApp({ package: preferredPackage });
  } catch {
    return { opened: false };
  }
}
