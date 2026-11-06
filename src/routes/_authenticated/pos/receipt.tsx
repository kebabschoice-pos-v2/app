import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/receipt")({
  head: () => ({
    meta: [
      { title: "Cetak Struk POS | KebabsChoicePOS 2026" },
      { name: "description", content: "Cetak struk dan invoice digital transaksi POS kasir." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-receipt" />,
});
