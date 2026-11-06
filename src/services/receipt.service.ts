import { supabase } from "@/integrations/supabase/client";

export interface ReceiptSettings {
  id?: string;
  business_id: string;
  outlet_id?: string | null;
  store_name: string;
  business_name?: string;
  receipt_header: string;
  receipt_footer: string;
  logo_url?: string | null;
  show_business_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_tax: boolean;
  paper_size?: "58mm" | "80mm";
  address?: string;
  phone?: string;
  updated_at?: string;
}

export interface ReceiptSettingsInput {
  business_id?: string;
  outlet_id?: string | null;
  store_name: string;
  receipt_header: string;
  receipt_footer: string;
  logo_url?: string | null;
  show_business_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_tax: boolean;
  paper_size?: "58mm" | "80mm";
  address?: string;
  phone?: string;
}

/**
 * Helper to resolve active business ID from current session
 */
async function resolveActiveBusinessId(explicitBusinessId?: string): Promise<{
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
}> {
  if (explicitBusinessId) {
    const { data: b } = await supabase
      .from("businesses")
      .select("id, name, logo, address, phone")
      .eq("id", explicitBusinessId)
      .maybeSingle();

    if (b) return { id: b.id, name: b.name, logo: b.logo, address: b.address, phone: b.phone };
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    throw new Error("Sesi login tidak aktif. Silakan login kembali.");
  }

  // 1. Check owned businesses
  const { data: owned } = await supabase
    .from("businesses")
    .select("id, name, logo, address, phone")
    .eq("owner_id", authData.user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const firstOwned = owned?.[0];
  if (firstOwned) {
    return {
      id: firstOwned.id,
      name: firstOwned.name,
      logo: firstOwned.logo,
      address: firstOwned.address,
      phone: firstOwned.phone,
    };
  }

  // 2. Check business_members
  const { data: memberships } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const firstMember = memberships?.[0];
  if (firstMember) {
    const bid = firstMember.business_id;
    const { data: b } = await supabase
      .from("businesses")
      .select("id, name, logo, address, phone")
      .eq("id", bid)
      .maybeSingle();

    if (b) return { id: b.id, name: b.name, logo: b.logo, address: b.address, phone: b.phone };
  }

  throw new Error("Bisnis aktif tidak ditemukan untuk akun ini.");
}

/**
 * Get Receipt Settings for a business or specific outlet
 * Filters strictly by business_id
 */
export async function getReceiptSettings(
  businessId?: string,
  outletId?: string | null,
): Promise<ReceiptSettings> {
  try {
    const activeBus = await resolveActiveBusinessId(businessId);
    const targetBusinessId = activeBus.id;

    // Default template fallback values
    const defaultSettings: ReceiptSettings = {
      business_id: targetBusinessId,
      outlet_id: outletId || null,
      store_name: activeBus.name || "Kebab's Choice",
      business_name: activeBus.name || "Kebab's Choice",
      receipt_header: "Selamat datang di Kebab's Choice! Nikmati sajian kebab autentik kami.",
      receipt_footer: "Terima kasih atas kunjungan Anda. Kritik & Saran: wa.me/0859106660608",
      logo_url: activeBus.logo || null,
      show_business_name: true,
      show_address: true,
      show_phone: true,
      show_tax: true,
      paper_size: "58mm",
      address: activeBus.address || "Jl. Kebabs Raya No. 1, Jakarta",
      phone: activeBus.phone || "0859-1066-60608",
      updated_at: new Date().toISOString(),
    };

    // Method 1: Fetch via authenticated server API route (checks receipt_settings & outlets gracefully without browser 404)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const url = `/api/receipt-settings?businessId=${encodeURIComponent(targetBusinessId)}${
        outletId ? `&outletId=${encodeURIComponent(outletId)}` : ""
      }`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          console.log("RECEIPT FETCH TABLE:", json.sourceTable || "receipt_settings");
          console.log("DATABASE RESPONSE:", json.data);
          return json.data;
        }
      }
    } catch (apiErr) {
      console.warn("[receipt.service] API fetch route fallback to client outlet query:", apiErr);
    }

    // Method 2: Direct Client Fallback querying `outlets` table (NEVER queries missing tables to prevent 404)
    console.log("RECEIPT FETCH TABLE: outlets.settings");
    if (outletId) {
      const { data: outletData } = await supabase
        .from("outlets")
        .select("id, name, address, phone, settings")
        .eq("id", outletId)
        .eq("business_id", targetBusinessId)
        .maybeSingle();

      if (outletData) {
        const outletSettings = (outletData.settings as any)?.receipt;
        if (outletSettings) {
          const merged: ReceiptSettings = {
            ...defaultSettings,
            ...outletSettings,
            business_id: targetBusinessId,
            outlet_id: outletId,
            address: outletData.address || outletSettings.address || defaultSettings.address,
            phone: outletData.phone || outletSettings.phone || defaultSettings.phone,
          };
          console.log("DATABASE RESPONSE:", merged);
          return merged;
        }
        if (outletData.address) defaultSettings.address = outletData.address;
        if (outletData.phone) defaultSettings.phone = outletData.phone;
        if (outletData.name) defaultSettings.store_name = outletData.name;
      }
    } else {
      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, name, address, phone, settings")
        .eq("business_id", targetBusinessId)
        .order("created_at", { ascending: true })
        .limit(1);

      const firstOutlet = outlets?.[0];
      if (firstOutlet) {
        const o = firstOutlet;
        const outletSettings = (o.settings as any)?.receipt;
        if (outletSettings) {
          const merged: ReceiptSettings = {
            ...defaultSettings,
            ...outletSettings,
            business_id: targetBusinessId,
            outlet_id: null,
            address: o.address || outletSettings.address || defaultSettings.address,
            phone: o.phone || outletSettings.phone || defaultSettings.phone,
          };
          console.log("DATABASE RESPONSE:", merged);
          return merged;
        }
        if (o.address) defaultSettings.address = o.address;
        if (o.phone) defaultSettings.phone = o.phone;
      }
    }

    console.log("DATABASE RESPONSE:", defaultSettings);
    return defaultSettings;
  } catch (err) {
    console.error("[receipt.service] getReceiptSettings error:", err);
    throw err;
  }
}

/**
 * Update Receipt Settings for a business or specific outlet
 * Filters strictly by business_id
 */
export async function updateReceiptSettings(
  payload: Partial<ReceiptSettingsInput>,
): Promise<ReceiptSettings> {
  try {
    const activeBus = await resolveActiveBusinessId(payload.business_id);
    const targetBusinessId = activeBus.id;
    const targetOutletId = payload.outlet_id || null;

    const cleanPayload = {
      store_name: payload.store_name?.trim() || activeBus.name || "Kebab's Choice",
      receipt_header: payload.receipt_header?.trim() || "Selamat datang!",
      receipt_footer: payload.receipt_footer?.trim() || "Terima kasih sudah berbelanja.",
      logo_url: payload.logo_url ?? null,
      phone: payload.phone?.trim() || activeBus.phone || null,
      address: payload.address?.trim() || activeBus.address || null,
      show_business_name: payload.show_business_name !== false,
      show_address: payload.show_address !== false,
      show_phone: payload.show_phone !== false,
      show_tax: payload.show_tax !== false,
      paper_size: payload.paper_size || "58mm",
      updated_at: new Date().toISOString(),
    };

    console.log("RECEIPT SAVE PAYLOAD:", cleanPayload);

    // Method 1: Save via authenticated server API route (attempts receipt_settings + outlets.settings gracefully)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const res = await fetch("/api/receipt-settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            business_id: targetBusinessId,
            outlet_id: targetOutletId,
            ...cleanPayload,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            console.log("DATABASE RESPONSE:", "SUCCESS", json.data);
            return await getReceiptSettings(targetBusinessId, targetOutletId);
          }
        }
      }
    } catch (apiErr) {
      console.warn("[receipt.service] API save route fallback to client outlet update:", apiErr);
    }

    // Method 2: Direct Client Fallback updating `outlets.settings.receipt` by business_id
    if (targetOutletId) {
      const { data: curOutlet } = await supabase
        .from("outlets")
        .select("settings")
        .eq("id", targetOutletId)
        .eq("business_id", targetBusinessId)
        .single();

      const existingSettings = (curOutlet?.settings as any) || {};
      await supabase
        .from("outlets")
        .update({
          settings: {
            ...existingSettings,
            receipt: cleanPayload,
          },
          address: cleanPayload.address || existingSettings?.address,
          phone: cleanPayload.phone || existingSettings?.phone,
        })
        .eq("id", targetOutletId)
        .eq("business_id", targetBusinessId);
    } else {
      // Save across all outlets of this business as default
      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, settings")
        .eq("business_id", targetBusinessId);

      if (!outlets || outlets.length === 0) {
        await supabase.from("outlets").insert({
          business_id: targetBusinessId,
          name: cleanPayload.store_name || activeBus.name || "Main Outlet",
          code: "MAIN",
          settings: { receipt: cleanPayload },
          address: cleanPayload.address,
          phone: cleanPayload.phone,
        });
      } else {
        for (const o of outlets) {
          const existingSettings = (o.settings as any) || {};
          await supabase
            .from("outlets")
            .update({
              settings: {
                ...existingSettings,
                receipt: cleanPayload,
              },
              address: cleanPayload.address || existingSettings?.address,
              phone: cleanPayload.phone || existingSettings?.phone,
            })
            .eq("id", o.id)
            .eq("business_id", targetBusinessId);
        }
      }
    }

    console.log("DATABASE RESPONSE:", "SUCCESS", cleanPayload);

    // Return the updated normalized settings
    return await getReceiptSettings(targetBusinessId, targetOutletId);
  } catch (err) {
    console.error("[receipt.service] updateReceiptSettings error:", err);
    throw err;
  }
}

/**
 * Upload Receipt Logo to Supabase Storage
 * Target path structure: business-assets/{business_id}/receipts/{filename}
 */
export async function uploadReceiptLogo(file: File, businessId?: string): Promise<string> {
  const activeBus = await resolveActiveBusinessId(businessId);
  const targetBusinessId = activeBus.id;

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Format file tidak didukung. Harap gunakan format PNG, JPG, WEBP, atau SVG.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file logo struk maksimal 5MB.");
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || "anonymous";

  const rawExt = file.name.split(".").pop() || "png";
  const fileExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
  const filePath = `${targetBusinessId}/receipts/${fileName}`;

  console.log("UPLOAD LOGO START:");
  console.log("UPLOAD PATH:", filePath);
  console.log("BUCKET:", "business-assets");
  console.log("USER ID:", userId);
  console.log("BUSINESS ID:", targetBusinessId);

  // Method 1: Authenticated API endpoint via server admin (bypasses storage RLS safely)
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (token) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("businessId", targetBusinessId);
      formData.append("folder", "receipts");

      const res = await fetch("/api/upload-logo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.publicUrl) {
          console.log("STORAGE RESPONSE: SUCCESS", json.publicUrl);
          return json.publicUrl;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(
          "[uploadReceiptLogo] API route returned error, falling back to direct storage client:",
          errJson,
        );
      }
    }
  } catch (apiErr) {
    console.warn(
      "[uploadReceiptLogo] API route request failed, falling back to direct client storage:",
      apiErr,
    );
  }

  // Method 2: Direct Supabase Storage client
  const { error: uploadError } = await supabase.storage
    .from("business-assets")
    .upload(filePath, file, {
      contentType: file.type || "image/png",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("STORAGE RESPONSE: ERROR", uploadError);
    throw new Error(`Gagal mengunggah logo struk: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from("business-assets").getPublicUrl(filePath);

  console.log("STORAGE RESPONSE: SUCCESS", publicUrlData.publicUrl);
  return publicUrlData.publicUrl;
}
