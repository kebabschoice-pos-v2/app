import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/profile")({
  head: () => ({
    meta: [
      { title: "Profil Kasir | KebabsChoicePOS" },
      {
        name: "description",
        content: "Informasi penugasan kasir, ganti password, dan log aktivitas kasir.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-profile" />,
});
