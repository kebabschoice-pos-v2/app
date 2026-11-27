import { useEffect, useState, type ReactNode } from "react";
import {
  Bluetooth,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Download,
  Globe2,
  Grid3X3,
  History,
  KeyRound,
  Laptop,
  LayoutGrid,
  List,
  Lock,
  LogOut,
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
import { Progress } from "@/components/ui/progress";
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
  discoverPairedBluetoothPrinters,
  isNativeCapacitorPlatform,
  kickCashDrawer,
  selectPairedBluetoothPrinter,
  subscribePrinterStatus,
  testThermalPrint,
  type ConnectedPrinterInfo,
  type PairedBluetoothPrinter,
} from "@/services/thermal-printer.service";
import {
  getStoredPosViewMode,
  getStoredTheme,
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
  playPosSound,
  POS_SOUND_OPTIONS,
  savePosSoundMode,
  testPosSound,
  type PosSoundMode,
} from "@/lib/pos-sound";
import { useTranslation } from "@/lib/i18n";
import { ThemeModal } from "@/components/theme/ThemeModal";
import { LanguageSettingsPage } from "@/pages/account/LanguageSettingsPage";
import {
  getRecentNotificationsNative,
  isNativeApkEnvironment,
  isNotificationAccessEnabledNative,
  openNotificationAccessSettingsNative,
  subscribePaymentNotifications,
  type RecentNotificationLogItem,
} from "@/lib/native-qris-auto-confirm";
import {
  checkForAppUpdate,
  downloadAndInstallApkUpdate,
  formatApkBytes,
  getAppUpdateState,
  subscribeAppUpdateState,
  type AppUpdateState,
} from "@/lib/app-updater";

export type ProfileMenuSection =
  | "display"
  | "printer"
  | "theme"
  | "language"
  | "security"
  | "login_history"
  | "logout";

interface UnifiedProfileTabsProps {
  displayName?: string;
  email?: string;
  role?: string;
  outletName?: string;
  extraAccountSlot?: ReactNode;
  onSignOut?: () => Promise<void> | void;
}

export function UnifiedProfileTabs({
  displayName: propName,
  email: propEmail,
  role: propRole,
  outletName: propOutlet,
  extraAccountSlot,
  onSignOut,
}: UnifiedProfileTabsProps) {
  const { t, language } = useTranslation();
  const [activeSection, setActiveSection] = useState<ProfileMenuSection | null>(null);

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
  const [pairedBtDevices, setPairedBtDevices] = useState<PairedBluetoothPrinter[]>([]);
  const [showPairedBtPicker, setShowPairedBtPicker] = useState(false);
  const [isNativeApk] = useState<boolean>(() => isNativeApkEnvironment());
  const [notifAccessEnabled, setNotifAccessEnabled] = useState<boolean>(false);
  const [recentNotifLogs, setRecentNotifLogs] = useState<RecentNotificationLogItem[]>([]);
  const [isLoadingNotifLogs, setIsLoadingNotifLogs] = useState<boolean>(false);
  const [appUpdate, setAppUpdate] = useState<AppUpdateState>(() => getAppUpdateState());

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
  const [isSigningOut, setIsSigningOut] = useState(false);
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

    const refreshNotifAccess = () => {
      if (isNativeApkEnvironment()) {
        isNotificationAccessEnabledNative()
          .then((enabled) => setNotifAccessEnabled(enabled))
          .catch(() => {});
        getRecentNotificationsNative()
          .then((logs) => setRecentNotifLogs(logs))
          .catch(() => {});
      }
    };
    refreshNotifAccess();
    window.addEventListener("focus", refreshNotifAccess);
    document.addEventListener("visibilitychange", refreshNotifAccess);

    const unsubAppUpdate = subscribeAppUpdateState((nextUpdate) => {
      setAppUpdate(nextUpdate);
    });
    if (isNativeApkEnvironment()) {
      void checkForAppUpdate();
    }
    const unsubLiveNotif = isNativeApkEnvironment()
      ? subscribePaymentNotifications(() => {
          getRecentNotificationsNative()
            .then((logs) => setRecentNotifLogs(logs))
            .catch(() => {});
        })
      : () => {};

    return () => {
      unsubPrinter();
      unsubAppUpdate();
      unsubLiveNotif();
      window.removeEventListener("ui-scale-changed", syncScale);
      window.removeEventListener("pos:view-mode-changed", syncView);
      window.removeEventListener("pos:sound-changed", syncSound);
      window.removeEventListener("focus", refreshNotifAccess);
      document.removeEventListener("visibilitychange", refreshNotifAccess);
    };
  }, [propEmail, propName, propRole]);

  useEffect(() => {
    if (activeSection === "display" && isNativeApkEnvironment()) {
      getRecentNotificationsNative()
        .then((logs) => setRecentNotifLogs(logs))
        .catch(() => {});
    }
  }, [activeSection]);

  const handleReloadNotificationLogs = async () => {
    setIsLoadingNotifLogs(true);
    try {
      const [enabled, logs] = await Promise.all([
        isNotificationAccessEnabledNative(),
        getRecentNotificationsNative(),
      ]);
      setNotifAccessEnabled(enabled);
      setRecentNotifLogs(logs);
      toast.success(
        logs.length > 0
          ? `Memuat ${logs.length} riwayat notifikasi terakhir`
          : "Log dimuat ulang (belum ada notifikasi baru di memori)",
      );
    } catch {
      toast.error("Gagal memuat log notifikasi.");
    } finally {
      setIsLoadingNotifLogs(false);
    }
  };

  const handleManualCheckAppUpdate = async () => {
    const res = await checkForAppUpdate({ force: true });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.hasUpdate) {
      toast.success(`Update Aplikasi Tersedia (v${res.latestVersion})!`);
    } else {
      toast.success(
        `Aplikasi sudah menggunakan versi terbaru (v${res.installedVersion}).`,
      );
    }
  };

  const normalizedRole = String(role || "cashier").toLowerCase();
  const isSupervisorOrOwner = ["owner", "admin", "hq", "manager"].includes(normalizedRole);

  const handleSavePaperSize = (nextSize: "58mm" | "80mm") => {
    setPaperSize(nextSize);
    try {
      const cur = JSON.parse(localStorage.getItem("kebabschoicepos_printer_settings") || "{}");
      localStorage.setItem(
        "kebabschoicepos_printer_settings",
        JSON.stringify({ ...cur, paperSize: nextSize }),
      );
      toast.success(
        language === "en"
          ? `Receipt paper width set to ${nextSize}`
          : `Ukuran kertas struk diatur ke ${nextSize}`,
      );
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(
        language === "en" ? "Password must be at least 6 characters" : "Password minimal 6 karakter",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(
        language === "en"
          ? "New password confirmation does not match"
          : "Konfirmasi password baru tidak cocok",
      );
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(
          language === "en" ? "Failed to update password" : "Gagal memperbarui password",
          { description: error.message },
        );
      } else {
        toast.success(
          language === "en" ? "Password updated successfully!" : "Password berhasil diperbarui!",
        );
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error(language === "en" ? "System error occurred" : "Terjadi kesalahan sistem", {
        description: err?.message,
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveSupervisorPin = async () => {
    const cleanPin = supervisorPin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      toast.error(
        language === "en"
          ? "Supervisor PIN must be 4 – 6 digits."
          : "PIN Supervisor harus 4 – 6 digit angka.",
      );
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
      toast.success(
        language === "en"
          ? "Supervisor PIN saved across all business outlets"
          : "PIN Supervisor berhasil disimpan ke seluruh outlet bisnis",
      );
    } catch {
      toast.success(language === "en" ? "Supervisor PIN saved" : "PIN Supervisor tersimpan");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleExecuteLogout = async () => {
    setIsSigningOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("kebabschoicepos_swr_snapshot_v1");
        localStorage.removeItem("kebabschoicepos_swr_profile_v1");
      }
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  const storedTheme = getStoredTheme();

  const settingsMenuItems: Array<{
    id: ProfileMenuSection;
    icon: typeof Monitor;
    title: string;
    subtitle: string;
    badge?: string;
    destructive?: boolean;
  }> = [
    {
      id: "display",
      icon: Monitor,
      title: t("profile.menu_display_title", "Tampilan & Perangkat Kasir"),
      subtitle: t(
        "profile.menu_display_sub",
        "Ukuran Layar 80%–100%, Tampilan Menu Kotak/Normal/List, Sound Effect",
      ),
      badge: `${uiScale}%`,
    },
    {
      id: "printer",
      icon: Printer,
      title: t("profile.menu_printer_title", "Printer Thermal & Struk"),
      subtitle: t(
        "profile.menu_printer_sub",
        "Bluetooth, RawBT Android, USB, 58mm/80mm, Test Print, Buka Laci",
      ),
      badge: paperSize,
    },
    {
      id: "theme",
      icon: Palette,
      title: t("profile.menu_theme_title", "Tema Warna & Mode"),
      subtitle: t("profile.menu_theme_sub", "Light / Dark / System & Warna Tema"),
      badge: storedTheme.appearance.toUpperCase(),
    },
    {
      id: "language",
      icon: Globe2,
      title: t("profile.menu_language_title", "Bahasa Aplikasi"),
      subtitle: t("profile.menu_language_sub", "Bahasa Indonesia / English"),
      badge: language.toUpperCase(),
    },
    {
      id: "security",
      icon: ShieldCheck,
      title: t("profile.menu_security_title", "Keamanan & Password"),
      subtitle: t(
        "profile.menu_security_sub",
        "Ganti Password & PIN Supervisor khusus Owner/Manager",
      ),
    },
    {
      id: "login_history",
      icon: History,
      title: t("profile.menu_login_title", "Riwayat Login"),
      subtitle: t("profile.menu_login_sub", "Daftar sesi login aktif"),
      badge: t("common.active", "Aktif"),
    },
    {
      id: "logout",
      icon: LogOut,
      title: t("profile.menu_logout_title", "Keluar Akun (Logout)"),
      subtitle: t("profile.menu_logout_sub", "Akhiri sesi kasir atau akun pada perangkat ini"),
      destructive: true,
    },
  ];

  const activeMenuItem = settingsMenuItems.find((item) => item.id === activeSection) || null;

  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto pb-10">
      {/* Header Profil Singkat di Atas */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3.5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-base">
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
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap truncate mt-0.5">
              <span className="truncate">{email}</span>
              <span>•</span>
              <span className="font-semibold text-foreground truncate">{outletName}</span>
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap shrink-0">
          {currentDeviceLabel}
        </span>
      </div>

      {/* Banner & Kontrol Update Aplikasi (.apk) Otomatis di Tablet */}
      {isNativeApk && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 shadow-xs space-y-2.5",
            appUpdate.hasUpdate
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-card",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  appUpdate.hasUpdate
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground/80",
                )}
              >
                <Download className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-foreground truncate">
                  {appUpdate.hasUpdate
                    ? `Update Aplikasi Tersedia (v${appUpdate.latestVersion})`
                    : `Aplikasi Tablet POS (v${appUpdate.installedVersion})`}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {appUpdate.downloading
                    ? `Mengunduh pembaruan... ${appUpdate.downloadProgress}%${
                        appUpdate.totalBytes > 0
                          ? ` (${formatApkBytes(appUpdate.downloadedBytes)} / ${formatApkBytes(appUpdate.totalBytes)})`
                          : ""
                      }`
                    : appUpdate.installTriggered
                      ? "Unduhan selesai (100%) • Konfirmasi dialog Update Android untuk memasang tanpa uninstall"
                      : appUpdate.hasUpdate
                        ? `Terpasang v${appUpdate.installedVersion} • Tap Unduh & Update untuk pasang langsung tanpa browser`
                        : "Periksa ketersediaan rilis APK terbaru langsung dari server GitHub"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {appUpdate.hasUpdate && appUpdate.downloadUrl && (
                <Button
                  type="button"
                  size="sm"
                  aria-label="Unduh Update Aplikasi"
                  disabled={appUpdate.downloading}
                  onClick={async () => {
                    const res = await downloadAndInstallApkUpdate(appUpdate.downloadUrl);
                    if (!res.ok && res.mode === "error") {
                      toast.error(res.error || "Gagal mengunduh pembaruan aplikasi.");
                    } else if (res.ok && res.mode === "native_installer") {
                      toast.success("Unduhan selesai (100%)! Ketuk Update pada dialog Android.");
                    }
                  }}
                  className="h-8 rounded-xl text-xs font-black gap-1.5 shadow-brand"
                >
                  {appUpdate.downloading ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{appUpdate.downloadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" />
                      <span>Unduh &amp; Update</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={appUpdate.checking || appUpdate.downloading}
                onClick={handleManualCheckAppUpdate}
                className="h-8 rounded-xl text-xs font-bold gap-1.5"
              >
                <RefreshCw className={cn("size-3.5", appUpdate.checking && "animate-spin")} />
                <span>Cek Update Aplikasi</span>
              </Button>
            </div>
          </div>

          {appUpdate.downloading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                <span>Mengunduh pembaruan... {appUpdate.downloadProgress}%</span>
                {appUpdate.totalBytes > 0 && (
                  <span className="font-mono text-muted-foreground">
                    {formatApkBytes(appUpdate.downloadedBytes)} / {formatApkBytes(appUpdate.totalBytes)}
                  </span>
                )}
              </div>
              <Progress
                value={appUpdate.downloadProgress}
                aria-label="Progress unduhan pembaruan APK"
                className="h-2"
              />
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE DAFTAR MENU PENGATURAN (SAAT BELUM ADA SUB-MENU YANG DIKLIK)      */}
      {/* ===================================================================== */}
      {activeSection === null ? (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/60 bg-muted/25">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("profile.settings_header", "Pengaturan Aplikasi & Perangkat")}
            </p>
          </div>

          <div
            role="list"
            aria-label="Menu Pengaturan Profil dan Perangkat"
            className="divide-y divide-border/60"
          >
            {settingsMenuItems.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  onClick={() => {
                    playPosSound("option");
                    setActiveSection(item.id);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer active:bg-secondary/70",
                    item.destructive
                      ? "hover:bg-destructive/5 text-destructive"
                      : "hover:bg-secondary/50 text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        item.destructive
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <IconComp className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-bold truncate",
                          item.destructive ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                    <span className="sr-only">&gt;</span>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0",
                        item.destructive ? "text-destructive/75" : "text-muted-foreground",
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* HALAMAN / PANEL KHUSUS SUB-MENU DENGAN TOMBOL "← Kembali" DI ATAS    */
        /* =================================================================== */
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Bar Navigasi Kembali */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
            <button
              type="button"
              onClick={() => {
                playPosSound("option");
                setActiveSection(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 text-xs font-bold text-foreground transition-colors cursor-pointer active:scale-95"
            >
              <span>{t("profile.back", "← Kembali")}</span>
            </button>
            {activeMenuItem && (
              <span className="text-xs sm:text-sm font-black text-foreground truncate">
                {activeMenuItem.title}
              </span>
            )}
          </div>

          {/* 1. TAMPILAN & PERANGKAT KASIR */}
          {activeSection === "display" && (
            <div className="space-y-4">
              {/* Info Akun Ringkas */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    {t("profile.account_name", "Nama Akun")}
                  </span>
                  <p className="font-black text-sm text-foreground truncate mt-0.5">
                    {displayName}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    {t("profile.registered_email", "Email Terdaftar")}
                  </span>
                  <p className="font-bold text-foreground truncate mt-0.5">{email}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    {t("profile.role_branch", "Role & Cabang")}
                  </span>
                  <p className="font-bold text-foreground truncate mt-0.5">
                    {normalizedRole.toUpperCase()} • {outletName}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    {t("profile.current_device", "Perangkat Saat Ini")}
                  </span>
                  <p className="font-bold text-foreground truncate mt-0.5">{currentDeviceLabel}</p>
                </div>
              </div>

              {/* Ukuran Tampilan Layar (80% | 85% | 90% | 100%) */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="size-4 text-primary" />
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.ui_scale_title", "Ukuran Tampilan (80% – 100%)")}
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {t("profile.ui_scale_auto", "Otomatis 85% di Tablet")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "profile.ui_scale_desc",
                    "Mengatur skala proporsional seluruh halaman Kasir, Pesanan, Shift, Stok, & Absensi.",
                  )}
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
                          toast.success(
                            language === "en"
                              ? `Display scale set to ${opt.label}`
                              : `Ukuran tampilan diatur ke ${opt.label}`,
                          );
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

              {/* Tampilan Menu POS (Kotak Padat | Normal | List) */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="size-4 text-primary" />
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.view_mode_title", "Tampilan Menu (Kotak Padat | Normal | List)")}
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {t("profile.view_mode_badge", "Katalog Kasir")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "profile.view_mode_desc",
                    "Pilih kepadatan kartu produk di layar kasir agar muat banyak tanpa perlu scroll jauh.",
                  )}
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
                          toast.success(
                            language === "en"
                              ? `Catalog layout: ${mode.label}`
                              : `Tampilan katalog menu: ${mode.label}`,
                          );
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

              {/* Sound Effect Sentuh Kasir */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="size-4 text-primary" />
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.sound_title", "Sound Effect Sentuh Kasir")}
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
                          checked
                            ? language === "en"
                              ? "POS Sound Effects enabled"
                              : "Sound Effect Kasir diaktifkan"
                            : language === "en"
                              ? "POS Sound Effects muted"
                              : "Sound Effect Kasir dimatikan",
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
                      {t("profile.test_sound", "Tes Suara")}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "profile.sound_desc",
                    "Umpan balik suara instan saat mengetuk kartu menu, opsi varian, dan tombol bayar (100% offline).",
                  )}
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
                          toast.success(
                            language === "en"
                              ? `POS sound set to ${snd.label}`
                              : `Suara kasir diatur ke ${snd.label}`,
                          );
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

              {/* Auto-Lunas QRIS (Shopee Partner) — Khusus di dalam .apk Android */}
              {isNativeApk && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <BellRing className="size-4 text-primary" />
                      <h2 className="text-sm font-black text-foreground">
                        Auto-Lunas QRIS (Shopee Partner)
                      </h2>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        notifAccessEnabled
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {notifAccessEnabled ? "Aktif" : "Belum Aktif"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mendeteksi notifikasi pembayaran QRIS masuk dari aplikasi Shopee Partner, GoPay
                    Merchant, DANA, OVO, & m-banking secara otomatis dan melunaskan tagihan kasir
                    bila nominal cocok.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={notifAccessEnabled ? "outline" : "default"}
                      onClick={async () => {
                        try {
                          const opened = await openNotificationAccessSettingsNative();
                          if (opened) {
                            toast.info(
                              "Geser saklar 'KebabsChoice POS' pada daftar Akses Notifikasi Android.",
                            );
                          } else {
                            toast.error(
                              "Pengaturan Akses Notifikasi belum tersedia. Pastikan APK versi terbaru sudah terpasang di tablet.",
                            );
                          }
                        } catch {
                          toast.error("Gagal membuka Pengaturan Akses Notifikasi Android.");
                        }
                      }}
                      className="h-9 rounded-xl text-xs font-bold gap-1.5"
                    >
                      <BellRing className="size-3.5" />
                      <span>Aktifkan Akses Notifikasi</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isLoadingNotifLogs}
                      onClick={handleReloadNotificationLogs}
                      className="h-9 rounded-xl text-xs font-bold gap-1.5"
                    >
                      <RefreshCw className={cn("size-3.5", isLoadingNotifLogs && "animate-spin")} />
                      <span>Muat Ulang Log</span>
                    </Button>
                  </div>

                  {/* Diagnostik 5 Riwayat Notifikasi Terakhir */}
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Log Diagnostik (5 Notifikasi Terakhir)
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {recentNotifLogs.length}/5 tercatat
                      </span>
                    </div>

                    {recentNotifLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Belum ada riwayat notifikasi di memori sesi ini. Pastikan Akses Notifikasi{" "}
                        <strong>Aktif</strong>, lalu ketuk <strong>Muat Ulang Log</strong> saat
                        notifikasi Shopee Partner masuk di tablet.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {recentNotifLogs.map((item, idx) => {
                          const timeStr = new Date(item.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          });
                          return (
                            <div
                              key={`${item.timestamp}-${item.packageName}-${idx}`}
                              className={cn(
                                "rounded-lg border px-2.5 py-2 text-xs space-y-1",
                                item.matched
                                  ? "border-emerald-500/35 bg-emerald-500/5"
                                  : "border-border/70 bg-card",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    item.matched
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                        : "bg-secondary text-muted-foreground",
                                    )}
                                  >
                                    {item.matched ? "Cocok • Auto-Lunas" : "Diabaikan"}
                                  </span>
                                  <span className="font-black text-foreground">
                                    {item.parsedAmount > 0
                                      ? `Rp ${item.parsedAmount.toLocaleString("id-ID")}`
                                      : "Nominal: -"}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                  {timeStr}
                                </span>
                              </div>
                              {(item.title || item.text) && (
                                <p className="text-[11px] text-foreground/90 break-words leading-snug">
                                  {item.title ? <strong>{item.title}: </strong> : null}
                                  {item.text || "-"}
                                </p>
                              )}
                              <p className="text-[10px] font-mono text-muted-foreground truncate">
                                pkg: {item.packageName || "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. PRINTER THERMAL & STRUK */}
          {activeSection === "printer" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Printer className="size-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.printer_panel_title", "Printer Thermal & Laci Kas")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "profile.menu_printer_sub",
                        "Bluetooth, RawBT Android, USB, 58mm/80mm, Test Print, Buka Laci",
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0",
                    printerInfo.status === "connected"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {printerInfo.status === "connected"
                    ? `${printerInfo.name} (${printerInfo.type.toUpperCase()})`
                    : t("profile.browser_dialog", "Dialog Browser")}
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
                      if ((window as any).Capacitor?.isNativePlatform?.()) {
                        const devices = await discoverPairedBluetoothPrinters();
                        setPairedBtDevices(devices);
                        setShowPairedBtPicker(true);
                        if (devices.length === 0) {
                          toast.info(
                            "Belum ada printer Bluetooth ter-pair di tablet. Pair di Pengaturan Bluetooth Android (PIN 0000 / 1234).",
                          );
                        } else {
                          toast.info(`Pilih printer (${devices.length} perangkat ter-pair)`);
                        }
                        return;
                      }
                      const ok = await connectBluetoothPrinter();
                      if (ok) toast.success("Printer Bluetooth terhubung!");
                    } catch (err: any) {
                      toast.error("Gagal konek Bluetooth: " + err?.message);
                    } finally {
                      setIsConnectingPrinter(false);
                    }
                  }}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5"
                >
                  <Bluetooth className="size-3.5" />
                  Hubungkan Bluetooth
                </Button>

                {!isNativeCapacitorPlatform() && (
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
                    className="h-9 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Smartphone className="size-3.5" />
                    RawBT Android
                  </Button>
                )}

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
                  className="h-9 rounded-xl text-xs font-bold gap-1.5"
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
                      setShowPairedBtPicker(false);
                      toast.info("Koneksi printer diputus");
                    }}
                    className="h-9 rounded-xl text-xs font-bold text-destructive"
                  >
                    <PowerOff className="size-3.5" />
                  </Button>
                )}
              </div>

              {showPairedBtPicker && (
                <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-foreground">
                      Printer Bluetooth Ter-pair di Tablet (Klik 1x)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPairedBtPicker(false)}
                      className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                  {pairedBtDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada printer yang di-pair di Pengaturan Bluetooth Android (PIN standar: 0000 / 1234).
                    </p>
                  ) : (
                    <div className="grid gap-1.5">
                      {pairedBtDevices.map((dev) => {
                        const isCurrent =
                          printerInfo.status === "connected" &&
                          printerInfo.address?.toUpperCase() === dev.address.toUpperCase();
                        return (
                          <button
                            key={dev.address}
                            type="button"
                            onClick={() => {
                              const info = selectPairedBluetoothPrinter(dev);
                              setPrinterInfo(info);
                              setShowPairedBtPicker(false);
                              toast.success(`Terhubung ke ${dev.name} (${dev.address})`);
                            }}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer",
                              isCurrent
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{dev.name}</p>
                              <p className="text-[11px] font-mono text-muted-foreground truncate">
                                {dev.address}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0",
                                isCurrent
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {isCurrent ? "Aktif" : "Pilih"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {t("profile.paper_size_label", "Ukuran Kertas Struk")}:
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
                    {(["58mm", "80mm"] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleSavePaperSize(sz)}
                        className={cn(
                          "px-3 py-1 rounded-md text-xs font-bold cursor-pointer",
                          paperSize === sz
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isTestingPrint}
                    onClick={async () => {
                      setIsTestingPrint(true);
                      try {
                        const res = await testThermalPrint();
                        if (res.mode === "thermal") {
                          toast.success("Test print terkirim ke printer thermal!");
                        }
                      } catch (err: any) {
                        toast.error("Gagal test print: " + (err?.message || "Periksa koneksi printer"));
                      } finally {
                        setIsTestingPrint(false);
                      }
                    }}
                    className="h-9 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <RefreshCw className={cn("size-3.5", isTestingPrint && "animate-spin")} />
                    {t("profile.test_print", "Tes Print")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await kickCashDrawer();
                      toast.success("Sinyal buka laci kas terkirim");
                    }}
                    className="h-9 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <WalletCards className="size-3.5" />
                    {t("profile.open_drawer", "Buka Laci")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 3. TEMA WARNA & MODE */}
          {activeSection === "theme" && <ThemeModal isOpen inline onClose={() => {}} />}

          {/* 4. BAHASA APLIKASI */}
          {activeSection === "language" && <LanguageSettingsPage compact />}

          {/* 5. KEAMANAN & PASSWORD */}
          {activeSection === "security" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <KeyRound className="size-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.change_password_title", "Ganti Password Akun")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t("profile.change_password_desc", "Perbarui kata sandi login untuk akun")}{" "}
                      {email}.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <Label className="text-xs font-bold text-foreground">
                      {t("profile.new_password", "Password Baru")}
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t("profile.new_password_placeholder", "Minimal 6 karakter")}
                        className="h-9 pl-9 rounded-xl text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-foreground">
                      {t("profile.confirm_password", "Konfirmasi Password Baru")}
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t(
                          "profile.confirm_password_placeholder",
                          "Ketik ulang password baru",
                        )}
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
                    {isUpdatingPassword
                      ? t("profile.saving", "Menyimpan...")
                      : t("profile.save_password", "Simpan Password Baru")}
                  </Button>
                </form>
              </div>

              {/* PIN Supervisor — Khusus Owner / Manager */}
              {isSupervisorOrOwner && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4.5 text-primary" />
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.supervisor_pin_title", "PIN Otorisasi Supervisor (Void & Refund)")}
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "profile.supervisor_pin_desc",
                      "PIN 4–6 digit angka untuk menyetujui pembatalan transaksi (Void) dan Refund di POS.",
                    )}
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
                      {isSavingPin
                        ? t("profile.saving", "Menyimpan...")
                        : t("profile.save_pin", "Simpan PIN")}
                    </Button>
                  </div>
                </div>
              )}

              {extraAccountSlot}
            </div>
          )}

          {/* 6. RIWAYAT LOGIN */}
          {activeSection === "login_history" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-secondary flex items-center justify-center text-foreground/75">
                    <History className="size-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-foreground">
                      {t("profile.login_history_title", "Riwayat Sesi Login")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "profile.login_history_desc",
                        "Perangkat dan sesi autentikasi pada akun ini.",
                      )}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 text-[11px] font-bold"
                >
                  {t("common.active", "Aktif")}
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
                        time: t("profile.current_session", "Sesi Ini"),
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
                        {t("profile.current_session", "Sesi Ini")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0">
                        {t("profile.history_badge", "Riwayat")}
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
                        {t("profile.branch_assignment", "Penugasan Cabang")}: {outletName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        <UserRound className="inline size-3 mr-1" />
                        {t("profile.verified_role", "Role terverifikasi")}:{" "}
                        {normalizedRole.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. KELUAR AKUN (LOGOUT) */}
          {activeSection === "logout" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <LogOut className="size-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-black text-foreground">
                    {t("profile.logout_confirm_title", "Konfirmasi Keluar Akun")}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      "profile.logout_confirm_desc",
                      "Anda akan keluar dari sesi akun pada perangkat ini. Pastikan transaksi di keranjang sudah selesai atau ditahan.",
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/25 px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
                <span className="font-bold text-foreground truncate">{email}</span>
                <span className="font-semibold text-muted-foreground shrink-0">{outletName}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSection(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  {t("common.cancel", "Batal")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isSigningOut}
                  onClick={handleExecuteLogout}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  <span>{t("profile.logout_now", "Keluar Akun Sekarang")}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
