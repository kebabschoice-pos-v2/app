import { supabase } from "@/integrations/supabase/client";

export interface BusinessProfile {
  id: string;
  owner_id?: string;
  name?: string;
  business_name?: string;
  category?: string;
  business_category?: string;
  currency?: string;
  city?: string;
  ai_tone?: string;
  legal_name?: string | null;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export async function getBusinessProfile(businessId?: string): Promise<BusinessProfile> {
  let targetBusinessId = businessId;

  // Resolve businessId from active user session if not explicitly provided
  if (!targetBusinessId) {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: member } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (member?.business_id) {
        targetBusinessId = member.business_id;
      } else {
        const { data: owned } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", authData.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (owned?.id) {
          targetBusinessId = owned.id;
        }
      }
    }
  }

  let query = (supabase.from("businesses" as any) as any).select("*");

  if (targetBusinessId) {
    query = query.eq("id", targetBusinessId);
  } else {
    query = query.limit(1);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error("[getBusinessProfile] Error fetching business profile:", error);
    throw new Error(error.message);
  }

  const raw = data as Record<string, unknown>;

  return {
    ...raw,
    id: raw.id as string,
    business_name: (raw.name as string) ?? (raw.business_name as string) ?? "",
    business_category: (raw.business_category as string) ?? (raw.category as string) ?? "",
    logo: (raw.logo as string | null) ?? null,
    legal_name: (raw.legal_name as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    website: (raw.website as string | null) ?? null,
  };
}

export async function updateBusinessProfile(
  businessId: string,
  payload: Record<string, unknown>,
): Promise<BusinessProfile> {
  if (!businessId) {
    console.error("BUSINESS UPDATE ERROR: business_id kosong", businessId);
    throw new Error("Business ID tidak ditemukan");
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Map business_name <-> name
  if (payload.business_name !== undefined) {
    updatePayload.name = payload.business_name;
  } else if (payload.name !== undefined) {
    updatePayload.name = payload.name;
  }

  // Map business_category <-> category
  if (payload.business_category !== undefined) {
    updatePayload.category = payload.business_category;
    updatePayload.business_category = payload.business_category;
  } else if (payload.category !== undefined) {
    updatePayload.category = payload.category;
    updatePayload.business_category = payload.category;
  }

  if (payload.legal_name !== undefined) updatePayload.legal_name = payload.legal_name;
  if (payload.logo !== undefined) updatePayload.logo = payload.logo;
  if (payload.address !== undefined) updatePayload.address = payload.address;
  if (payload.phone !== undefined) updatePayload.phone = payload.phone;
  if (payload.email !== undefined) updatePayload.email = payload.email;
  if (payload.website !== undefined) updatePayload.website = payload.website;
  if (payload.city !== undefined) updatePayload.city = payload.city;
  if (payload.currency !== undefined) updatePayload.currency = payload.currency;
  if (payload.ai_tone !== undefined) updatePayload.ai_tone = payload.ai_tone;

  console.log("BUSINESS ID:", businessId);
  console.log("UPDATE PAYLOAD:", updatePayload);

  const { data, error } = await supabase
    .from("businesses")
    .update(updatePayload as any)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) {
    console.error("BUSINESS UPDATE ERROR:", error);
    throw error;
  }

  console.log("SUPABASE RESULT: SUCCESS", data);

  // Single Source Of Truth: Fetch fresh profile from Supabase
  const refreshed = await getBusinessProfile(businessId);
  return refreshed;
}

export async function uploadBusinessLogo(businessId: string, file: File): Promise<string> {
  if (!businessId) throw new Error("Business ID tidak ditemukan");

  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG, JPG, WEBP, SVG)");
  }

  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxBytes) {
    throw new Error("Ukuran logo maksimal 5MB");
  }

  // Attempt 1: Server endpoint /api/upload-logo using service role
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (token) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("businessId", businessId);

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
          console.log("[uploadBusinessLogo] Uploaded via API route:", json.publicUrl);
          return json.publicUrl;
        }
      } else {
        const json = await res.json().catch(() => ({}));
        console.warn("[uploadBusinessLogo] API upload responded with error:", json);
      }
    }
  } catch (err) {
    console.warn(
      "[uploadBusinessLogo] API upload failed, falling back to direct storage client:",
      err,
    );
  }

  // Attempt 2: Direct Supabase Storage client
  const extension =
    (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const filePath = `${businessId}/logo/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("business-assets")
    .upload(filePath, file, {
      contentType: file.type || "image/png",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("[uploadBusinessLogo] Direct upload error:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from("business-assets").getPublicUrl(filePath);

  console.log("[uploadBusinessLogo] Uploaded via client:", data.publicUrl);
  return data.publicUrl;
}
