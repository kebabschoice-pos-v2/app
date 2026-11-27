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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  convertStaticQrisToDynamic,
  normalizeQrisPayload,
  validateQrisPayload,
} from "@/lib/qris-emv";

export function PaymentSettingsPage() {
  const [cashEnabled, setCashEnabled] = useState(true);
  const [qrisEnabled, setQrisEnabled] = useState(true);
  const [qrisNmid, setQrisNmid] = useState("");
  const [qrisStaticImageUrl, setQrisStaticImageUrl] = useState("");
  // Raw static QRIS text (e.g. Shopee Partner) -> converted to dynamic QRIS with auto amount at /pos
  const [qrisStaticPayload, setQrisStaticPayload] = useState("");
  const [isDecodingQris, setIsDecodingQris] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [bankName, setBankName] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("1234567890");
  const [accountHolder, setAccountHolder] = useState("PT Kebabs Choice POS");

  const payloadCheck = useMemo(() => {
    const clean = normalizeQrisPayload(qrisStaticPayload);
    if (!clean) return null;
    const validation = validateQrisPayload(clean);
    let sample = "";
    if (validation.ok) {
      try {
        sample = convertStaticQrisToDynamic(clean, 10000);
      } catch {
        sample = "";
      }
    }
    return { ...validation, sample };
  }, [qrisStaticPayload]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = localStorage.getItem("kebabschoicepos_payment_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.cashEnabled === "boolean") setCashEnabled(parsed.cashEnabled);
          if (typeof parsed.qrisEnabled === "boolean") setQrisEnabled(parsed.qrisEnabled);
          if (parsed.qrisNmid) setQrisNmid(parsed.qrisNmid);
          const localStaticImg =
            parsed.qrisStaticImageUrl ||
            parsed.staticQrisImageUrl ||
            parsed.static_qris_image_url ||
            parsed.qrisImageUrl;
          if (localStaticImg) setQrisStaticImageUrl(localStaticImg);
          const localPayload = parsed.qrisStaticPayload || parsed.qris_static_payload;
          if (localPayload) setQrisStaticPayload(String(localPayload));
          if (typeof parsed.cardEnabled === "boolean") setCardEnabled(parsed.cardEnabled);
          if (typeof parsed.transferEnabled === "boolean") setTransferEnabled(parsed.transferEnabled);
          if (parsed.bankName) setBankName(parsed.bankName);
          if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
          if (parsed.accountHolder) setAccountHolder(parsed.accountHolder);
        }

        // Check Supabase outlets.settings.payment_settings (+ outlets.settings.qris_static_payload)
        const { data: outletsData } = await supabase.from("outlets").select("id, settings").limit(10);
        if (outletsData && Array.isArray(outletsData)) {
          const remotePayload = outletsData
            .map((out) => {
              const s = (out.settings as any) || {};
              return s.qris_static_payload || s.payment_settings?.qrisStaticPayload || "";
            })
            .find(Boolean);
          if (remotePayload) setQrisStaticPayload(String(remotePayload));
          for (const out of outletsData) {
            const payConf = (out.settings as any)?.payment_settings;
            if (payConf) {
              if (typeof payConf.cashEnabled === "boolean") setCashEnabled(payConf.cashEnabled);
              if (typeof payConf.qrisEnabled === "boolean") setQrisEnabled(payConf.qrisEnabled);
              if (payConf.qrisNmid) setQrisNmid(payConf.qrisNmid);
              const remoteStaticImg =
                payConf.qrisStaticImageUrl ||
                payConf.staticQrisImageUrl ||
                payConf.static_qris_image_url ||
                payConf.qrisImageUrl;
              if (remoteStaticImg) setQrisStaticImageUrl(remoteStaticImg);
              if (typeof payConf.cardEnabled === "boolean") setCardEnabled(payConf.cardEnabled);
              if (typeof payConf.transferEnabled === "boolean") setTransferEnabled(payConf.transferEnabled);
              if (payConf.bankName) setBankName(payConf.bankName);
              if (payConf.accountNumber) setAccountNumber(payConf.accountNumber);
              if (payConf.accountHolder) setAccountHolder(payConf.accountHolder);
              break;
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSettings();
  }, []);

  const tryAutoDecodeQris = async (imageSrc: string) => {
    setIsDecodingQris(true);
    try {
      const { decodeQrFromImage } = await import("@/lib/qr-tools");
      const decoded = normalizeQrisPayload(await decodeQrFromImage(imageSrc));
      if (decoded && validateQrisPayload(decoded).ok) {
        setQrisStaticPayload(decoded);
        toast.success("Payload QRIS berhasil dibaca otomatis dari gambar", {
          description: "Nominal transaksi akan otomatis terisi saat pelanggan scan QRIS di POS.",
        });
      } else if (decoded) {
        setQrisStaticPayload(decoded);
        toast.warning("QR terbaca, tetapi bukan payload QRIS yang valid. Periksa / tempel manual.");
      } else {
        toast.info("Payload QRIS tidak terbaca dari gambar — tempel teks payload secara manual.");
      }
    } catch (err) {
      console.warn("[QRIS] Auto-decode gagal:", err);
      toast.info("Payload QRIS tidak terbaca dari gambar — tempel teks payload secara manual.");
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
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setQrisStaticImageUrl(result);
        toast.success("Gambar QRIS Statis siap disimpan — klik Simpan Metode Pembayaran.");
        void tryAutoDecodeQris(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const cleanPayload = normalizeQrisPayload(qrisStaticPayload);
    if (cleanPayload && !validateQrisPayload(cleanPayload).ok) {
      toast.error("Payload Teks QRIS Statis tidak valid", {
        description: validateQrisPayload(cleanPayload).error,
      });
      return;
    }
    const data = {
      cashEnabled,
      qrisEnabled,
      qrisNmid: qrisNmid.trim(),
      qrisStaticImageUrl: qrisStaticImageUrl.trim(),
      staticQrisImageUrl: qrisStaticImageUrl.trim(),
      qrisStaticPayload: cleanPayload,
      cardEnabled,
      transferEnabled,
      bankName,
      accountNumber,
      accountHolder,
    };
    localStorage.setItem("kebabschoicepos_payment_settings", JSON.stringify(data));

    try {
      const { data: allOutlets } = await supabase.from("outlets").select("id, settings");
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
          await supabase
            .from("outlets")
            .update({
              settings: {
                ...curr,
                qris_static_payload: cleanPayload,
                payment_settings: { ...prevPay, ...data },
              } as any,
            })
            .eq("id", out.id);
        }
      }
    } catch (sbErr) {
      console.warn("Payment settings Supabase sync warning:", sbErr);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    toast.success("Metode Pembayaran berhasil disimpan");
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <h1 className="text-3xl font-black tracking-normal">Metode Pembayaran</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Atur opsi metode pembayaran yang tersedia di POS kasir: Tunai, QRIS, Kartu Debit/Kredit,
          dan Transfer Bank.
        </p>
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
                  National Merchant ID (NMID)
                </label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={qrisNmid}
                  onChange={(e) => setQrisNmid(e.target.value)}
                  placeholder="Contoh: ID1020xxxxxxxxx"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Isi NMID resmi dari penyedia QRIS Anda. Tanpa NMID resmi, gunakan QRIS Statis
                  toko — kasir akan meminta konfirmasi pembayaran manual.
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
                      <span>{qrisStaticImageUrl ? "Ganti Gambar QRIS" : "Unggah Gambar QRIS Statis"}</span>
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
                        <p className="font-bold text-foreground">QRIS Statis Aktif</p>
                        <p className="text-muted-foreground">
                          Gambar QRIS Statis ini akan langsung ditampilkan beserta nominal tagihan saat kasir memilih metode QRIS di `/pos`.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Unggah foto/gambar QRIS Statis toko Anda agar langsung tampil beserta nominal tagihan saat pembayaran QRIS dipilih di POS.
                    </p>
                  )}
                </div>
              </div>

              {/* Payload Teks QRIS Statis -> QRIS Dinamis EMVCo dengan nominal otomatis */}
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
                  placeholder="00020101021126...5802ID59...6304XXXX (otomatis terisi saat gambar QRIS diunggah, atau tempel manual)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground break-all focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {payloadCheck ? (
                  payloadCheck.ok ? (
                    <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
                      <span>
                        Payload QRIS valid
                        {payloadCheck.merchantName ? ` • ${payloadCheck.merchantName}` : ""}
                        {payloadCheck.merchantCity ? ` (${payloadCheck.merchantCity})` : ""}
                        {payloadCheck.isStatic ? " • Statis (010211)" : payloadCheck.isDynamic ? " • Dinamis (010212)" : ""}
                        {payloadCheck.crcValid ? " • CRC OK" : " • CRC akan dihitung ulang"}. Di POS, QRIS
                        Dinamis EMVCo (tag 54 nominal + CRC16 baru) dibuat otomatis per transaksi.
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
                    Opsional. Jika diisi (mis. QRIS Statis Shopee Partner), POS akan menampilkan QRIS
                    Dinamis sehingga nominal transaksi langsung terisi saat pelanggan scan. Kasir tetap
                    menekan Konfirmasi Lunas setelah dana masuk.
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
          <Button type="button" onClick={handleSave} className="rounded-2xl font-bold shadow-brand">
            Simpan Metode Pembayaran
          </Button>
        </div>
      </div>
    </div>
  );
}
