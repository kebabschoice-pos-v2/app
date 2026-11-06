import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/orders")({
  head: () => ({
    meta: [
      { title: "Riwayat Transaksi POS | KebabsChoicePOS 2026" },
      { name: "description", content: "Riwayat transaksi kasir POS dan cetak ulang struk." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-orders" />,
});
