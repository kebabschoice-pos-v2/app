import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  UploadCloud,
  ImageIcon,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  Globe,
  Tag,
  Building,
  DollarSign,
  Map,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  type BusinessProfile,
} from "@/services/business.service";

interface BusinessProfilePageProps {
  onRefresh?: () => void | Promise<void>;
}

export function BusinessProfilePage({ onRefresh }: BusinessProfilePageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getBusinessProfile();
      if (data) {
        setBusiness(data);
        setForm({
          business_name: String(data.business_name ?? data.name ?? ""),
          legal_name: String(data.legal_name ?? ""),
          business_category: String(data.business_category ?? data.category ?? "F&B / Restaurant"),
          address: String(data.address ?? ""),
          phone: String(data.phone ?? ""),
          email: String(data.email ?? ""),
          website: String(data.website ?? ""),
          city: String(data.city ?? "Jakarta"),
          currency: String(data.currency ?? "IDR"),
        });
      }
    } catch (error) {
      console.error("[BusinessProfilePage] Load error:", error);
      toast.error("Gagal memuat profil bisnis dari database");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WEBP, SVG)");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Ukuran logo tidak boleh melebihi 5MB");
      return;
    }

    setLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    toast.info("Logo baru dipilih. Klik 'Simpan Logo' untuk mengunggah.");
  }

  function handleCancelPreview() {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSaveLogoOnly() {
    if (!business?.id) {
      toast.error("Business ID tidak ditemukan");
      return;
    }
    if (!logoFile) {
      toast.error("Silakan pilih file logo terlebih dahulu");
      return;
    }

    setUploadingLogo(true);
    try {
      toast.info("Mengunggah logo ke Supabase Storage...");
      const publicUrl = await uploadBusinessLogo(business.id, logoFile);

      await updateBusinessProfile(business.id, { logo: publicUrl });
      const refreshed = await getBusinessProfile(business.id);

      setBusiness(refreshed);
      handleCancelPreview();
      toast.success("Logo bisnis berhasil diperbarui dan disimpan permanen!");

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("[BusinessProfilePage] Logo save error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan logo bisnis");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSaveAll() {
    if (!business?.id) {
      toast.error("Business ID tidak ditemukan");
      return;
    }

    setSaving(true);
    try {
      let finalLogoUrl = business.logo;

      // If user selected a new logo, upload it first
      if (logoFile) {
        toast.info("Mengunggah logo ke Supabase Storage...");
        finalLogoUrl = await uploadBusinessLogo(business.id, logoFile);
      }

      const payload = {
        ...form,
        logo: finalLogoUrl,
      };

      const updated = await updateBusinessProfile(business.id, payload);
      setBusiness(updated);
      setForm({
        business_name: String(updated.business_name ?? updated.name ?? ""),
        legal_name: String(updated.legal_name ?? ""),
        business_category: String(updated.business_category ?? updated.category ?? ""),
        address: String(updated.address ?? ""),
        phone: String(updated.phone ?? ""),
        email: String(updated.email ?? ""),
        website: String(updated.website ?? ""),
        city: String(updated.city ?? "Jakarta"),
        currency: String(updated.currency ?? "IDR"),
      });

      handleCancelPreview();
      toast.success("Informasi bisnis dan logo berhasil disimpan!");

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("[BusinessProfilePage] Save error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan perubahan bisnis");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin text-primary" />
          <span>Memuat data Business Profile...</span>
        </div>
      </div>
    );
  }

  const activeLogo = logoPreview || business?.logo;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header Banner */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-normal">Business Settings & Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola identitas usaha, logo merek, kontak, dan konfigurasi resmi bisnis Anda.
            </p>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={saving || uploadingLogo}
            className="rounded-2xl font-bold shadow-brand"
          >
            {saving ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Semua Perubahan"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Business Logo Management */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <ImageIcon className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Business Logo</h2>
          </div>

          <div className="mt-6 flex flex-col items-center text-center">
            {/* Logo Preview Frame */}
            <div className="relative flex size-36 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-muted/30 shadow-inner transition-all hover:border-primary/50">
              {activeLogo ? (
                <img src={activeLogo} alt="Business Logo" className="size-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-muted-foreground">
                  <Building2 className="size-10 text-muted-foreground/60" />
                  <span className="text-xs">Belum ada logo</span>
                </div>
              )}

              {logoPreview && (
                <div className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground shadow">
                  Preview Baru
                </div>
              )}
            </div>

            {/* Logo Status / Info */}
            <div className="mt-4">
              {business?.logo && !logoPreview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" />
                  Logo Tersimpan di Supabase
                </span>
              )}
              {logoPreview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
                  Pratinjau (Belum Tersimpan)
                </span>
              )}
            </div>

            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Action Buttons */}
            <div className="mt-5 flex w-full flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl gap-2 font-semibold"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo || saving}
              >
                <UploadCloud className="size-4 text-primary" />
                {business?.logo ? "Ganti Logo Bisnis" : "Pilih File Logo"}
              </Button>

              {logoPreview && (
                <div className="flex gap-2 w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-xl text-xs text-muted-foreground"
                    onClick={handleCancelPreview}
                    disabled={uploadingLogo || saving}
                  >
                    <X className="mr-1 size-3.5" />
                    Batal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 rounded-xl text-xs font-bold"
                    onClick={handleSaveLogoOnly}
                    disabled={uploadingLogo || saving}
                  >
                    {uploadingLogo ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      "Simpan Logo"
                    )}
                  </Button>
                </div>
              )}
            </div>

            <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
              Format didukung: PNG, JPG, WEBP, SVG. Maksimum ukuran file: 5MB. Logo akan ditampilkan
              di header aplikasi, struk, dan identitas bisnis.
            </p>
          </div>
        </section>

        {/* Right Column: Business Identity Form */}
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Building className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Business Identity</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Building2 className="size-3.5 text-primary" />
                Business Name <span className="text-destructive">*</span>
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. Kebabs Choice Studio"
                value={form.business_name || ""}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Building className="size-3.5 text-primary" />
                Legal / Company Name
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. PT Kebabs Choice Indonesia"
                value={form.legal_name || ""}
                onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Tag className="size-3.5 text-primary" />
                Business Category
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. Food & Beverage / Restaurant"
                value={form.business_category || ""}
                onChange={(e) => setForm({ ...form, business_category: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Map className="size-3.5 text-primary" />
                City / Kota
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. Jakarta"
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Phone className="size-3.5 text-primary" />
                Phone / WhatsApp
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. 081234567890"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Mail className="size-3.5 text-primary" />
                Business Email
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                type="email"
                placeholder="cth. info@kebabschoice.com"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <Globe className="size-3.5 text-primary" />
                Website
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. https://kebabschoice.com"
                value={form.website || ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <DollarSign className="size-3.5 text-primary" />
                Currency
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                placeholder="cth. IDR"
                value={form.currency || ""}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
                <MapPin className="size-3.5 text-primary" />
                Full Address / Alamat Usaha
              </label>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
                placeholder="cth. Jl. Sudirman No. 12, Senayan, Jakarta Selatan"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveAll}
              disabled={saving || uploadingLogo}
              className="rounded-xl font-bold shadow-brand"
            >
              {saving ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Business Identity"
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
