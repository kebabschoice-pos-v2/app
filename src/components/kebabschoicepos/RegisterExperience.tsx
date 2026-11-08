import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function RegisterExperience() {
  const navigate = useNavigate();
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const EXPECTED_AUTH_CODE =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OWNER_REGISTRATION_CODE) ||
    "KEBABSCHOICE-OWNER-VIP";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const trimmedAuthCode = authCode.trim().toUpperCase();
    if (!trimmedAuthCode || trimmedAuthCode !== EXPECTED_AUTH_CODE) {
      const err = "Kode Otorisasi Internal Owner tidak valid! Pendaftaran hanya untuk pemegang hak akses resmi KebabsChoice.";
      setMessage(err);
      toast.error(err);
      return;
    }

    setLoading(true);

    try {
      const trimmedOwnerName = ownerName.trim();
      const trimmedBusinessName = businessName.trim();
      const trimmedEmail = email.trim();

      if (!trimmedOwnerName || !trimmedBusinessName || !trimmedEmail || !password) {
        throw new Error("Semua field wajib diisi");
      }

      console.log("[Register Flow] tahap: signup");

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: trimmedOwnerName,
            business_name: trimmedBusinessName,
          },
          emailRedirectTo: `${window.location.origin}/verification-success`,
        },
      });

      if (signUpError) {
        console.error("[Register Error] tahap: signup", {
          message: signUpError.message,
          code: signUpError.code,
        });
        throw signUpError;
      }

      if (!signUpData?.user?.id) {
        console.error("[Register Error] tahap: validation", {
          missing: "user.id",
        });
        throw new Error("User ID tidak tersedia setelah signup");
      }

      const userId = signUpData.user.id;

      // Do not activate owner account or use signup session before email verification.
      // Supabase must have Confirm Email enabled so email_confirmed_at remains null
      // until the user clicks the verification link.
      if (!signUpData.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setMessage("Akun berhasil dibuat. Silakan cek email Anda untuk verifikasi akun.");
        toast.success("Silakan verifikasi email terlebih dahulu.");
        return;
      }

      console.log("[Register Flow] tahap: create_owner_account");

      const { data: rpcData, error: rpcError } = await supabase.rpc("create_owner_account", {
        p_user_id: userId,
        p_owner_name: trimmedOwnerName,
        p_business_name: trimmedBusinessName,
      });

      if (rpcError) {
        console.error("[Register Error] tahap: create_owner_account", {
          user_id: userId,
          error: rpcError.message,
        });
        throw rpcError;
      }

      const response = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const owner_id = (response as any)?.owner_id;
      const business_id = (response as any)?.business_id;
      const role = (response as any)?.role;

      if (!owner_id || !business_id || role !== "owner") {
        console.error("[Register Error] tahap: validation", {
          response,
        });
        throw new Error("Data profil bisnis tidak lengkap");
      }

      toast.success("Akun pemilik berhasil dibuat!");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Register gagal";
      console.error("[Register Error]", error);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Register Owner</h1>
          <p className="text-sm text-muted-foreground">Buat akun owner dan bisnis baru.</p>
        </div>
        <div className="space-y-2">
          <Label>Nama Pemilik</Label>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nama Bisnis</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
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
          <Label className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>Kode Otorisasi Internal Owner</span>
            <span className="text-[10px] text-amber-600 font-normal">Wajib untuk internal</span>
          </Label>
          <Input
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Masukkan kode master owner (contoh: KEBABSCHOICE-OWNER-VIP)"
            className="font-mono uppercase tracking-wider text-xs border-amber-500/40 focus:border-amber-500"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Daftar
        </Button>
      </form>
    </div>
  );
}
