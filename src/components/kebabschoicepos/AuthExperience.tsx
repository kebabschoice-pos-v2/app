import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getUserRole,
  resolveAccessLevel,
  type LoginType,
} from "@/integrations/supabase/role-resolver";

type Props = { loginType?: LoginType };

export function AuthExperience({ loginType }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const didCheckSessionRef = useRef(false);

  useEffect(() => {
    if (didCheckSessionRef.current) return;
    didCheckSessionRef.current = true;
  }, []);

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) throw new Error("Email dan password wajib diisi");

      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) throw error;

      const { data: verifiedUserData } = await supabase.auth.getUser();
      const currentUser = verifiedUserData.user;

      if (!currentUser?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Email belum diverifikasi. Silakan cek email Anda.");
      }

      const userId = currentUser.id;
      if (!userId) throw new Error("Gagal mendapatkan user session");

      const role = await getUserRole(userId);
      const resolved = resolveAccessLevel(role, loginType ?? "hq");
      if (!resolved.allowed) throw new Error(resolved.errorMessage ?? "Akses tidak sesuai");

      await navigate({ to: resolved.targetRoute, replace: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Login gagal";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationEmail() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Masukkan email terlebih dahulu");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
    });

    if (error) toast.error(error.message);
    else toast.success("Email verifikasi dikirim ulang");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleEmailSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6"
      >
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="mb-3 gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <h1 className="text-2xl font-bold">{loginType === "pos" ? "Masuk POS" : "Masuk HQ"}</h1>
          <p className="text-sm text-muted-foreground">Login sesuai tipe akses.</p>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        {message.includes("Email belum diverifikasi") ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resendVerificationEmail}
          >
            Resend Verification Email
          </Button>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Masuk
        </Button>
      </form>
    </div>
  );
}
