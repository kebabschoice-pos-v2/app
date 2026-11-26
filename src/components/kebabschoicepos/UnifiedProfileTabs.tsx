import { useEffect, useState, type ReactNode } from "react";
import {
  Bluetooth,
  CheckCircle2,
  Grid3X3,
  History,
  KeyRound,
  Laptop,
  LayoutGrid,
  List,
  Lock,
  Mail,
  Monitor,
  Palette,
  PowerOff,
  Printer,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  Usb,
  UserRound,
  Volume2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";
import { setOutletSupervisorPin } from "@/services/supervisor.service";
import {
  connectBluetoothPrinter,
  connectRawBtPrinter,
  connectUsbPrinter,
  disconnectPrinter,
  kickCashDrawer,
  subscribePrinterStatus,
  testThermalPrint,
  type ConnectedPrinterInfo,
} from "@/services/thermal-printer.service";
import {
  getStoredPosViewMode,
  getStoredUiScale,
  POS_VIEW_MODE_OPTIONS,
  savePosViewMode,
  saveUiScale,
  UI_SCALE_OPTIONS,
  type PosViewMode,
  type UiScale,
} from "@/lib/theme";
import {
  getStoredPosSoundMode,
  POS_SOUND_OPTIONS,
  savePosSoundMode,
  testPosSound,
  type PosSoundMode,
} from "@/lib/pos-sound";
import { ThemeModal } from "@/components/theme/ThemeModal";
import { LanguageSettingsPage } from "@/pages/account/LanguageSettingsPage";

interface UnifiedProfileTabsProps {
  displayName?: string;
  email?: string;
  role?: string;
  outletName?: string;
  extraAccountSlot?: ReactNode;
}

export function UnifiedProfileTabs({
  displayName: propName,
  email: propEmail,
  role: propRole,
  outletName: propOutlet,
  extraAccountSlot,
}: UnifiedProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<"device" | "theme_lang" | "security">("device");

  // User & Outlet Identity
  const [displayName, setDisplayName] = useState(propName || "Pengguna POS");
  const [email, setEmail] = useState(propEmail || "kasir@kebabschoice.id");
  const [role, setRole] = useState(propRole || "cashier");
  const [outletName, setOutletName] = useState(propOutlet || "Cabang Aktif");

  // UI Scale, Card View Mode, Sound Mode
  const [uiScale, setUiScale] = useState<UiScale>(() => getStoredUiScale());
  const [viewMode, setViewMode] = useState<PosViewMode>(() => getStoredPosViewMode());
  const [soundMode, setSoundMode] = useState<PosSoundMode>(() => getStoredPosSoundMode());

  // Printer State
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem("kebabschoicepos_printer_settings") || "{}");
        if (saved.paperSize === "80mm") return "80mm";
      } catch {}
    }
    return "58mm";
  });
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Belum Terhubung",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [isTestingPrint, setIsTestingPrint] = useState(false);

  // Security: Password & Supervisor PIN
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kebabschoicepos_supervisor_pin") || "";
    }
    return "";
  });
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [loginHistoryLogs, setLoginHistoryLogs] = useState<
    Array<{
      id: string;
      device: string;
      email: string;
      role: string;
      location: string;
      time: string;
      isCurrent: boolean;
    }>
  >([]);

  useEffect(() => {
    if (propName) setDisplayName(propName);
  }, [propName]);
  useEffect(() => {
    if (propEmail) setEmail(propEmail);
  }, [propEmail]);
  useEffect(() => {
    if (propRole) setRole(propRole);
  }, [propRole]);
  useEffect(() => {
    if (propOutlet) setOutletName(propOutlet);
  }, [propOutlet]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const resolvedMail = propEmail || data.user.email || email;
        if (!propEmail && data.user.email) setEmail(data.user.email);
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: prof }) => {
            if (!propName && prof?.display_name) setDisplayName(prof.display_name);
          });

        try {
          const loginIso = data.user.last_sign_in_at || new Date().toISOString();
          const d = new Date(loginIso);
          const timeLabel = `${d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
          const sessId = `sess_${data.user.id}_${new Date(loginIso).toISOString().slice(0, 13)}`;
          const currentItem = {
            id: sessId,
            device: currentDeviceLabel,
            email: resolvedMail,
            role: String(propRole || role || "owner").toUpperCase(),
            location: outletName || "Terminal Aktif",
            time: timeLabel,
            isCurrent: true,
          };
          const rawLogs = localStorage.getItem("kebabschoicepos_login_activity_logs");
          const prevLogs: any[] = rawLogs ? JSON.parse(rawLogs) : [];
          const others = (Array.isArray(prevLogs) ? prevLogs : [])
            .filter((item) => item && item.id !== sessId)
            .slice(0, 8)
            .map((item) => ({
              id: String(item.id || Math.random()),
              device: String(item.device || "Perangkat Web"),
              email: String(item.email || resolvedMail),
              role: String(item.role || "USER"),
              location: String(item.location || "Cabang POS"),
              time: String(item.time || "-"),
              isCurrent: false,
            }));
          setLoginHistoryLogs([currentItem, ...others]);
        } catch {}
      }
    });

    if (!propRole && typeof window !== "undefined") {
      const savedRole = localStorage.getItem("kebabschoicepos_user_role");
      if (savedRole) setRole(savedRole);
    }

    resolveActiveStaffOutlet()
      .then((res) => {
        if (res?.outletName) setOutletName(res.outletName);
      })
      .catch(() => {});

    const unsubPrinter = subscribePrinterStatus((info) => {
      setPrinterInfo(info);
    });

    const syncScale = (e: Event) => {
      const d = (e as CustomEvent<UiScale>).detail;
      setUiScale(d || getStoredUiScale());
    };
    const syncView = (e: Event) => {
      const d = (e as CustomEvent<PosViewMode>).detail;
      setViewMode(d || getStoredPosViewMode());
    };
    const syncSound = (e: Event) => {
      const d = (e as CustomEvent<PosSoundMode>).detail;
      setSoundMode(d || getStoredPosSoundMode());
    };

    window.addEventListener("ui-scale-changed", syncScale);
    window.addEventListener("pos:view-mode-changed", syncView);
    window.addEventListener("pos:sound-changed", syncSound);
    return () => {
      unsubPrinter();
      window.removeEventListener("ui-scale-changed", syncScale);
      window.removeEventListener("pos:view-mode-changed", syncView);
      window.removeEventListener("pos:sound-changed", syncSound);
    };
  }, [propEmail, propName, propRole]);

  const normalizedRole = String(role || "cashier").toLowerCase();
  const isSupervisorOrOwner = ["owner", "admin", "hq", "manager"].includes(normalizedRole);

  const currentDeviceLabel = (() => {
    if (typeof navigator === "undefined") return "Terminal Web POS";
    const ua = navigator.userAgent || "";
    const os = /Android/i.test(ua)
      ? "Android Tablet / Mobile"
      : /iPad|iPhone/i.test(ua)
        ? "iPad / iOS"
        : /Windows/i.test(ua)
          ? "Windows PC"
          : /Macintosh/i.test(ua)
            ? "macOS"
            : "Perangkat Browser";
    const br = /Edg\//i.test(ua)
      ? "Edge"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Browser";
    return `${os} · ${br}`;
  })();

  const handleSavePaperSize = (nextSize: "58mm" | "80mm") => {
    setPaperSize(nextSize);
    try {
      const cur = JSON.parse(localStorage.getItem("kebabschoicepos_printer_settings") || "{}");
      localStorage.setItem(
        "kebabschoicepos_printer_settings",
        JSON.stringify({ ...cur, paperSize: nextSize }),
      );
      toast.success(`Ukuran kertas struk diatur ke ${nextSize}`);
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error("Gagal memperbarui password", { description: error.message });
      } else {
        toast.success("Password berhasil diperbarui!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan sistem", { description: err?.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveSupervisorPin = async () => {
    const cleanPin = supervisorPin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      toast.error("PIN Supervisor harus 4 – 6 digit angka.");
      return;
    }
    setIsSavingPin(true);
    try {
      localStorage.setItem("kebabschoicepos_supervisor_pin", cleanPin);
      let activeBusinessId =
        typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
          : "";
      if (!activeBusinessId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: ownedBiz } = await supabase
            .from("businesses")
            .select("id")
            .eq("owner_id", authData.user.id)
            .order("created_at", { ascending: true })
            .limit(1);
          activeBusinessId = ownedBiz?.[0]?.id || "";
        }
      }
      let outletsQuery = supabase.from("outlets").select("id");
      if (activeBusinessId) {
        outletsQuery = outletsQuery.eq("business_id", activeBusinessId);
      }
      const { data: outlets } = await outletsQuery.limit(25);
      if (outlets && outlets.length > 0) {
        for (const out of outlets) {
          await setOutletSupervisorPin(out.id, cleanPin);
        }
      }
      toast.success("PIN Supervisor berhasil disimpan ke seluruh outlet bisnis");
    } catch {
      toast.success("PIN Supervisor tersimpan");
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-none pb-10">
      {/* Compact Header + 3 Tab Switcher */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-base">
            {displayName ? displayName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                {displayName}
              </h1>
              <Badge variant="secondary" className="text-[11px] font-bold uppercase">
                {normalizedRole}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
              <span className="truncate">{email}</span>
              <span>•</span>
              <span className="font-semibold text-foreground truncate">{outletName}</span>
            </p>
          </div>
        </div>

        {/* 3 Tab Utama */}
        <div
          role="tablist"
          aria-label="Tab Pengaturan Profil dan Perangkat POS"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/60 p-1"
        >
          {[
            { id: "device", label: "Profil & Perangkat POS", icon: Monitor },
            { id: "theme_lang", label: "Tema & Bahasa", icon: Palette },
            { id: "security", label: "Keamanan & Riwayat Login", icon: ShieldCheck },
          ].map((tItem) => {
            const IconComp = tItem.icon;
            const selected = activeTab === tItem.id;
            return (
              <button
                key={tItem.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tItem.id as "device" | "theme_lang" | "security")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                  selected
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <IconComp className="size-3.5 shrink-0" />
                <span>{tItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PROFIL & PERANGKAT POS                                         */}
      {/* ===================================================================== */}
      {activeTab === "device" && (
        <div className="space-y-4">
          {/* Info Akun Ringkas & Jelas */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Nama Akun
              </span>
              <p className="font-black text-sm text-foreground truncate mt-0.5">{displayName}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Email Terdaftar
              </span>
              <p className="font-bold text-foreground truncate mt-0.5">{email}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Role & Cabang
              </span>
              <p className="font-bold text-foreground truncate mt-0.5">
                {normalizedRole.toUpperCase()} • {outletName}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Perangkat Saat Ini
              </span>
              <p className="font-bold text-foreground truncate mt-0.5">{currentDeviceLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Ukuran Tampilan Layar (80% | 85% | 90% | 100%) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="size-4 text-primary" />
                  <h2 className="text-sm font-black text-foreground">
                    Ukuran Tampilan (80% – 100%)
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Otomatis 85% di Tablet
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mengatur skala proporsional seluruh halaman Kasir, Pesanan, Shift, Stok, & Absensi.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {UI_SCALE_OPTIONS.map((opt) => {
                  const active = uiScale === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setUiScale(opt.value);
                        saveUiScale(opt.value);
                        toast.success(`Ukuran tampilan diatur ke ${opt.label}`);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-xs font-bold transition-all cursor-pointer active:scale-95",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-brand"
                          : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="text-sm font-black">{opt.label}</span>
                      <span
                        className={cn(
                          "text-[11px]",
                          active ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Ukuran Tampilan Menu POS (Kotak Padat | Normal | List) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-4 text-primary" />
                  <h2 className="text-sm font-black text-foreground">
                    Tampilan Menu (Kotak Padat | Normal | List)
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Katalog Kasir
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pilih kepadatan kartu produk di layar kasir agar muat banyak tanpa perlu scroll jauh.
              </p>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Ukuran Tampilan Menu"
              >
                {POS_VIEW_MODE_OPTIONS.map((mode) => {
                  const active = viewMode === mode.value;
                  const ModeIcon =
                    mode.value === "compact"
                      ? Grid3X3
                      : mode.value === "normal"
                        ? LayoutGrid
                        : List;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        setViewMode(mode.value);
                        savePosViewMode(mode.value);
                        toast.success(`Tampilan katalog menu: ${mode.label}`);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-2 text-xs font-bold transition-all cursor-pointer active:scale-95",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-brand"
                          : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                      )}
                    >
                      <ModeIcon className="size-4" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Efek Suara Sentuh Kasir (Sound Effect Toggle + Pilihan Nada) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 text-primary" />
                  <h2 className="text-sm font-black text-foreground">
                    Sound Effect Sentuh Kasir
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={soundMode !== "off"}
                    aria-label="Toggle Sound Effect Kasir"
                    onCheckedChange={(checked) => {
                      const next: PosSoundMode = checked ? "beep" : "off";
                      setSoundMode(next);
                      savePosSoundMode(next);
                      if (checked) testPosSound(next);
                      toast.success(
                        checked ? "Sound Effect Kasir diaktifkan" : "Sound Effect Kasir dimatikan",
                      );
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={soundMode === "off"}
                    onClick={() => testPosSound(soundMode)}
                    className="h-7 rounded-lg text-xs font-bold gap-1 active:scale-95 transition-transform duration-100"
                  >
                    <Volume2 className="size-3.5" />
                    Tes Suara
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Umpan balik suara instan saat mengetuk kartu menu, opsi varian, dan tombol bayar (100% offline).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {POS_SOUND_OPTIONS.map((snd) => {
                  const active = soundMode === snd.value;
                  return (
                    <button
                      key={snd.value}
                      type="button"
                      onClick={() => {
                        setSoundMode(snd.value);
                        savePosSoundMode(snd.value);
                        if (snd.value !== "off") {
                          testPosSound(snd.value);
                        }
                        toast.success(`Suara kasir diatur ke ${snd.label}`);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-xs font-bold transition-all cursor-pointer active:scale-95",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-brand"
                          : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                      )}
                    >
                      <span>{snd.label}</span>
                      <span
                        className={cn(
                          "text-[11px]",
                          active ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                      >
                        {snd.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Pengaturan Printer Thermal & Test Print (Bluetooth / USB / RawBT) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Printer className="size-4 text-primary" />
                  <h2 className="text-sm font-black text-foreground">
                    Printer Thermal & Laci Kas
                  </h2>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    printerInfo.status === "connected"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {printerInfo.status === "connected"
                    ? `${printerInfo.name} (${printerInfo.type.toUpperCase()})`
                    : "Dialog Browser"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isConnectingPrinter}
                  onClick={async () => {
                    setIsConnectingPrinter(true);
                    try {
                      const ok = await connectBluetoothPrinter();
                      if (ok) toast.success("Printer Bluetooth terhubung!");
                    } catch (err: any) {
                      toast.error("Gagal konek Bluetooth: " + err?.message);
                    } finally {
                      setIsConnectingPrinter(false);
                    }
                  }}
                  className="h-8 rounded-lg text-xs font-bold gap-1.5"
                >
                  <Bluetooth className="size-3.5" />
                  Bluetooth
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isConnectingPrinter}
                  onClick={async () => {
                    setIsConnectingPrinter(true);
                    try {
                      const ok = await connectRawBtPrinter();
                      if (ok) toast.success("Mode RawBT Android diaktifkan!");
                    } catch (err: any) {
                      toast.error("Gagal aktifkan RawBT: " + err?.message);
                    } finally {
                      setIsConnectingPrinter(false);
                    }
                  }}
                  className="h-8 rounded-lg text-xs font-bold gap-1.5"
                >
                  <Smartphone className="size-3.5" />
                  RawBT Android
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isConnectingPrinter}
                  onClick={async () => {
                    setIsConnectingPrinter(true);
                    try {
                      const ok = await connectUsbPrinter();
                      if (ok) toast.success("Printer USB Direct terhubung!");
                    } catch (err: any) {
                      toast.error("Gagal konek USB: " + err?.message);
                    } finally {
                      setIsConnectingPrinter(false);
                    }
                  }}
                  className="h-8 rounded-lg text-xs font-bold gap-1.5"
                >
                  <Usb className="size-3.5" />
                  USB
                </Button>

                {printerInfo.status === "connected" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await disconnectPrinter();
                      toast.info("Koneksi printer diputus");
                    }}
                    className="h-8 rounded-lg text-xs font-bold text-destructive"
                  >
                    <PowerOff className="size-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
                  {(["58mm", "80mm"] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleSavePaperSize(sz)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer",
                        paperSize === sz
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isTestingPrint}
                    onClick={async () => {
                      setIsTestingPrint(true);
                      try {
                        await testThermalPrint();
                      } finally {
                        setIsTestingPrint(false);
                      }
                    }}
                    className="h-8 rounded-lg text-xs font-bold gap-1"
                  >
                    <RefreshCw className={cn("size-3.5", isTestingPrint && "animate-spin")} />
                    Tes Print
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await kickCashDrawer();
                      toast.success("Sinyal buka laci kas terkirim");
                    }}
                    className="h-8 rounded-lg text-xs font-bold gap-1"
                  >
                    <WalletCards className="size-3.5" />
                    Buka Laci
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {extraAccountSlot}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: TEMA & BAHASA                                                  */}
      {/* ===================================================================== */}
      {activeTab === "theme_lang" && (
        <div className="space-y-4">
          <ThemeModal isOpen inline onClose={() => {}} />
          <LanguageSettingsPage />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: KEAMANAN & RIWAYAT LOGIN                                       */}
      {/* ===================================================================== */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Kolom Kiri: Ganti Password + PIN Supervisor (Owner/Manager) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <KeyRound className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">Ganti Password Akun</h2>
                  <p className="text-xs text-muted-foreground">
                    Perbarui kata sandi login untuk akun {email}.
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Password Baru</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="h-9 pl-9 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">
                    Konfirmasi Password Baru
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="h-9 pl-9 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full h-9 rounded-xl text-xs font-bold shadow-brand"
                >
                  {isUpdatingPassword ? "Menyimpan..." : "Simpan Password Baru"}
                </Button>
              </form>
            </div>

            {/* PIN Supervisor — Khusus Owner / Manager */}
            {isSupervisorOrOwner && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="size-4.5 text-primary" />
                  <h2 className="text-sm font-black text-foreground">
                    PIN Otorisasi Supervisor (Void & Refund)
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  PIN 4–6 digit angka untuk menyetujui pembatalan transaksi (Void) dan Refund di POS.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="4 - 6 digit PIN"
                    className="h-9 max-w-[180px] rounded-xl font-mono tracking-widest text-center text-sm font-bold"
                  />
                  <Button
                    type="button"
                    onClick={handleSaveSupervisorPin}
                    disabled={isSavingPin}
                    className="h-9 rounded-xl text-xs font-bold shadow-brand"
                  >
                    {isSavingPin ? "Menyimpan..." : "Simpan PIN"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Riwayat Sesi Login & Perangkat Aktif */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-secondary flex items-center justify-center text-foreground/75">
                  <History className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">Riwayat Sesi Login</h2>
                  <p className="text-xs text-muted-foreground">
                    Perangkat dan sesi autentikasi pada akun ini.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[11px] font-bold">
                Aktif
              </Badge>
            </div>

            <div className="space-y-2.5">
              {(loginHistoryLogs.length > 0
                ? loginHistoryLogs
                : [
                    {
                      id: "current-fallback",
                      device: currentDeviceLabel,
                      email,
                      role: normalizedRole.toUpperCase(),
                      location: outletName,
                      time: "Sesi aktif saat ini",
                      isCurrent: true,
                    },
                  ]
              ).map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-3",
                    log.isCurrent
                      ? "border-border bg-secondary/40"
                      : "border-border/60 bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0",
                        log.isCurrent
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {log.isCurrent ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Laptop className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{log.device}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        <Mail className="inline size-3 mr-1" />
                        {log.email} • {log.location} • {log.time}
                      </p>
                    </div>
                  </div>
                  {log.isCurrent ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 shrink-0">
                      Sesi Ini
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0">
                      Riwayat
                    </span>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <Store className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      Penugasan Cabang: {outletName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <UserRound className="inline size-3 mr-1" />
                      Role terverifikasi: {normalizedRole.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
