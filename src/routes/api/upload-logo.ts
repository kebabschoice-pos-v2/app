import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isUuid, requireBusinessAccess } from "@/lib/server-auth";

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function detectImageMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const Route = createFileRoute("/api/upload-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const access = await requireBusinessAccess(request);
          if (!access.ok) {
            return Response.json({ error: access.error }, { status: access.status });
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

          if (!isUuid(businessId)) {
            return Response.json({ error: "Business ID tidak valid" }, { status: 400 });
          }

          if (!access.businessIds.includes(businessId)) {
            return Response.json(
              { error: "Anda tidak memiliki akses ke bisnis ini" },
              { status: 403 },
            );
          }

          // SVG sengaja ditolak: hanya raster PNG/JPEG/WEBP yang diizinkan.
          const safeExt = ALLOWED_LOGO_TYPES[file.type];
          if (!safeExt) {
            return Response.json(
              { error: "Format logo harus PNG, JPEG, atau WEBP" },
              { status: 400 },
            );
          }

          const maxBytes = 5 * 1024 * 1024; // 5MB
          if (file.size > maxBytes) {
            return Response.json({ error: "Ukuran gambar logo maksimal 5MB" }, { status: 400 });
          }

          const buffer = Buffer.from(await file.arrayBuffer());
          if (detectImageMime(buffer) !== file.type) {
            return Response.json(
              { error: "Isi file tidak cocok dengan format gambar yang diizinkan" },
              { status: 400 },
            );
          }

          const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

          const folderParam = (formData.get("folder") as string | null)?.toLowerCase().trim();
          let targetFolder = "logo";
          if (folderParam === "receipts" || folderParam === "receipt") {
            targetFolder = "receipts";
          } else if (folderParam === "menu") {
            targetFolder = "menu";
          }
          const filePath = `${businessId}/${targetFolder}/${filename}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("business-assets")
            .upload(filePath, buffer, {
              contentType: file.type,
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
