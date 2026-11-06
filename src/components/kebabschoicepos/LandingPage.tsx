import { Link } from "@tanstack/react-router";
import { Shield, ShoppingBag, UserPlus } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Masuk</h1>
          <p className="text-sm text-muted-foreground">Pilih tipe akses sesuai peran Anda.</p>
        </div>
        <div className="grid gap-3">
          <Link
            to="/login/pos"
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Masuk POS</span>
          </Link>
          <Link
            to="/login/hq"
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted"
          >
            <Shield className="h-5 w-5" />
            <span>Masuk HQ</span>
          </Link>
        </div>
        <div className="space-y-2 pt-2">
          <h2 className="text-xl font-semibold">Daftar Akun</h2>
          <Link
            to="/register"
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted"
          >
            <UserPlus className="h-5 w-5" />
            <span>Register Owner</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
