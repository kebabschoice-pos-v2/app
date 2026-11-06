import { useState, useEffect } from "react";
import {
  UserRound,
  Shield,
  KeyRound,
  History,
  Store,
  Clock,
  CheckCircle2,
  Mail,
  Smartphone,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";

interface LoginRecord {
  id: string;
  time: string;
  device: string;
  ip: string;
  status: "Berhasil" | "Keluar";
}

const mockLoginHistory: LoginRecord[] = [
  {
    id: "log-1",
    time: "Hari ini, 08:00 WIB",
    device: "Chrome / Windows 11 (POS Terminal 1)",
    ip: "192.168.1.45",
    status: "Berhasil",
  },
  {
    id: "log-2",
    time: "Kemarin, 08:02 WIB",
    device: "Chrome / Windows 11 (POS Terminal 1)",
    ip: "192.168.1.45",
    status: "Berhasil",
  },
  {
    id: "log-3",
    time: "28 Sep 2026, 15:30 WIB",
    device: "Chrome / Tablet Android",
    ip: "192.168.1.88",
    status: "Berhasil",
  },
];

export function PosProfilePage() {
  const [displayName, setDisplayName] = useState("Kasir Utama");
  const [email, setEmail] = useState("kasir@kitapos.id");
  const [phone, setPhone] = useState("0812-3456-7890");
  const [outletName, setOutletName] = useState("Kebab Pasar Jumat");
  const [roleName, setRoleName] = useState("Kasir POS");

  // Change password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email || "kasir@kitapos.id");
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: prof }) => {
            if (prof?.display_name) setDisplayName(prof.display_name);
            if (prof?.phone) setPhone(prof.phone);
          });
      }
    });

    resolveActiveStaffOutlet().then((staffOutlet) => {
      if (staffOutlet?.outletName) setOutletName(staffOutlet.outletName);
    });
  }, []);

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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error("Gagal mengganti password", { description: error.message });
      } else {
        toast.success("Password kasir berhasil diperbarui!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan sistem", { description: err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <UserRound className="size-7 text-primary" />
            Profil Kasir & Akun POS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informasi penugasan outlet, sesi kasir aktif, dan pengaturan keamanan akun kasir.
          </p>
        </div>

        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30 px-3.5 py-1.5 font-bold self-start md:self-auto"
        >
          ● Status Akun: Aktif & Terverifikasi
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Cashier Card & Active Outlet */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card text-center space-y-4">
            <div className="size-20 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center font-black text-2xl shadow-inner">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 className="text-lg font-black text-foreground">{displayName}</h2>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <Mail className="size-3" />
                {email}
              </p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-center gap-2">
              <Badge variant="secondary" className="font-bold text-xs">
                {roleName}
              </Badge>
              <Badge
                variant="outline"
                className="bg-success-soft text-success border-success/30 font-bold text-xs"
              >
                Online POS
              </Badge>
            </div>
          </div>

          {/* Active Outlet Card */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Store className="size-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Outlet Penugasan
                </span>
                <h3 className="font-black text-sm text-foreground">{outletName}</h3>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Semua transaksi penjualan, stok bahan, dan rekonsiliasi kasir otomatis terhubung ke
              outlet ini.
            </p>
          </div>
        </div>

        {/* Right Column: Change Password & Login Activity */}
        <div className="space-y-6 lg:col-span-2">
          {/* Change Password Card */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-foreground">Ganti Password Kasir</h3>
                <p className="text-xs text-muted-foreground">
                  Perbarui kata sandi akun kasir Anda secara berkala.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-foreground">Password Baru</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">
                    Konfirmasi Password Baru
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password"
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="rounded-xl font-bold shadow-brand"
                >
                  {isUpdatingPassword ? "Menyimpan..." : "Perbarui Password"}
                </Button>
              </div>
            </form>
          </div>

          {/* Login Activity Card */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <History className="size-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground">Riwayat Login Kasir</h3>
                  <p className="text-xs text-muted-foreground">
                    Aktivitas autentikasi pada terminal kasir POS.
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">3 sesi terakhir</span>
            </div>

            <div className="divide-y divide-border">
              {mockLoginHistory.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-success-soft text-success flex items-center justify-center">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{log.device}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {log.time} · IP: {log.ip}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="bg-success-soft text-success text-[10px] font-bold"
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
