import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/")({
  head: () => ({
    meta: [
      { title: "Smart POS | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Transaksi POS modern dengan cart pintar, QRIS, e-wallet, kartu, dan receipt digital.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos" />,
});
