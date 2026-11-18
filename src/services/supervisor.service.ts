import { supabase } from "@/integrations/supabase/client";

/**
 * Local mirror of the PIN saved by the Owner from the Security settings page.
 * It is never a default — it only exists once the Owner has actually set a PIN.
 */
export const SUPERVISOR_PIN_STORAGE_KEY = "kebabschoicepos_supervisor_pin";

const PIN_PATTERN = /^\d{4,6}$/;

export interface VerifyPinResult {
  isValid: boolean;
  authorizedBy: string;
  source: "outlet" | "local" | "default";
  error?: string;
}

export interface CashShiftAdjustment {
  totalCashOut: number;
  expectedEndingCash: number;
}

function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function readLocalSupervisorPin(): string {
  try {
    if (typeof localStorage === "undefined") return "";
    return String(localStorage.getItem(SUPERVISOR_PIN_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function readOutletSupervisorPin(settings: unknown): string {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
  const record = settings as Record<string, unknown>;
  const raw = record.supervisor_pin ?? record.manager_pin ?? record.pin;
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

/**
 * Verifies the supervisor / manager PIN against the PIN configured by the Owner.
 *
 * There are no default or hardcoded PINs: the only accepted values are the PIN saved
 * in outlets.settings (per outlet) or, when no outlet PIN exists, the PIN saved on this
 * device from the Security settings page. When nothing has been configured the caller
 * is told to set a PIN first at /security.
 */
export async function verifySupervisorPin(
  pin: string,
  options?: {
    outletId?: string | null;
    businessId?: string | null;
  },
): Promise<VerifyPinResult> {
  const cleanPin = (pin || "").trim();
  if (!cleanPin) {
    return {
      isValid: false,
      authorizedBy: "",
      source: "default",
      error: "PIN Supervisor wajib diisi.",
    };
  }

  if (!isValidPinFormat(cleanPin)) {
    return {
      isValid: false,
      authorizedBy: "",
      source: "default",
      error: "Format PIN Supervisor tidak valid (4 - 6 digit angka).",
    };
  }

  const outletId = options?.outletId;
  let outletPin = "";
  let outletName = "";

  // 1. PIN saved by the Owner on the outlet (outlets.settings.supervisor_pin).
  if (outletId && outletId !== "all" && !outletId.startsWith("out-temp")) {
    try {
      const { data: outlet } = await supabase
        .from("outlets")
        .select("id, name, settings")
        .eq("id", outletId)
        .maybeSingle();

      outletPin = readOutletSupervisorPin(outlet?.settings);
      outletName = outlet?.name || "";
    } catch (err) {
      console.warn("[verifySupervisorPin] Error checking outlet settings:", err);
    }
  }

  if (outletPin) {
    if (outletPin === cleanPin) {
      return {
        isValid: true,
        authorizedBy: outletName ? `Supervisor (${outletName})` : "Supervisor Outlet",
        source: "outlet",
      };
    }
    return {
      isValid: false,
      authorizedBy: "",
      source: "default",
      error: "PIN Supervisor tidak valid.",
    };
  }

  // 2. No outlet PIN configured — fall back to the PIN this device saved from /security.
  const localPin = readLocalSupervisorPin();
  if (localPin) {
    if (localPin === cleanPin) {
      return {
        isValid: true,
        authorizedBy: "Supervisor (Pengaturan Keamanan)",
        source: "local",
      };
    }
    return {
      isValid: false,
      authorizedBy: "",
      source: "default",
      error: "PIN Supervisor tidak valid.",
    };
  }

  // 3. Nothing configured yet — never accept a guessable default.
  return {
    isValid: false,
    authorizedBy: "",
    source: "default",
    error:
      "PIN Supervisor belum diatur. Atur PIN terlebih dahulu di menu Keamanan (/security).",
  };
}

/**
 * Configure or update supervisor PIN for an outlet in database
 */
export async function setOutletSupervisorPin(
  outletId: string,
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanPin = (newPin || "").trim();

  if (!outletId) {
    return { success: false, error: "Outlet belum dipilih" };
  }

  if (!isValidPinFormat(cleanPin)) {
    return { success: false, error: "PIN Supervisor harus 4 - 6 digit angka" };
  }

  try {
    const { data: outlet, error: fetchErr } = await supabase
      .from("outlets")
      .select("settings")
      .eq("id", outletId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    const existingSettings =
      (outlet?.settings && typeof outlet.settings === "object"
        ? (outlet.settings as Record<string, unknown>)
        : {}) || {};

    const updatedSettings = {
      ...existingSettings,
      supervisor_pin: cleanPin,
    };

    const { error: updateErr } = await supabase
      .from("outlets")
      .update({ settings: updatedSettings as any })
      .eq("id", outletId);

    if (updateErr) throw updateErr;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menyimpan PIN outlet" };
  }
}
