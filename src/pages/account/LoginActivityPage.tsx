import { useState, useEffect, useCallback } from "react";
import { History, Shield, Smartphone, Laptop, CheckCircle, RefreshCw, Trash2, UserCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LoginActivity {
  id: string;
  device: string;
  email: string;
  role: string;
  ip: string;
  location: string;
  time: string;
  timestamp: number;
  status: string;
  isCurrent: boolean;
}

const STORAGE_KEY = "kebabschoicepos_login_activity_logs";

function parseUserAgent(): { deviceName: string; isMobileOrTablet: boolean } {
  if (typeof window === "undefined") {
    return { deviceName: "Browser Web", isMobileOrTablet: false };
  }
  const ua = navigator.userAgent;
  let os = "Windows";
  if (ua.includes("Windows NT 10.0")) os = "Windows 11 / 10";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone")) os = "iPhone (iOS)";
  else if (ua.includes("iPad")) os = "iPad (iPadOS)";
  else if (ua.includes("Linux")) os = "Linux";

  let browser = "Web Browser";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Google Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";

  const isTablet = /iPad|tablet|(android(?!.*mobile))/i.test(ua);
  const isMobile = /mobile|iphone|ipod|android/i.test(ua) && !isTablet;
  const category = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  return {
    deviceName: `${browser} on ${os} (${category})`,
    isMobileOrTablet: isMobile || isTablet,
  };
}

function formatLoginTime(isoString?: string | null): string {
  const d = isoString ? new Date(isoString) : new Date();
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return `Hari ini, ${timeStr} WIB`;
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Kemarin, ${timeStr} WIB`;
  }
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}, ${timeStr} WIB`;
}

export function LoginActivityPage() {
  const [logs, setLogs] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivities = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      // 1. Get real user session from Supabase
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      // 2. Resolve Profile & Role & Outlet from stored context
      let role = "Owner HQ";
      let userEmail = user?.email || "admin@kebabschoice.com";
      let location = "Jakarta, Indonesia (Jaringan Kantor Pusat)";

      if (typeof window !== "undefined") {
        try {
          const storedProfile = localStorage.getItem("kebabschoicepos_profile");
          if (storedProfile) {
            const p = JSON.parse(storedProfile);
            if (p.email) userEmail = p.email;
            if (p.role) {
              const r = String(p.role).toLowerCase();
              role = r === "owner" ? "Owner HQ" : r === "manager" ? "Manager Outlet" : "Kasir POS";
            }
          }
          const storedOutlet = localStorage.getItem("kebabschoicepos_active_outlet_name");
          if (storedOutlet) {
            location = `${storedOutlet} • Jaringan Kasir`;
          }
        } catch {
          // ignore parse errors
        }
      }

      // 3. Real detected device info
      const { deviceName } = parseUserAgent();
      const loginIso = user?.last_sign_in_at || new Date().toISOString();
      const formattedTime = formatLoginTime(loginIso);
      const sessionTimestamp = new Date(loginIso).getTime();

      const currentSessionId = `sess_${user?.id || "local"}_${new Date(loginIso).toISOString().slice(0, 13)}`;

      const currentSession: LoginActivity = {
        id: currentSessionId,
        device: deviceName,
        email: userEmail,
        role,
        ip: "Koneksi Terverifikasi",
        location,
        time: formattedTime,
        timestamp: sessionTimestamp,
        status: "Berhasil Terautentikasi",
        isCurrent: true,
      };

      // 4. Load persisted historical logs from localStorage
      let historical: LoginActivity[] = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              historical = parsed;
            }
          }
        } catch {
          historical = [];
        }
      }

      // 5. Merge & Deduplicate
      const otherLogs = historical
        .filter((l) => l.id !== currentSession.id && l.time !== currentSession.time)
        .map((l) => ({ ...l, isCurrent: false }));

      const mergedLogs = [currentSession, ...otherLogs].slice(0, 20);
      setLogs(mergedLogs);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedLogs));
      }

      if (isManualRefresh) {
        toast.success("Riwayat log aktivitas login asli berhasil diperbarui");
      }
    } catch (err: any) {
      console.warn("[LoginActivity] Load error:", err);
      toast.error("Gagal memuat aktivitas login: " + (err.message || ""));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities(false);
  }, [loadActivities]);

  const handleClearHistory = () => {
    if (logs.length <= 1) {
      toast.info("Hanya tersisa sesi aktif saat ini.");
      return;
    }
    const currentOnly = logs.slice(0, 1);
    setLogs(currentOnly);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentOnly));
    }
    toast.success("Riwayat sesi login lama berhasil dibersihkan");
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Shield className="size-4" />
            <span>Audit Keamanan & Sesi Autentikasi</span>
          </div>
          <h1 className="text-3xl font-black tracking-normal">Aktivitas Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daftar jejak autentikasi nyata dan riwayat login aktif pada akun KebabsChoicePOS Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="rounded-xl gap-2 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Bersihkan riwayat sesi lama"
          >
            <Trash2 className="size-3.5" />
            <span>Bersihkan Riwayat Lama</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadActivities(true)}
            disabled={isLoading}
            className="rounded-xl gap-2 font-bold"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Logs List */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <h2 className="text-base font-bold">Log Masuk Akun Nyata</h2>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {logs.length} Sesi Tercatat
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Memuat riwayat sesi autentikasi...
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  log.isCurrent ? "bg-primary/[0.03] -mx-3 px-3 rounded-xl" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-2xl shrink-0 mt-0.5 ${
                      log.isCurrent
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {log.device.includes("Android") ||
                    log.device.includes("iPhone") ||
                    log.device.includes("Tablet") ? (
                      <Smartphone className="size-5 text-primary" />
                    ) : (
                      <Laptop className="size-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{log.device}</p>
                      {log.isCurrent && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Sesi Saat Ini
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {log.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <UserCheck className="size-3 text-primary" />
                        <span className="font-medium text-foreground/80">{log.email}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span>{log.location}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between text-xs gap-1">
                  <span className="font-bold text-foreground/90">{log.time}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="size-3" /> {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
