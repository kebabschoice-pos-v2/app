import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/upload-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          const token = authHeader?.replace(/^Bearer\s+/i, "");

          if (!token) {
            return Response.json({ error: "Authorization token missing" }, { status: 401 });
          }

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey =
            process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabaseKey) {
            return Response.json({ error: "Supabase configuration missing" }, { status: 500 });
          }

          const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: authData, error: authError } = await authClient.auth.getUser(token);
          if (authError || !authData.user) {
            return Response.json({ error: "Session tidak valid" }, { status: 401 });
          }

          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          const businessId = formData.get("businessId") as string | null;

          if (!file || !businessId) {
            return Response.json(
              { error: "File logo dan Business ID wajib disertakan" },
              { status: 400 },
            );
          }

          if (!file.type.startsWith("image/")) {
            return Response.json(
              { error: "File harus berupa format gambar (PNG, JPG, WEBP, SVG)" },
              { status: 400 },
            );
          }

          const maxBytes = 5 * 1024 * 1024; // 5MB
          if (file.size > maxBytes) {
            return Response.json({ error: "Ukuran gambar logo maksimal 5MB" }, { status: 400 });
          }

          const rawExt = file.name.split(".").pop() || "png";
          const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
          const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

          const folderParam = (formData.get("folder") as string | null)?.toLowerCase().trim();
          let targetFolder = "logo";
          if (folderParam === "receipts" || folderParam === "receipt") {
            targetFolder = "receipts";
          } else if (folderParam === "menu") {
            targetFolder = "menu";
          }
          const filePath = `${businessId}/${targetFolder}/${filename}`;

          console.log("UPLOAD LOGO START:");
          console.log("UPLOAD PATH:", filePath);
          console.log("BUCKET:", "business-assets");
          console.log("USER ID:", authData.user.id);
          console.log("BUSINESS ID:", businessId);

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const { error: uploadError } = await supabaseAdmin.storage
            .from("business-assets")
            .upload(filePath, buffer, {
              contentType: file.type || "image/png",
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) {
            console.error("STORAGE RESPONSE: ERROR", uploadError);
            return Response.json({ error: uploadError.message }, { status: 500 });
          }

          const { data: publicData } = supabaseAdmin.storage
            .from("business-assets")
            .getPublicUrl(filePath);

          console.log("STORAGE RESPONSE: SUCCESS", publicData.publicUrl);

          return Response.json({
            success: true,
            publicUrl: publicData.publicUrl,
            filePath,
          });
        } catch (err) {
          console.error("[upload-logo] Unexpected error:", err);
          return Response.json(
            {
              error:
                err instanceof Error ? err.message : "Terjadi kesalahan internal saat upload logo",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
