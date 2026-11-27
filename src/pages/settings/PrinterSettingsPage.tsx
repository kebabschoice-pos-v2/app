import { useState, useEffect } from "react";
import {
  Printer,
  Bluetooth,
  Usb,
  Wifi,
  Network,
  Check,
  RefreshCw,
  WalletCards,
  PowerOff,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  connectBluetoothPrinter,
  connectUsbPrinter,
  connectRawBtPrinter,
  disconnectPrinter,
  discoverPairedBluetoothPrinters,
  selectPairedBluetoothPrinter,
  isNativeCapacitorPlatform,
  subscribePrinterStatus,
  kickCashDrawer,
  testThermalPrint,
  isBluetoothSupported,
  isUsbSupported,
  type ConnectedPrinterInfo,
  type PairedBluetoothPrinter,
} from "@/services/thermal-printer.service";

export function PrinterSettingsPage() {
  const [connectionType, setConnectionType] = useState<"bluetooth" | "rawbt" | "usb" | "lan" | "wifi">(
    "bluetooth",
  );
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">("58mm");
  const [printerName, setPrinterName] = useState("Thermal POS 58-BT");
  const [printerIp, setPrinterIp] = useState("192.168.1.200");
  const [storeName, setStoreName] = useState("Kebab's Choice");
  const [branchAddress, setBranchAddress] = useState("");
  const [footerMessage, setFooterMessage] = useState(
    "Terima kasih atas kunjungan Anda!\nSajian Kebab Pilihan Keluarga",
  );
  const [autoPrint, setAutoPrint] = useState(true);
  const [autoCut, setAutoCut] = useState(true);
  const [openCashDrawer, setOpenCashDrawer] = useState(true);
  const [copies, setCopies] = useState(1);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<PairedBluetoothPrinter[]>([]);
  const [showPairedPrinters, setShowPairedPrinters] = useState(false);
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Belum Terhubung",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = localStorage.getItem("kebabschoicepos_printer_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.connectionType) setConnectionType(parsed.connectionType);
          if (parsed.paperSize) setPaperSize(parsed.paperSize);
          if (parsed.printerName) setPrinterName(parsed.printerName);
          if (parsed.printerIp) setPrinterIp(parsed.printerIp);
          if (parsed.storeName) setStoreName(parsed.storeName);
          if (parsed.branchAddress !== undefined) setBranchAddress(parsed.branchAddress);
          if (parsed.footerMessage !== undefined) setFooterMessage(parsed.footerMessage);
          if (typeof parsed.autoPrint === "boolean") setAutoPrint(parsed.autoPrint);
          if (typeof parsed.autoCut === "boolean") setAutoCut(parsed.autoCut);
          if (typeof parsed.openCashDrawer === "boolean") setOpenCashDrawer(parsed.openCashDrawer);
          if (parsed.copies) setCopies(parsed.copies);
        }

        // Check Supabase outlets.settings.printer_settings
        const { data: outletsData } = await supabase.from("outlets").select("id, settings").limit(5);
        if (outletsData && Array.isArray(outletsData)) {
          for (const out of outletsData) {
            const prConf = (out.settings as any)?.printer_settings;
            if (prConf) {
              if (prConf.connectionType) setConnectionType(prConf.connectionType);
              if (prConf.paperSize) setPaperSize(prConf.paperSize);
              if (prConf.printerName) setPrinterName(prConf.printerName);
              if (prConf.printerIp) setPrinterIp(prConf.printerIp);
              if (prConf.storeName) setStoreName(prConf.storeName);
              if (prConf.branchAddress !== undefined) setBranchAddress(prConf.branchAddress);
              if (prConf.footerMessage !== undefined) setFooterMessage(prConf.footerMessage);
              if (typeof prConf.autoPrint === "boolean") setAutoPrint(prConf.autoPrint);
              if (typeof prConf.autoCut === "boolean") setAutoCut(prConf.autoCut);
              if (typeof prConf.openCashDrawer === "boolean") setOpenCashDrawer(prConf.openCashDrawer);
              if (prConf.copies) setCopies(prConf.copies);
              break;
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSettings();

    const unsub = subscribePrinterStatus((info) => {
      setPrinterInfo(info);
      if (info.status === "connected") {
        setPrinterName(info.name);
        if (info.type === "bluetooth" || info.type === "usb" || info.type === "rawbt") {
          setConnectionType(info.type);
        }
      }
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    let prevSaved: Record<string, any> = {};
    try {
      const rawPrev = localStorage.getItem("kebabschoicepos_printer_settings");
      if (rawPrev) prevSaved = JSON.parse(rawPrev);
    } catch {}

    const data = {
      ...prevSaved,
      connectionType,
      paperSize,
      printerName,
      printerIp,
      storeName,
      branchAddress,
      footerMessage,
      autoPrint,
      autoCut,
      openCashDrawer,
      copies,
    };
    localStorage.setItem("kebabschoicepos_printer_settings", JSON.stringify(data));

    try {
      const { data: allOutlets } = await supabase.from("outlets").select("id, settings");
      if (allOutlets && Array.isArray(allOutlets)) {
        for (const out of allOutlets) {
          const curr =
            out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
              ? (out.settings as Record<string, any>)
              : {};
          await supabase
            .from("outlets")
            .update({
              settings: { ...curr, printer_settings: data } as any,
            })
            .eq("id", out.id);
        }
      }
    } catch (sbErr) {
      console.warn("Printer settings Supabase sync warning:", sbErr);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    toast.success("Pengaturan Printer & Struk berhasil disimpan");
  };

  const handleConnectBt = async () => {
    setIsConnecting(true);
    try {
      if ((window as any).Capacitor?.isNativePlatform?.()) {
        const devices = await discoverPairedBluetoothPrinters();
        setPairedPrinters(devices);
        setShowPairedPrinters(true);
        if (devices.length === 0) {
          toast.info("Belum ada perangkat Bluetooth ter-pair di tablet", {
            description:
              "Buka Pengaturan Bluetooth Android, pair printer thermal (PIN 0000 / 1234), lalu ketuk Hubungkan Bluetooth lagi.",
          });
        } else {
          toast.info(`Pilih printer thermal (${devices.length} perangkat ter-pair)`, {
            description: "Klik 1x nama printer untuk langsung terhubung otomatis.",
          });
        }
        return;
      }

      const ok = await connectBluetoothPrinter();
      if (ok) {
        toast.success("Printer Bluetooth berhasil terhubung!", {
          description: "Siap digunakan untuk cetak struk ESC/POS langsung.",
        });
      }
    } catch (err: any) {
      toast.error("Gagal menghubungkan printer Bluetooth: " + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleChoosePairedPrinter = (device: PairedBluetoothPrinter) => {
    const connected = selectPairedBluetoothPrinter(device);
    setPrinterInfo(connected);
    setPrinterName(device.name);
    setConnectionType("bluetooth");
    setShowPairedPrinters(false);
    toast.success(`Printer ${device.name} terhubung!`, {
      description: `MAC ${device.address} tersimpan untuk auto-connect & cetak langsung tanpa RawBT.`,
    });
  };

  const handleConnectUsb = async () => {
    setIsConnecting(true);
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
      setIsConnecting(false);
    }
  };

  const handleConnectRawBt = async () => {
    setIsConnecting(true);
    try {
      const ok = await connectRawBtPrinter();
      if (ok) {
        setConnectionType("rawbt");
        toast.success("Mode RawBT (Bluetooth Android) diaktifkan!", {
          description: "Struk ESC/POS akan dikirim via aplikasi RawBT (rawbt:base64).",
        });
      }
    } catch (err: any) {
      toast.error("Gagal mengaktifkan mode RawBT: " + err.message);
    } finally {
      setIsConnecting(false);
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
    setIsTesting(true);
    try {
      const result = await testThermalPrint();
      if (result.mode === "thermal") {
        toast.success("Test print terkirim ke printer thermal!", {
          description: `Mencetak struk uji coba ESC/POS (${paperSize}, ${printerInfo.type.toUpperCase()})`,
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
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <h1 className="text-3xl font-black tracking-normal">Printer Setting</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Konfigurasi koneksi printer struk thermal kasir, ukuran kertas, dan opsi laci kas (cash
          drawer).
        </p>
      </div>

      <div className="grid gap-6">
        {/* Live Thermal Hardware Connection Card */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-12 items-center justify-center rounded-2xl ${
                  printerInfo.status === "connected"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Printer className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black">
                    {printerInfo.status === "connected"
                      ? `Terhubung: ${printerInfo.name}`
                      : "Printer Thermal Direct Belum Terhubung"}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      printerInfo.status === "connected"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : printerInfo.status === "connecting"
                          ? "bg-muted text-foreground/75 animate-pulse"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {printerInfo.status === "connected"
                      ? `${printerInfo.type.toUpperCase()} AKTIF`
                      : printerInfo.status === "connecting"
                        ? "MENGHUBUNGKAN..."
                        : "FALLBACK BROWSER"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {printerInfo.status === "connected"
                    ? `Perintah ESC/POS dikirim langsung ke hardware (${paperSize}). Cetak struk instan tanpa dialog browser.`
                    : "Jika printer belum terhubung, POS otomatis menggunakan dialog cetak bawaan browser (window.print)."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {printerInfo.status === "connected" ? (
                <>
                  {isNativeCapacitorPlatform() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleConnectBt}
                      disabled={isConnecting}
                      className="rounded-xl text-xs font-bold gap-1.5"
                    >
                      <Bluetooth className="size-3.5" />
                      Ganti Printer Bluetooth
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleKickDrawer}
                    className="rounded-xl text-xs font-bold gap-1.5"
                  >
                    <WalletCards className="size-3.5" />
                    Buka Laci Kas
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    className="rounded-xl text-xs font-bold gap-1.5"
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
                    disabled={isConnecting}
                    className="rounded-xl text-xs font-bold gap-1.5 shadow-sm"
                  >
                    <Bluetooth className="size-3.5" />
                    Hubungkan Bluetooth
                  </Button>
                  {!isNativeCapacitorPlatform() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleConnectRawBt}
                      disabled={isConnecting}
                      className="rounded-xl text-xs font-bold gap-1.5"
                    >
                      <Smartphone className="size-3.5" />
                      RawBT (Bluetooth Android)
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConnectUsb}
                    disabled={isConnecting}
                    className="rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Usb className="size-3.5" />
                    Hubungkan USB
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Daftar Printer Bluetooth Ter-pair di Tablet (.apk Native SPP) */}
          {showPairedPrinters && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-foreground">
                    Daftar Printer Bluetooth Ter-pair di Tablet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Klik 1x nama printer thermal kasir (Eppos, Panda, RPP02N, VSC, Blueprint, Iware) untuk auto-connect.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isConnecting}
                    onClick={handleConnectBt}
                    className="h-8 rounded-lg text-xs font-bold gap-1"
                  >
                    <RefreshCw className={`size-3 ${isConnecting ? "animate-spin" : ""}`} />
                    Segarkan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPairedPrinters(false)}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    Tutup
                  </Button>
                </div>
              </div>

              {pairedPrinters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                  Belum ada perangkat Bluetooth yang di-pair di tablet ini. Buka{" "}
                  <strong>Pengaturan Android &rarr; Bluetooth</strong>, pasangkan printer thermal (PIN standar:{" "}
                  <code>0000</code> atau <code>1234</code>), lalu tekan <strong>Segarkan</strong>.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {pairedPrinters.map((dev) => {
                    const isSelected =
                      printerInfo.status === "connected" &&
                      printerInfo.address?.toUpperCase() === dev.address.toUpperCase();
                    return (
                      <button
                        key={dev.address}
                        type="button"
                        onClick={() => handleChoosePairedPrinter(dev)}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer active:scale-98 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Bluetooth className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground truncate">{dev.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground truncate">
                              {dev.address}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            isSelected
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="size-3" /> Aktif
                            </span>
                          ) : (
                            "Pilih"
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipe Koneksi */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Printer className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Koneksi Printer Struk</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                id: "bluetooth",
                label: "Bluetooth (BLE)",
                icon: Bluetooth,
                desc: "Web Bluetooth GATT langsung",
              },
              {
                id: "rawbt",
                label: "RawBT (Bluetooth Android)",
                icon: Smartphone,
                desc: "Jembatan Bluetooth Classic SPP",
              },
              { id: "usb", label: "USB Direct", icon: Usb, desc: "Kabel langsung ke PC/POS" },
              {
                id: "lan",
                label: "LAN (Ethernet)",
                icon: Network,
                desc: "Jaringan kabel router lokal",
              },
              { id: "wifi", label: "Wi-Fi Network", icon: Wifi, desc: "Koneksi nirkabel IP lokal" },
            ].map((conn) => {
              const Icon = conn.icon;
              const selected = connectionType === conn.id;
              return (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => {
                    setConnectionType(conn.id as any);
                    if (conn.id === "rawbt") {
                      connectRawBtPrinter().catch(() => {});
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                    selected
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-soft"
                      : "border-border bg-background hover:bg-secondary/50 text-foreground"
                  }`}
                >
                  <Icon className="size-6 mb-2" />
                  <span className="text-sm font-bold">{conn.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{conn.desc}</span>
                </button>
              );
            })}
          </div>

          {connectionType === "rawbt" && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs text-foreground">
              Aplikasi <strong>RawBT</strong> gratis dari Play Store digunakan sebagai jembatan Bluetooth Classic (SPP) untuk printer thermal Eppos, Panda, VSC, dan RPP02N di tablet Android.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground/80">
                Nama Printer / Device ID
              </label>
              <Input
                className="mt-1.5 rounded-xl"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder="cth: Thermal-POS-58"
              />
            </div>
            {(connectionType === "lan" || connectionType === "wifi") && (
              <div>
                <label className="text-xs font-bold text-foreground/80">IP Address Printer</label>
                <Input
                  className="mt-1.5 rounded-xl"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="192.168.1.200"
                />
              </div>
            )}
          </div>
        </div>

        {/* Format Kertas & Opsi Cetak */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h2 className="text-lg font-bold">Format & Ukuran Kertas</h2>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {[
              { id: "58mm", label: "58 mm (Standar Kecil)" },
              { id: "80mm", label: "80 mm (Format Lebar)" },
            ].map((paper) => (
              <button
                key={paper.id}
                type="button"
                onClick={() => setPaperSize(paper.id as any)}
                className={`p-3 rounded-2xl border text-center text-sm font-bold transition-all ${
                  paperSize === paper.id
                    ? "border-primary bg-primary/10 text-primary shadow-soft"
                    : "border-border bg-background hover:bg-secondary/50 text-foreground"
                }`}
              >
                {paper.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-secondary/40">
              <div>
                <p className="text-sm font-bold">Auto-Cut Kertas</p>
                <p className="text-xs text-muted-foreground">
                  Potong kertas secara otomatis setelah struk selesai dicetak.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoCut}
                onChange={(e) => setAutoCut(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-secondary/40">
              <div>
                <p className="text-sm font-bold">Buka Laci Kas (Cash Drawer)</p>
                <p className="text-xs text-muted-foreground">
                  Kirim pulsa sinyal ke laci kas otomatis saat transaksi tunai selesai.
                </p>
              </div>
              <input
                type="checkbox"
                checked={openCashDrawer}
                onChange={(e) => setOpenCashDrawer(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-secondary/40">
              <div>
                <p className="text-sm font-bold">Auto-Print Struk saat Checkout</p>
                <p className="text-xs text-muted-foreground">
                  Langsung kirim perintah cetak ke printer thermal setelah transaksi kasir berhasil.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
            </label>

            <div className="flex items-center justify-between p-2">
              <div>
                <p className="text-sm font-bold">Jumlah Rangkap Struk</p>
                <p className="text-xs text-muted-foreground">
                  1 lembar untuk pembeli, lembar kedua untuk arsip dapur/kasir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`size-8 rounded-lg font-bold text-xs border ${
                      copies === num
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border"
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Header, Alamat & Footer Struk untuk Pembeli */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <h2 className="text-lg font-bold">Tampilan & Teks Struk Pembeli</h2>
          <p className="text-xs text-muted-foreground">
            Atur nama toko, alamat cabang, dan pesan penutup yang tercetak di struk thermal pembeli.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-foreground/80">Header Nama Toko / Brand</label>
              <Input
                className="mt-1.5 rounded-xl"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Kebab's Choice POS"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground/80">Alamat Cabang</label>
              <Input
                className="mt-1.5 rounded-xl"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="Jl. Raya Pasar Jumat No. 12"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground/80">Pesan Footer / Kritik & Saran</label>
            <textarea
              className="mt-1.5 w-full min-h-[70px] rounded-xl border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              placeholder="Terima kasih atas kunjungan Anda!&#10;Kritik & Saran: wa.me/0859106660608"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestPrint}
              disabled={isTesting}
              className="rounded-2xl gap-2 font-bold cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Test Print Struk
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleKickDrawer}
              className="rounded-2xl gap-2 font-bold cursor-pointer"
            >
              <WalletCards className="size-4 text-emerald-600" />
              Buka Laci Kas
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            className="rounded-2xl font-bold shadow-brand cursor-pointer"
          >
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </div>
  );
}
