import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SUPERVISOR_PINS = ["1234", "0000", "admin123"];

export interface VerifyPinResult {
  isValid: boolean;
  authorizedBy: string;
  source: "default" | "outlet" | "manager" | "staff";
  error?: string;
}

export interface CashShiftAdjustment {
  totalCashOut: number;
  expectedEndingCash: number;
}

/**
 * Verify supervisor / manager PIN with dynamic DB lookup and safe fallback to default PINs.
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

  const outletId = options?.outletId;
  const businessId = options?.businessId;

  // 1. Check Outlet-Specific Dynamic PIN from outlets.settings
  if (outletId && outletId !== "all" && !outletId.startsWith("out-temp")) {
    try {
      const { data: outlet } = await supabase
        .from("outlets")
        .select("id, name, settings")
        .eq("id", outletId)
        .maybeSingle();

      if (outlet?.settings && typeof outlet.settings === "object") {
        const settings = outlet.settings as Record<string, unknown>;
        const customPin = settings.supervisor_pin || settings.manager_pin || settings.pin;
        if (customPin && String(customPin).trim() === cleanPin) {
          return {
            isValid: true,
            authorizedBy: outlet.name ? `Supervisor (${outlet.name})` : "Supervisor Outlet",
            source: "outlet",
          };
        }
      }
    } catch (err) {
      console.warn("[verifySupervisorPin] Error checking outlet settings:", err);
    }
  }

  // 2. Check Staff Profiles for Outlet / Business Manager or Supervisor
  try {
    let staffQuery = supabase
      .from("staff_profiles")
      .select("id, full_name, role, phone, outlet_id, business_id")
      .in("role", ["manager", "supervisor", "admin", "owner"]);

    if (outletId && outletId !== "all") {
      staffQuery = staffQuery.eq("outlet_id", outletId);
    } else if (businessId) {
      staffQuery = staffQuery.eq("business_id", businessId);
    }

    const { data: staffList } = await staffQuery;

    if (staffList && staffList.length > 0) {
      // Check phone last 4 digits as quick supervisor PIN
      for (const staff of staffList) {
        const cleanPhone = (staff.phone || "").replace(/\D/g, "");
        if (cleanPhone.length >= 4 && cleanPhone.slice(-4) === cleanPin) {
          return {
            isValid: true,
            authorizedBy: `${staff.full_name} (${staff.role.toUpperCase()})`,
            source: "staff",
          };
        }
      }

      // Check default PIN fallback with real manager/supervisor name resolution
      if (DEFAULT_SUPERVISOR_PINS.includes(cleanPin)) {
        const manager = staffList.find(
          (s) =>
            s.role === "manager" ||
            s.role === "supervisor" ||
            s.role === "admin" ||
            s.role === "owner",
        );
        const authorizedBy = manager?.full_name
          ? `${manager.full_name} (${manager.role.toUpperCase()})`
          : "Supervisor";
        return {
          isValid: true,
          authorizedBy,
          source: "default",
        };
      }
    }
  } catch (err) {
    console.warn("[verifySupervisorPin] Error querying staff profiles:", err);
  }

  // 3. Guaranteed Default Fallback PINs (1234, 0000, admin123)
  if (DEFAULT_SUPERVISOR_PINS.includes(cleanPin)) {
    return {
      isValid: true,
      authorizedBy: "Supervisor",
      source: "default",
    };
  }

  return {
    isValid: false,
    authorizedBy: "",
    source: "default",
    error: "PIN Supervisor tidak valid! (Default PIN: 1234)",
  };
}

/**
 * Configure or update supervisor PIN for an outlet in database
 */
export async function setOutletSupervisorPin(
  outletId: string,
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
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
      supervisor_pin: newPin.trim(),
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
