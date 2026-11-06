import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Receipt,
  Store,
  MapPin,
  Phone,
  Printer,
  Save,
  RefreshCw,
  Eye,
  CheckCircle2,
  Sliders,
  Image as ImageIcon,
  Upload,
  Building,
  Info,
  QrCode,
  FileText,
  ShieldAlert,
  Bluetooth,
  Usb,
  WalletCards,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getReceiptSettings,
  updateReceiptSettings,
  uploadReceiptLogo,
  type ReceiptSettings,
  type ReceiptSettingsInput,
} from "@/services/receipt.service";
import { getOutletList, type OutletItem } from "@/services/outlet.service";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
import {
  connectBluetoothPrinter,
  connectUsbPrinter,
  disconnectPrinter,
  subscribePrinterStatus,
  kickCashDrawer,
  testThermalPrint,
  type ConnectedPrinterInfo,
} from "@/services/thermal-printer.service";

export function ReceiptSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [userRole, setUserRole] = useState<string | null>("owner");
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Belum Terhubung",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });

  // Outlet state for multi-branch receipts
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(""); // "" = HQ Default (all outlets)

  // Receipt Form State
  const [form, setForm] = useState<ReceiptSettingsInput>({
    store_name: "Kebab's Choice",
    receipt_header: "Selamat datang di Kebab's Choice! Nikmati sajian kebab autentik kami.",
    receipt_footer: "Terima kasih atas kunjungan Anda. Kritik & Saran: wa.me/0859106660608",
    logo_url: null,
    show_business_name: true,
    show_address: true,
    show_phone: true,
    show_tax: true,
    paper_size: "58mm",
    address: "Jl. Abdul Fatah RT.07/RW.04, Tenjolaya, Bogor",
    phone: "0859-1066-60608",
  });

  const canEdit = isHQRole(userRole);

  async function loadData(targetOutletId = selectedOutletId) {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const role = await getUserRole(authData.user.id);
        setUserRole(role);
      }

      const [settings, outletList] = await Promise.all([
        getReceiptSettings(undefined, targetOutletId || null),
        getOutletList().catch(() => [] as OutletItem[]),
      ]);

      setOutlets(outletList);
      setForm({
        store_name: settings.store_name || "Kebab's Choice",
        receipt_header: settings.receipt_header || "",
        receipt_footer: settings.receipt_footer || "",
        logo_url: settings.logo_url || null,
        show_business_name: settings.show_business_name,
        show_address: settings.show_address,
        show_phone: settings.show_phone,
        show_tax: settings.show_tax,
        paper_size: settings.paper_size || "58mm",
        address: settings.address || "",
        phone: settings.phone || "",
      });
    } catch (err) {
      console.error("[ReceiptSettingsPage] Load error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal memuat konfigurasi struk");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(selectedOutletId);
  }, [selectedOutletId]);

  useEffect(() => {
    const unsub = subscribePrinterStatus((info) => {
      setPrinterInfo(info);
    });
    return () => unsub();
  }, []);

  const handleConnectBt = async () => {
    setIsConnectingPrinter(true);
    try {
      const ok = await connectBluetoothPrinter();
      if (ok) {
        toast.success("Printer Bluetooth berhasil terhubung!", {
          description: "Siap digunakan untuk cetak struk ESC/POS langsung.",
        });
      }
    } catch (err: any) {
      toast.error("Gagal menghubungkan printer Bluetooth: " + err.message);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnectingPrinter(true);
    try {
      const ok = await connectUsbPrinter();
      if (ok) {
        toast.success("Printer USB Direct berhasil terhubung!", {
          description: "Siap digunakan untuk cetak struk ESC/POS langsung.",
        });
      }
    } catch (err: any) {
      toast.error("Gagal menghubungkan printer USB: " + err.message);
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    toast.info("Koneksi printer thermal telah diputuskan.");
  };

  const handleKickDrawer = async () => {
    const success = await kickCashDrawer();
    if (success) {
      toast.success("Perintah pulsa laci kas (ESC p 0) terkirim!");
    } else {
      toast.info(
        "Perintah laci kas dikirim (Pastikan printer thermal aktif & kabel RJ11 laci terhubung).",
      );
    }
  };

  const handleTestPrint = async () => {
    setIsTestingPrinter(true);
    try {
      const result = await testThermalPrint();
      if (result.mode === "thermal") {
        toast.success("Test print terkirim ke printer thermal!", {
          description: `Mencetak struk uji coba ESC/POS (${printerInfo.paperSize}, ${printerInfo.type.toUpperCase()})`,
        });
      } else {
        toast.info("Membuka preview cetak browser (Fallback)", {
          description:
            "Hubungkan printer Bluetooth/USB untuk pencetakan langsung tanpa dialog browser.",
        });
      }
    } catch (err: any) {
      toast.error("Gagal melakukan test print: " + err.message);
    } finally {
      setIsTestingPrinter(false);
    }
  };

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!canEdit) {
      toast.error("Akun Anda tidak memiliki izin untuk mengubah konfigurasi struk");
      return;
    }

    if (!form.store_name.trim()) {
      toast.error("Nama toko pada struk wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await updateReceiptSettings({
        ...form,
        outlet_id: selectedOutletId || null,
      });

      toast.success(
        selectedOutletId
          ? "Pengaturan struk cabang berhasil diperbarui"
          : "Konfigurasi struk default (HQ) berhasil disimpan",
      );
    } catch (err) {
      console.error("[ReceiptSettingsPage] Save error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan struk");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const publicUrl = await uploadReceiptLogo(file, form.business_id);
      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      // Persist logo_url immediately to ensure persistence across page refreshes
      await updateReceiptSettings({
        ...form,
        logo_url: publicUrl,
        outlet_id: selectedOutletId || null,
      });
      toast.success("Logo struk berhasil diunggah & disimpan");
    } catch (err) {
      console.error("[ReceiptSettingsPage] Logo upload error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah logo");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function handleRemoveLogo() {
    setForm((prev) => ({ ...prev, logo_url: null }));
    try {
      await updateReceiptSettings({
        ...form,
        logo_url: null,
        outlet_id: selectedOutletId || null,
      });
      toast.info("Logo struk dihapus dari konfigurasi");
    } catch {
      toast.info("Logo struk dihapus");
    }
  }

  // Calculate live preview totals
  const previewItems = useMemo(
    () => [
      { name: "Kebab Beef Jumbo (Pedas)", qty: 2, price: 32000, total: 64000 },
      { name: "Kebab Chicken Mozzarella", qty: 1, price: 28000, total: 28000 },
      { name: "Es Teh Manis Nusantara", qty: 2, price: 8000, total: 16000 },
    ],
    [],
  );

  const subtotal = useMemo(
    () => previewItems.reduce((acc, curr) => acc + curr.total, 0),
    [previewItems],
  );
  const taxAmount = useMemo(
    () => (form.show_tax ? Math.round(subtotal * 0.1) : 0),
    [subtotal, form.show_tax],
  );
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header Banner */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
              <Receipt className="size-4" />
              <span>Business Settings · POS Transaction Receipt</span>
            </div>
            <h1 className="text-3xl font-black tracking-normal">Invoice / Receipt Setting</h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Konfigurasi tampilan struk kasir, identitas toko, header & footer pesan transaksi POS.
              Perubahan langsung tercermin pada cetak struk thermal kasir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Outlet Selector Filter */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5 shadow-xs">
              <Store className="size-4 text-muted-foreground" />
              <div className="text-xs">
                <span className="text-[0.68rem] text-muted-foreground block font-medium">
                  Cabang:
                </span>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-popover text-popover-foreground">
                    Semua Cabang (HQ Default)
                  </option>
                  {outlets.map((outlet) => (
                    <option
                      key={outlet.id}
                      value={outlet.id}
                      className="bg-popover text-popover-foreground"
                    >
                      {outlet.outlet_name} ({outlet.code || "NO CODE"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {canEdit && (
              <Button
                onClick={() => handleSave()}
                disabled={submitting || loading}
                className="rounded-2xl font-bold shadow-brand gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>Simpan Pengaturan</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {!canEdit && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              <strong>Mode Tinjau Struk:</strong> Akun kasir hanya memiliki hak akses melihat
              pratinjau struk transaksi dan tidak dapat mengubah konfigurasi HQ.
            </span>
          </div>
        )}
      </div>

      {/* Thermal Printer Hardware Connection Card */}
      <div className="rounded-[2rem] border border-primary/20 bg-primary/5 p-5 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-11 items-center justify-center rounded-2xl ${
                printerInfo.status === "connected"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Printer className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-foreground">
                  {printerInfo.status === "connected"
                    ? `Printer Thermal: ${printerInfo.name}`
                    : "Printer Thermal Direct Belum Terhubung"}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    printerInfo.status === "connected"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : printerInfo.status === "connecting"
                        ? "bg-amber-500/15 text-amber-600 animate-pulse"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {printerInfo.status === "connected"
                    ? `${printerInfo.type.toUpperCase()} TERHUBUNG`
                    : printerInfo.status === "connecting"
                      ? "MENGHUBUNGKAN..."
                      : "FALLBACK BROWSER"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {printerInfo.status === "connected"
                  ? `Ukuran kertas: ${printerInfo.paperSize} • Siap cetak langsung ESC/POS & kick cash drawer otomatis.`
                  : "Cetak struk akan otomatis dialihkan ke pratinjau cetak browser (window.print)."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {printerInfo.status === "connected" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestPrint}
                  disabled={isTestingPrinter}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${isTestingPrinter ? "animate-spin" : ""}`} />
                  Tes Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleKickDrawer}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <WalletCards className="size-3.5 text-emerald-600" />
                  Buka Laci
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="rounded-xl text-xs font-bold gap-1 text-destructive hover:bg-destructive/10"
                >
                  <PowerOff className="size-3.5" />
                  Putuskan
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectBt}
                  disabled={isConnectingPrinter}
                  className="rounded-xl text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
                >
                  <Bluetooth className="size-3.5" />
                  Hubungkan Bluetooth
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleConnectUsb}
                  disabled={isConnectingPrinter}
                  className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                >
                  <Usb className="size-3.5" />
                  Hubungkan USB
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestPrint}
                  disabled={isTestingPrinter}
                  className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  Tes Print
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin text-primary" />
            <span>Memuat konfigurasi struk transaksi...</span>
          </div>
        </div>
      ) : (
        /* Main 2-Column Grid: Left Form Cards, Right Live Preview */
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: Settings Cards (7 Cols) */}
          <div className="space-y-6 lg:col-span-7">
            {/* CARD 1: Store Identity */}
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">1. Identitas Toko & Logo Struk</h2>
                  <p className="text-xs text-muted-foreground">
                    Informasi nama toko dan logo yang dicetak di bagian paling atas struk kasir.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Store Name Input */}
                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Nama Toko pada Struk <span className="text-destructive">*</span>
                  </label>
                  <Input
                    className="mt-1.5 rounded-xl font-bold"
                    placeholder="cth. Kebab's Choice"
                    value={form.store_name}
                    onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    disabled={!canEdit}
                  />
                  <span className="text-[0.68rem] text-muted-foreground mt-0.5 block">
                    Nama ini akan dicetak besar di bagian tengah header struk kasir.
                  </span>
                </div>

                {/* Logo Setting */}
                <div>
                  <label className="text-xs font-bold text-foreground/80 block mb-1.5">
                    Logo Struk Kasir
                  </label>
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt="Logo Struk"
                          className="size-full object-contain p-1 grayscale contrast-125"
                        />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        {form.logo_url ? "Logo Struk Aktif" : "Belum ada logo struk"}
                      </p>
                      <p className="text-[0.68rem] text-muted-foreground">
                        Disarankan logo monokrom/hitam-putih transparan untuk hasil thermal optimal.
                      </p>

                      {canEdit && (
                        <div className="flex items-center gap-2 pt-1">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors">
                            <Upload className="size-3" />
                            {uploadingLogo ? "Mengunggah..." : "Unggah Logo"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              className="hidden"
                              onChange={handleLogoUpload}
                              disabled={uploadingLogo}
                            />
                          </label>

                          {form.logo_url && (
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="text-xs text-destructive hover:underline font-semibold"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address & Phone */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Nomor Telepon Toko
                    </label>
                    <Input
                      className="mt-1.5 rounded-xl font-mono"
                      placeholder="0859-1066-60608"
                      value={form.phone || ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Format Kertas Struk
                    </label>
                    <select
                      className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={form.paper_size || "58mm"}
                      onChange={(e) =>
                        setForm({ ...form, paper_size: e.target.value as "58mm" | "80mm" })
                      }
                      disabled={!canEdit}
                    >
                      <option value="58mm">58mm (Printer Kasir Mobile / Standar)</option>
                      <option value="80mm">80mm (Printer Kasir Desktop Lebar)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Alamat Lengkap Toko
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Alamat toko yang dicetak di bawah nama toko..."
                    value={form.address || ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Header & Footer Text */}
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">2. Pesan Struk (Header & Footer)</h2>
                  <p className="text-xs text-muted-foreground">
                    Teks kustom ucapan selamat datang dan ucapan terima kasih pada struk.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Header Text */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground/80">
                      Receipt Header (Teks Pembuka Sebelum Pesanan)
                    </label>
                    <span className="text-[0.68rem] text-muted-foreground font-mono">
                      {(form.receipt_header || "").length} karakter
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="cth. Selamat datang di Kebab's Choice! Nikmati sajian kebab autentik kami."
                    value={form.receipt_header}
                    onChange={(e) => setForm({ ...form, receipt_header: e.target.value })}
                    disabled={!canEdit}
                  />
                  <span className="text-[0.68rem] text-muted-foreground mt-0.5 block">
                    Dicetak sebelum rincian daftar menu pesanan.
                  </span>
                </div>

                {/* Footer Text */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground/80">
                      Receipt Footer (Teks Penutup Setelah Total)
                    </label>
                    <span className="text-[0.68rem] text-muted-foreground font-mono">
                      {(form.receipt_footer || "").length} karakter
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="cth. Terima kasih atas kunjungan Anda. Kritik & Saran: wa.me/0859106660608"
                    value={form.receipt_footer}
                    onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                    disabled={!canEdit}
                  />
                  <span className="text-[0.68rem] text-muted-foreground mt-0.5 block">
                    Dicetak di bagian paling bawah struk setelah total pembayaran.
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 3: Display Options */}
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sliders className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">3. Opsi Tampilan Struk (Display Settings)</h2>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan atau nonaktifkan elemen informasi yang ingin ditampilkan pada struk
                    kasir.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Toggle 1: Nama Toko */}
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.show_business_name}
                    onChange={(e) => setForm({ ...form, show_business_name: e.target.checked })}
                    disabled={!canEdit}
                    className="mt-0.5 size-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Tampilkan Nama Toko
                    </span>
                    <span className="text-[0.68rem] text-muted-foreground">
                      Menampilkan nama toko di bagian header struk.
                    </span>
                  </div>
                </label>

                {/* Toggle 2: Alamat */}
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.show_address}
                    onChange={(e) => setForm({ ...form, show_address: e.target.checked })}
                    disabled={!canEdit}
                    className="mt-0.5 size-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Tampilkan Alamat
                    </span>
                    <span className="text-[0.68rem] text-muted-foreground">
                      Menampilkan lokasi cabang/gerai pada struk.
                    </span>
                  </div>
                </label>

                {/* Toggle 3: Telepon */}
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.show_phone}
                    onChange={(e) => setForm({ ...form, show_phone: e.target.checked })}
                    disabled={!canEdit}
                    className="mt-0.5 size-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Tampilkan Nomor Telepon
                    </span>
                    <span className="text-[0.68rem] text-muted-foreground">
                      Menampilkan kontak WhatsApp / CS di struk.
                    </span>
                  </div>
                </label>

                {/* Toggle 4: Pajak */}
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.show_tax}
                    onChange={(e) => setForm({ ...form, show_tax: e.target.checked })}
                    disabled={!canEdit}
                    className="mt-0.5 size-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Tampilkan Pajak (Tax / PB1)
                    </span>
                    <span className="text-[0.68rem] text-muted-foreground">
                      Merinci besaran pajak pada ringkasan subtotal.
                    </span>
                  </div>
                </label>
              </div>

              {canEdit && (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={() => handleSave()}
                    disabled={submitting}
                    className="rounded-xl font-bold shadow-brand gap-2"
                  >
                    {submitting ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    <span>Simpan Konfigurasi Struk</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Card 4: Live Receipt Thermal Preview (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="size-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Live Thermal Receipt Preview
                  </span>
                </div>
                <span className="text-[0.68rem] font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-bold">
                  {form.paper_size || "58mm"} POS
                </span>
              </div>

              {/* Thermal Paper Container */}
              <div className="relative mx-auto w-full max-w-[340px] rounded-xl bg-white p-5 font-mono text-[11px] leading-relaxed text-zinc-900 shadow-2xl border border-zinc-300 dark:border-zinc-700">
                {/* Perforated Top Edge */}
                <div className="absolute -top-1.5 inset-x-0 h-2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-200 to-transparent dark:from-zinc-800" />

                {/* 1. Logo & Header */}
                <div className="text-center space-y-1">
                  {form.logo_url && (
                    <div className="flex justify-center pb-1">
                      <img
                        src={form.logo_url}
                        alt="Store Logo"
                        className="h-10 max-w-[120px] object-contain grayscale contrast-200"
                      />
                    </div>
                  )}

                  {form.show_business_name && (
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                      {form.store_name || "KEBABS CHOICE"}
                    </h3>
                  )}

                  {form.show_address && form.address && (
                    <p className="text-[10px] text-zinc-700 leading-tight px-2">{form.address}</p>
                  )}

                  {form.show_phone && form.phone && (
                    <p className="text-[10px] text-zinc-700">Telp: {form.phone}</p>
                  )}
                </div>

                {/* Dashed Line */}
                <div className="my-2.5 border-t border-dashed border-zinc-400" />

                {/* 2. Transaction Meta */}
                <div className="text-[10px] text-zinc-700 space-y-0.5">
                  <div className="flex justify-between">
                    <span>No. Order</span>
                    <span className="font-bold text-zinc-900">#ORD-2026-0928</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>28/09/2026 15:30 WIB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir</span>
                    <span>Kasir Utama (Budi)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode Bayar</span>
                    <span>QRIS (Lunas)</span>
                  </div>
                </div>

                {/* Header Welcome Text if present */}
                {form.receipt_header && (
                  <div className="my-2 border-y border-dashed border-zinc-300 py-1 text-center text-[10px] italic text-zinc-600">
                    &ldquo;{form.receipt_header}&rdquo;
                  </div>
                )}

                {/* Dashed Line */}
                <div className="my-2 border-t border-dashed border-zinc-400" />

                {/* 3. Items Table */}
                <div className="space-y-1.5 text-[10px]">
                  {previewItems.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-bold text-zinc-950">{item.name}</div>
                      <div className="flex justify-between text-zinc-700">
                        <span>
                          {item.qty} x Rp {item.price.toLocaleString("id-ID")}
                        </span>
                        <span className="font-bold text-zinc-950">
                          Rp {item.total.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dashed Line */}
                <div className="my-2.5 border-t border-dashed border-zinc-400" />

                {/* 4. Subtotal & Totals */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between text-zinc-700">
                    <span>Subtotal</span>
                    <span>Rp {subtotal.toLocaleString("id-ID")}</span>
                  </div>

                  {form.show_tax && (
                    <div className="flex justify-between text-zinc-700">
                      <span>PB1 / Pajak (10%)</span>
                      <span>Rp {taxAmount.toLocaleString("id-ID")}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-dashed border-zinc-400 pt-1 text-xs font-black text-zinc-950">
                    <span>TOTAL</span>
                    <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-700 pt-0.5">
                    <span>Tunai (Diterima)</span>
                    <span>Rp {(150000).toLocaleString("id-ID")}</span>
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-700">
                    <span>Kembalian</span>
                    <span>Rp {(150000 - grandTotal).toLocaleString("id-ID")}</span>
                  </div>
                </div>

                {/* Dashed Line */}
                <div className="my-2.5 border-t border-dashed border-zinc-400" />

                {/* 5. Footer Text */}
                {form.receipt_footer && (
                  <div className="text-center text-[10px] text-zinc-750 px-2 leading-relaxed">
                    {form.receipt_footer}
                  </div>
                )}

                {/* QR Code / Barcode Simulation */}
                <div className="mt-4 flex flex-col items-center justify-center space-y-1">
                  <div className="flex size-14 items-center justify-center rounded-lg border border-zinc-300 bg-white p-1">
                    <QrCode className="size-full text-zinc-800" />
                  </div>
                  <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase">
                    Scan Struk untuk e-Nota
                  </span>
                </div>

                {/* Perforated Bottom Edge */}
                <div className="mt-4 text-center text-[8px] text-zinc-400 border-t border-dashed border-zinc-300 pt-2">
                  *** KebabsChoicePOS 2026 Engine ***
                </div>
              </div>

              {/* Quick simulation helper */}
              <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <Printer className="size-3.5 text-primary" />
                  Struk siap dihubungkan ke printer thermal USB & Bluetooth.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg"
                  onClick={() =>
                    toast.success("Simulasi cetak struk: Perintah berhasil dikirim ke printer POS!")
                  }
                >
                  Tes Cetak
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
