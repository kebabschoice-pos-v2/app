import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Banknote,
  QrCode,
  Building,
  Upload,
  Trash2,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyQrisConversionMode,
  convertStaticQrisToDynamic,
  isTemporaryDynamicQrisPayload,
  normalizeQrisConversionMode,
  normalizeQrisPayload,
  validateQrisPayload,
  type QrisConversionMode,
} from "@/lib/qris-emv";

const QRIS_MODE_OPTIONS: Array<{
  value: QrisConversionMode;
  title: string;
  badge: string;
  description: string;
}> = [
  {
    value: "static_with_amount",
    title: "Kompatibel ShopeePay (010211 + Nominal)",
    badge: "Disarankan Shopee Partner",
    description:
      "Pertahankan tag statis 010211 + sisipkan tag 54 nominal + hitung ulang CRC16 agar tidak ditolak server acquirer sebagai pesanan kedaluwarsa.",
  },
  {
    value: "static_raw",
    title: "QRIS Statis Murni (Tanpa Modifikasi)",
    badge: "100% Semua E-Wallet & Bank",
    description:
      "Tampilkan gambar/payload QRIS Statis asli apa adanya tanpa ubah tag apa pun. Pelanggan ketik nominal sesuai tagihan kasir.",
  },
  {
    value: "dynamic_010212",
    title: "Nominal Otomatis Dinamis (010212)",
    badge: "EMVCo Dynamic",
    description:
      "Ubah tag 010211 menjadi 010212 + sisipkan tag 54 nominal + CRC16 baru (gunakan bila penyedia QRIS toko menerima konversi dinamis lokal).",
  },
];

/**
 * Resize large uploaded QRIS photos/screenshots so they fit cleanly in localStorage (<5MB limit)
 * and Supabase JSONB `outlets.settings` while keeping QR modules crisp.
 */
async function compressQrImageDataUrl(rawDataUrl: string, maxDim = 720): Promise<string> {
  if (typeof document === "undefined" || rawDataUrl.length < 180_000) {
    return rawDataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.88);
        resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export function PaymentSettingsPage() {
  const [cashEnabled, setCashEnabled] = useState(true);
  const [qrisEnabled, setQrisEnabled] = useState(true);
  const [qrisNmid, setQrisNmid] = useState("");
  const [qrisStaticImageUrl, setQrisStaticImageUrl] = useState("");
  // Raw static QRIS text (e.g. Shopee Partner) -> processed according to qrisConversionMode at /pos
  const [qrisStaticPayload, setQrisStaticPayload] = useState("");
  const [qrisConversionMode, setQrisConversionMode] =
    useState<QrisConversionMode>("static_with_amount");
  const [isDecodingQris, setIsDecodingQris] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [bankName, setBankName] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("1234567890");
  const [accountHolder, setAccountHolder] = useState("PT Kebabs Choice POS");

  const cleanNormalizedPayload = useMemo(
    () => normalizeQrisPayload(qrisStaticPayload),
    [qrisStaticPayload],
  );

  const isTempDynamicPayload = useMemo(
    () => isTemporaryDynamicQrisPayload(cleanNormalizedPayload),
    [cleanNormalizedPayload],
  );

  const payloadCheck = useMemo(() => {
    if (!cleanNormalizedPayload) return null;
    const validation = validateQrisPayload(cleanNormalizedPayload);
    let sample = "";
    if (validation.ok) {
      try {
        sample =
          qrisConversionMode === "dynamic_010212"
            ? convertStaticQrisToDynamic(cleanNormalizedPayload, 10000)
            : applyQrisConversionMode(cleanNormalizedPayload, 10000, qrisConversionMode);
      } catch {
        sample = "";
      }
    }
    return { ...validation, sample };
  }, [cleanNormalizedPayload, qrisConversionMode]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = localStorage.getItem("kebabschoicepos_payment_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.cashEnabled === "boolean") setCashEnabled(parsed.cashEnabled);
          if (typeof parsed.qrisEnabled === "boolean") setQrisEnabled(parsed.qrisEnabled);
          const localNmid = parsed.qrisNmid || parsed.nmid;
          if (typeof localNmid === "string") setQrisNmid(localNmid);
          const localStaticImg =
            parsed.qris_static_image_url ||
            parsed.qrisStaticImageUrl ||
            parsed.staticQrisImageUrl ||
            parsed.static_qris_image_url ||
            parsed.qrisImageUrl;
          if (localStaticImg) setQrisStaticImageUrl(localStaticImg);
          const localPayload = parsed.qris_static_payload || parsed.qrisStaticPayload;
          if (typeof localPayload === "string" && localPayload) {
            setQrisStaticPayload(localPayload);
          }
          if (parsed.qris_conversion_mode || parsed.qrisConversionMode) {
            setQrisConversionMode(
              normalizeQrisConversionMode(
                parsed.qris_conversion_mode || parsed.qrisConversionMode,
                "static_with_amount",
              ),
            );
          }
          if (typeof parsed.cardEnabled === "boolean") setCardEnabled(parsed.cardEnabled);
          if (typeof parsed.transferEnabled === "boolean") setTransferEnabled(parsed.transferEnabled);
          if (parsed.bankName) setBankName(parsed.bankName);
          if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
          if (parsed.accountHolder) setAccountHolder(parsed.accountHolder);
        }

        // Check Supabase outlets.settings (+ payment_settings, qris_static_payload, qris_conversion_mode)
        const activeBizId =
          typeof window !== "undefined"
            ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
            : "";
        let outletsQuery = supabase.from("outlets").select("id, business_id, settings");
        if (activeBizId) {
          outletsQuery = outletsQuery.eq("business_id", activeBizId);
        }
        const { data: outletsData } = await outletsQuery.limit(15);
        if (outletsData && Array.isArray(outletsData) && outletsData.length > 0) {
          // Utamakan outlet yang sudah memiliki konfigurasi QRIS / payment_settings
          const prioritized =
            outletsData.find((out) => {
              const s = (out.settings as any) || {};
              return Boolean(
                s.qris_static_payload ||
                  s.qris_static_image_url ||
                  s.payment_settings?.qrisStaticPayload ||
                  s.payment_settings?.qrisStaticImageUrl,
              );
            }) ||
            outletsData.find((out) => Boolean((out.settings as any)?.payment_settings)) ||
            outletsData[0];

          if (prioritized) {
            const s = (prioritized.settings as any) || {};
            const payConf = s.payment_settings || {};
            if (typeof payConf.cashEnabled === "boolean") setCashEnabled(payConf.cashEnabled);
            if (typeof payConf.qrisEnabled === "boolean") setQrisEnabled(payConf.qrisEnabled);
            const remoteNmid = s.nmid ?? payConf.qrisNmid ?? payConf.nmid;
            if (typeof remoteNmid === "string") setQrisNmid(remoteNmid);
            const remoteStaticImg =
              s.qris_static_image_url ??
              payConf.qris_static_image_url ??
              payConf.qrisStaticImageUrl ??
              payConf.staticQrisImageUrl ??
              payConf.static_qris_image_url ??
              payConf.qrisImageUrl;
            if (typeof remoteStaticImg === "string") setQrisStaticImageUrl(remoteStaticImg);
            const remotePayload =
              s.qris_static_payload ??
              payConf.qris_static_payload ??
              payConf.qrisStaticPayload;
            if (typeof remotePayload === "string") setQrisStaticPayload(remotePayload);
            const remoteConvMode =
              s.qris_conversion_mode ??
              payConf.qris_conversion_mode ??
              payConf.qrisConversionMode;
            if (remoteConvMode) {
              setQrisConversionMode(
                normalizeQrisConversionMode(remoteConvMode, "static_with_amount"),
              );
            }
            if (typeof payConf.cardEnabled === "boolean") setCardEnabled(payConf.cardEnabled);
            if (typeof payConf.transferEnabled === "boolean") {
              setTransferEnabled(payConf.transferEnabled);
            }
            if (payConf.bankName) setBankName(payConf.bankName);
            if (payConf.accountNumber) setAccountNumber(payConf.accountNumber);
            if (payConf.accountHolder) setAccountHolder(payConf.accountHolder);
          }
        }
      } catch (e) {
        console.error("[PaymentSettingsPage] Load error:", e);
      }
    }
    void loadSettings();
  }, []);

  const tryAutoDecodeQris = async (imageSrc: string) => {
    setIsDecodingQris(true);
    try {
      const { decodeQrFromImage } = await import("@/lib/qr-tools");
      const decoded = normalizeQrisPayload(await decodeQrFromImage(imageSrc));
      if (decoded && isTemporaryDynamicQrisPayload(decoded)) {
        setQrisStaticPayload(decoded);
        toast.warning(
          "QR ini adalah QR Dinamis sementara (kedaluwarsa dalam 20 menit). Gunakan QRIS Statis permanen (000201010211...).",
        );
      } else if (decoded && validateQrisPayload(decoded).ok) {
        setQrisStaticPayload(decoded);
        toast.success("Payload QRIS Statis berhasil dibaca otomatis dari gambar", {
          description: "Klik Simpan Perubahan untuk menerapkan ke kasir POS.",
        });
      } else if (decoded) {
        setQrisStaticPayload(decoded);
        toast.warning("QR terbaca, tetapi struktur QRIS tidak standar. Periksa kembali teksnya.");
      } else {
        toast.info(
          "Payload teks tidak terbaca otomatis dari gambar — Anda tetap bisa menyimpan gambar QRIS atau menempel teks manual.",
        );
      }
    } catch (err) {
      console.warn("[QRIS] Auto-decode gagal:", err);
      toast.info(
        "Payload teks tidak terbaca otomatis — gambar QRIS tetap siap disimpan (klik Simpan Perubahan).",
      );
    } finally {
      setIsDecodingQris(false);
    }
  };

  const handleUploadQrisImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar (PNG / JPG / WEBP) untuk QRIS Statis.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const rawResult = typeof reader.result === "string" ? reader.result : "";
      if (!rawResult) return;
      // Baca QR dari resolusi penuh terlebih dahulu, lalu kompres gambar agar hemat memori & cepat disimpan
      void tryAutoDecodeQris(rawResult);
      const optimized = await compressQrImageDataUrl(rawResult);
      setQrisStaticImageUrl(optimized);
      toast.success("Gambar QRIS siap disimpan — klik Simpan Perubahan.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const persistModeImmediately = async (nextMode: QrisConversionMode) => {
    setQrisConversionMode(nextMode);
    try {
      const prevRaw = localStorage.getItem("kebabschoicepos_payment_settings");
      const prev = prevRaw ? JSON.parse(prevRaw) : {};
      localStorage.setItem(
        "kebabschoicepos_payment_settings",
        JSON.stringify({
          ...prev,
          qris_conversion_mode: nextMode,
          qrisConversionMode: nextMode,
        }),
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("payment:updated"));
      }
    } catch {}
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const cleanPayload = normalizeQrisPayload(qrisStaticPayload);
      const trimmedNmid = qrisNmid.trim();
      const trimmedImageUrl = qrisStaticImageUrl.trim();

      // NMID 100% opsional! Hanya validasi struktur TLV jika user mengisi teks payload QRIS dan bukan mode static_raw murni bergambar
      if (cleanPayload && !validateQrisPayload(cleanPayload).ok) {
        const validationErr = validateQrisPayload(cleanPayload).error;
        toast.error("Payload Teks QRIS tidak valid", {
          description: `${validationErr || "Periksa format teks QRIS"} Kosongkan kolom teks jika hanya ingin memakai gambar QRIS Statis.`,
        });
        return;
      }

      const effectiveQrisMode =
        trimmedImageUrl || cleanPayload
          ? "static"
          : trimmedNmid
            ? "dynamic"
            : "static";

      const data = {
        cashEnabled,
        qrisEnabled,
        qrisNmid: trimmedNmid,
        nmid: trimmedNmid,
        qrisStaticImageUrl: trimmedImageUrl,
        qris_static_image_url: trimmedImageUrl,
        qrisStaticPayload: cleanPayload,
        qris_static_payload: cleanPayload,
        qris_mode: effectiveQrisMode,
        qrisMode: effectiveQrisMode,
        qris_conversion_mode: qrisConversionMode,
        qrisConversionMode,
        cardEnabled,
        transferEnabled,
        bankName,
        accountNumber,
        accountHolder,
      };

      // Simpan ke localStorage dengan proteksi penuh terhadap QuotaExceededError
      try {
        localStorage.setItem("kebabschoicepos_payment_settings", JSON.stringify(data));
      } catch (storageErr) {
        console.warn("[PaymentSettings] localStorage penuh, menyimpan versi ringkas:", storageErr);
        try {
          const compactData = {
            ...data,
            qrisStaticImageUrl: trimmedImageUrl.length > 350_000 ? "" : trimmedImageUrl,
            qris_static_image_url: trimmedImageUrl.length > 350_000 ? "" : trimmedImageUrl,
          };
          localStorage.setItem("kebabschoicepos_payment_settings", JSON.stringify(compactData));
        } catch {}
      }

      // Simpan ke Supabase outlets.settings (semua outlet milik bisnis aktif)
      let updatedCount = 0;
      let supabaseErrMsg = "";
      try {
        const activeBizId =
          typeof window !== "undefined"
            ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
            : "";

        let outletsQuery = supabase.from("outlets").select("id, business_id, settings");
        if (activeBizId) {
          outletsQuery = outletsQuery.eq("business_id", activeBizId);
        }
        let { data: allOutlets, error: fetchErr } = await outletsQuery;
        if (fetchErr || !allOutlets || allOutlets.length === 0) {
          const fallbackRes = await supabase.from("outlets").select("id, business_id, settings");
          allOutlets = fallbackRes.data || [];
        }

        if (allOutlets && Array.isArray(allOutlets)) {
          for (const out of allOutlets) {
            const curr =
              out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
                ? (out.settings as Record<string, any>)
                : {};
            const prevPay =
              curr.payment_settings && typeof curr.payment_settings === "object"
                ? curr.payment_settings
                : {};

            const { error: updErr } = await supabase
              .from("outlets")
              .update({
                settings: {
                  ...curr,
                  qris_static_image_url: trimmedImageUrl,
                  qris_static_payload: cleanPayload,
                  qris_mode: effectiveQrisMode,
                  qris_conversion_mode: qrisConversionMode,
                  nmid: trimmedNmid,
                  payment_settings: {
                    ...prevPay,
                    ...data,
                    staticQrisImageUrl: trimmedImageUrl,
                  },
                } as any,
              })
              .eq("id", out.id);

            if (updErr) {
              supabaseErrMsg = updErr.message;
            } else {
              updatedCount++;
            }
          }
        }
      } catch (sbErr: any) {
        supabaseErrMsg = sbErr?.message || "Gangguan jaringan";
        console.warn("[PaymentSettings] Supabase sync warning:", sbErr);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("payment:updated"));
      }

      const activeModeLabel =
        QRIS_MODE_OPTIONS.find((m) => m.value === qrisConversionMode)?.title || qrisConversionMode;

      if (updatedCount > 0) {
        toast.success("Perubahan pengaturan pembayaran berhasil disimpan!", {
          description: `Tersinkron ke ${updatedCount} outlet • Mode QRIS: ${activeModeLabel}.`,
        });
      } else if (supabaseErrMsg) {
        toast.success("Pengaturan pembayaran tersimpan di perangkat ini", {
          description: `Sinkronisasi cloud tertunda (${supabaseErrMsg}), tetapi POS siap digunakan.`,
        });
      } else {
        toast.success("Perubahan pengaturan pembayaran berhasil disimpan!", {
          description: `Mode QRIS aktif: ${activeModeLabel}.`,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Metode Pembayaran</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Atur opsi metode pembayaran yang tersedia di POS kasir: Tunai, QRIS, Kartu Debit/Kredit,
            dan Transfer Bank.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-2xl font-bold shadow-brand gap-2 shrink-0 cursor-pointer"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan"}</span>
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Tunai / Cash */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Banknote className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Uang Tunai (Cash)</h2>
                <p className="text-xs text-muted-foreground">
                  Pembayaran tunai langsung dengan kalkulasi uang kembali kasir.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cashEnabled}
                onChange={(e) => setCashEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{cashEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>
        </div>

        {/* QRIS */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <QrCode className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">QRIS Standar Nasional</h2>
                <p className="text-xs text-muted-foreground">
                  Mendukung GoPay, OVO, ShopeePay, DANA, BCA, Livin, dsb.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={qrisEnabled}
                onChange={(e) => setQrisEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{qrisEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>

          {qrisEnabled && (
            <div className="pt-3 border-t border-border grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  National Merchant ID (NMID) — Opsional
                </label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={qrisNmid}
                  onChange={(e) => setQrisNmid(e.target.value)}
                  placeholder="Opsional (kosongkan jika memakai QRIS Statis / Shopee Partner)"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  NMID bersifat opsional. Jika memakai QRIS Statis toko / Shopee Partner, biarkan
                  kosong lalu unggah gambar atau tempel teks QRIS Statis di bawah.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Gambar QRIS Statis Resmi Toko (Opsional)
                </label>
                <div className="mt-1.5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/70 hover:bg-secondary px-3 text-xs font-bold text-foreground cursor-pointer transition-colors">
                      <Upload className="size-3.5 text-primary" />
                      <span>
                        {qrisStaticImageUrl ? "Ganti Gambar QRIS" : "Unggah Gambar QRIS Statis"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadQrisImage}
                        className="sr-only"
                      />
                    </label>
                    {qrisStaticImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQrisStaticImageUrl("")}
                        className="h-9 rounded-xl text-xs font-bold text-destructive hover:text-destructive gap-1"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Hapus</span>
                      </Button>
                    )}
                  </div>
                  {qrisStaticImageUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-2.5">
                      <img
                        src={qrisStaticImageUrl}
                        alt="Pratinjau QRIS Statis Toko"
                        className="size-20 rounded-lg border border-border bg-white object-contain p-1 shrink-0"
                      />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-foreground">Gambar QRIS Statis Siap</p>
                        <p className="text-muted-foreground">
                          Digunakan langsung saat memilih mode <strong>QRIS Statis Murni</strong> atau
                          sebagai cadangan otomatis di `/pos`.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Unggah foto/poster QRIS Statis permanen toko Anda (cth. cetakan QRIS Shopee
                      Partner / Bank).
                    </p>
                  )}
                </div>
              </div>

              {/* Pilihan Mode QRIS Toko (Anti-Kedaluwarsa ShopeePay) */}
              <div className="sm:col-span-2 space-y-2.5 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="text-xs font-black text-foreground">
                      Mode QRIS Toko (`qris_conversion_mode`)
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Jika muncul kendala di e-wallet tertentu, beralih ke{" "}
                    <strong>QRIS Statis Murni</strong> dalam 1 klik.
                  </span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {QRIS_MODE_OPTIONS.map((opt) => {
                    const selected = qrisConversionMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => void persistModeImmediately(opt.value)}
                        className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          selected
                            ? "border-primary bg-primary/10 shadow-xs"
                            : "border-border bg-background hover:bg-secondary/50"
                        }`}
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                              {opt.badge}
                            </span>
                            {selected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                          </div>
                          <p className="text-xs font-black text-foreground pt-1">{opt.title}</p>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payload Teks QRIS Statis -> QRIS dengan nominal otomatis */}
              <div className="sm:col-span-2 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="qris-static-payload"
                    className="text-xs font-bold text-foreground/80"
                  >
                    Payload Teks QRIS Statis (Untuk Nominal Otomatis)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {qrisStaticImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDecodingQris}
                        onClick={() => void tryAutoDecodeQris(qrisStaticImageUrl)}
                        className="h-8 rounded-lg text-xs font-bold gap-1"
                      >
                        {isDecodingQris ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ScanLine className="size-3.5" />
                        )}
                        <span>Baca dari Gambar</span>
                      </Button>
                    )}
                    {qrisStaticPayload && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setQrisStaticPayload("")}
                        className="h-8 rounded-lg text-xs font-bold text-destructive hover:text-destructive"
                      >
                        Kosongkan
                      </Button>
                    )}
                  </div>
                </div>
                <textarea
                  id="qris-static-payload"
                  value={qrisStaticPayload}
                  onChange={(e) => setQrisStaticPayload(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  placeholder="00020101021126...5802ID59...6304XXXX (otomatis terisi saat gambar QRIS Statis diunggah, atau tempel manual)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground break-all focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Peringatan Kuning Wajib jika user memasukkan QR Dinamis Sementara (000201010212...) */}
                {isTempDynamicPayload && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 text-xs font-bold text-amber-900 dark:text-amber-200"
                  >
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      QR ini adalah QR Dinamis sementara (kedaluwarsa dalam 20 menit). Gunakan QRIS
                      Statis permanen (000201010211...).
                    </span>
                  </div>
                )}

                {payloadCheck ? (
                  payloadCheck.ok ? (
                    <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
                      <span>
                        Payload QRIS valid
                        {payloadCheck.merchantName ? ` • ${payloadCheck.merchantName}` : ""}
                        {payloadCheck.merchantCity ? ` (${payloadCheck.merchantCity})` : ""}
                        {payloadCheck.isStatic
                          ? " • Statis Permanen (010211)"
                          : payloadCheck.isDynamic
                            ? " • Dinamis (010212)"
                            : ""}
                        {payloadCheck.crcValid ? " • CRC OK" : " • CRC akan dihitung ulang"}. Mode
                        aktif:{" "}
                        <strong>
                          {qrisConversionMode === "static_with_amount"
                            ? "010211 + Tag 54 Nominal (Kompatibel ShopeePay)"
                            : qrisConversionMode === "static_raw"
                              ? "QRIS Statis Murni (Tanpa Modifikasi)"
                              : "Dinamis 010212 + Tag 54 Nominal"}
                        </strong>
                        .
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                      <span>{payloadCheck.error}</span>
                    </div>
                  )
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Gunakan QRIS Statis permanen toko (berawalan <code>000201010211...</code>, bukan
                    menu Buat QR Nominal sementara). Klik <strong>Simpan Perubahan</strong> setelah
                    mengatur.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Kartu EDC / Debit & Kredit */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/75">
                <CreditCard className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Kartu Debit & Kredit (EDC)</h2>
                <p className="text-xs text-muted-foreground">
                  Pembayaran menggunakan mesin gesek EDC fisik.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cardEnabled}
                onChange={(e) => setCardEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{cardEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>
        </div>

        {/* Transfer Bank */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/75">
                <Building className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Transfer Bank Manual</h2>
                <p className="text-xs text-muted-foreground">
                  Transfer rekening langsung untuk pesanan katering / pre-order.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={transferEnabled}
                onChange={(e) => setTransferEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{transferEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>

          {transferEnabled && (
            <div className="pt-3 border-t border-border grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-foreground/80">Nama Bank</label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="BCA / Mandiri"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/80">Nomor Rekening</label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="1234567890"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground/80">Atas Nama Rekening</label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="PT Usaha Kebab"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl font-bold shadow-brand gap-2 cursor-pointer"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
