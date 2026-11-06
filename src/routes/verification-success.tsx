import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verification-success")({
  component: VerificationSuccess,
});

function VerificationSuccess() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Email berhasil diverifikasi.");

  useEffect(() => {
    async function provision() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setMessage("Email berhasil diverifikasi. Silakan masuk ke akun Anda.");
        setReady(true);
        return;
      }

      const ownerName = user.user_metadata?.display_name;
      const businessName = user.user_metadata?.business_name;

      if (ownerName && businessName) {
        const { error } = await supabase.rpc("create_owner_account", {
          p_user_id: user.id,
          p_owner_name: ownerName,
          p_business_name: businessName,
        });

        if (error) {
          setMessage("Email berhasil diverifikasi. Aktivasi akun belum selesai.");
          setReady(true);
          return;
        }
      }

      await supabase.auth.signOut();
      setMessage("Email berhasil diverifikasi. Akun Anda berhasil dibuat.");
      setReady(true);
    }

    provision();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border p-6 text-center">
        <h1 className="text-2xl font-bold">Email berhasil diverifikasi</h1>
        <p>{message}</p>
        <Button disabled={!ready} onClick={() => navigate({ to: "/login/hq" })}>
          Masuk ke Akun
        </Button>
      </div>
    </div>
  );
}
