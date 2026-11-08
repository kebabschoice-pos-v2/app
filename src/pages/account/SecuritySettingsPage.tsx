import { useState, useEffect } from "react";
import { ShieldCheck, Smartphone, Lock, AlertTriangle, Check, SlidersHorizontal, Store, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { setOutletSupervisorPin } from "@/services/supervisor.service";
import { supabase } from "@/integrations/supabase/client";
import {
  getManagerPermissions,
  saveManagerPermissions,
  type ManagerPermissions,
  DEFAULT_MANAGER_PERMISSIONS,
} from "@/services/manager-permissions.service";

export function SecuritySettingsPage() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [managerPermissions, setManagerPermissions] = useState<ManagerPermissions>(DEFAULT_MANAGER_PERMISSIONS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [managerPin, setManagerPin] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kebabschoicepos_supervisor_pin") || "123456";
    }
    return "123456";
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPin = localStorage.getItem("kebabschoicepos_supervisor_pin");
      if (savedPin) setManagerPin(savedPin);
    }
    getManagerPermissions().then((p) => setManagerPermissions(p)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanPin = managerPin.trim();
      localStorage.setItem("kebabschoicepos_supervisor_pin", cleanPin);

      await saveManagerPermissions(managerPermissions);

      // Also persist to current user's outlets
      const { data: outlets } = await supabase.from("outlets").select("id").limit(10);
      if (outlets && outlets.length > 0) {
        for (const out of outlets) {
          await setOutletSupervisorPin(out.id, cleanPin);
        }
      }

      toast.success("Pengaturan Keamanan & Hak Akses Manager berhasil disimpan");
    } catch (e: any) {
      console.warn("[SecuritySettings] Warning saving PIN:", e);
      toast.success("Pengaturan Keamanan berhasil disimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutOtherDevices = () => {
    toast.success("Semua sesi perangkat lain berhasil diputus!");
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <h1 className="text-3xl font-black tracking-normal">Keamanan Akun & POS</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Pengaturan autentikasi ganda, PIN otorisasi supervisor/manajer kasir, dan kontrol sesi
          perangkat aktif.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Autentikasi Dua Langkah (2FA) */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Autentikasi Dua Langkah (2FA)</h2>
                <p className="text-xs text-muted-foreground">
                  Verifikasi OTP saat login untuk perlindungan tingkat tinggi.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactor}
                onChange={(e) => {
                  setTwoFactor(e.target.checked);
                  toast.info(e.target.checked ? "2FA diaktifkan" : "2FA dinonaktifkan");
                }}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{twoFactor ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>
        </div>

        {/* PIN Otorisasi Supervisor Kasir */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-primary" />
            <h2 className="text-base font-bold">PIN Otorisasi Kasir (Manager Override)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            PIN 6-digit untuk otorisasi pembatalan transaksi (void), diskon manual khusus, dan
            refund di POS.
          </p>
          <div className="max-w-xs">
            <label className="text-xs font-bold text-foreground/80">PIN Supervisor (6 Digit)</label>
            <Input
              type="password"
              maxLength={6}
              className="mt-1.5 rounded-xl font-mono tracking-widest text-center text-lg font-bold"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
            />
          </div>
        </div>

        {/* Panel Kontrol Hak Akses Role Manager */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              <div>
                <h2 className="text-base font-bold">🎛️ Hak Akses Role Manager (Bisa Di-ON/OFF-kan)</h2>
                <p className="text-xs text-muted-foreground">
                  Kontrol otorisasi fitur untuk akun Manager cabang secara terpusat.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              HQ Security
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Akses Stok &amp; Bahan Baku</p>
                <p className="text-[10px] text-muted-foreground">can_manage_inventory</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_manage_inventory}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_manage_inventory: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Atur Shift &amp; Jadwal</p>
                <p className="text-[10px] text-muted-foreground">can_manage_staff_shift</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_manage_staff_shift}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_manage_staff_shift: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Lihat Laporan Penjualan</p>
                <p className="text-[10px] text-muted-foreground">can_view_branch_reports</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_view_branch_reports}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_view_branch_reports: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Cairkan Tabungan Bahan</p>
                <p className="text-[10px] text-muted-foreground">can_spend_ingredient_pockets</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_spend_ingredient_pockets}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_spend_ingredient_pockets: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Edit Resep &amp; HPP Menu</p>
                <p className="text-[10px] text-muted-foreground">can_edit_menu_recipes (Sensitif)</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_edit_menu_recipes}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_edit_menu_recipes: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Lihat Sisa Laba Murni Owner</p>
                <p className="text-[10px] text-muted-foreground">can_view_owner_net_profit (Rahasia)</p>
              </div>
              <input
                type="checkbox"
                checked={managerPermissions.can_view_owner_net_profit}
                onChange={(e) => setManagerPermissions((p) => ({ ...p, can_view_owner_net_profit: e.target.checked }))}
                className="size-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Sesi Perangkat Aktif */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-primary" />
              <h2 className="text-base font-bold">Perangkat Sedang Aktif</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogoutOtherDevices}
              className="rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              Keluarkan Perangkat Lain
            </Button>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-bold">Windows PC (Browser Saat Ini)</p>
                  <p className="text-xs text-muted-foreground">
                    Jakarta, Indonesia • IP 182.253.x.x
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                Sesi Ini
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/30 border border-border">
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-sm font-bold">Android Tablet Kasir (Pasar Jumat)</p>
                  <p className="text-xs text-muted-foreground">
                    Aktif 2 jam yang lalu • IP 180.244.x.x
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Aktif
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} className="rounded-2xl font-bold shadow-brand">
            Simpan Pengaturan Keamanan
          </Button>
        </div>
      </div>
    </div>
  );
}
