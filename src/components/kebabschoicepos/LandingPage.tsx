import { Link } from "@tanstack/react-router";
import { Shield, ShoppingBag, UserPlus } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
            <Shield className="size-3.5" />
            <span>Sistem POS & HQ Internal Bisnis</span>
          </div>
          <h1 className="text-2xl font-black">KebabsChoice POS</h1>
          <p className="text-xs text-muted-foreground">Pilih terminal akses operasional cabang atau kantor pusat.</p>
        </div>
        <div className="grid gap-3 pt-2">
          <Link
            to="/login/pos"
            className="flex items-center justify-between rounded-2xl border-2 border-border p-4.5 hover:border-primary/60 hover:bg-muted/40 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Masuk POS (Kasir)</p>
                <p className="text-xs text-muted-foreground">Terminal transaksi kasir cabang aktif</p>
              </div>
            </div>
            <span className="text-xs font-bold text-primary">Buka &rarr;</span>
          </Link>

          <Link
            to="/login/hq"
            className="flex items-center justify-between rounded-2xl border-2 border-border p-4.5 hover:border-primary/60 hover:bg-muted/40 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 group-hover:scale-105 transition-transform">
                <Shield className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Masuk HQ (Owner & Manager)</p>
                <p className="text-xs text-muted-foreground">Command center laporan, keuangan & menu</p>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-600">Buka &rarr;</span>
          </Link>
        </div>

        {/* Discreet Internal Setup */}
        <div className="pt-4 border-t border-border/60 text-center">
          <Link
            to="/register"
            className="text-[11px] font-semibold text-muted-foreground/80 hover:text-foreground hover:underline transition-colors inline-flex items-center gap-1"
          >
            <UserPlus className="size-3" />
            <span>Setup / Aktivasi Owner Internal (Butuh Kode Otorisasi)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
