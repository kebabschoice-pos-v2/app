import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/inventory")({
  head: () => ({
    meta: [
      { title: "Inventaris Outlet | KebabsChoicePOS" },
      { name: "description", content: "Monitoring stok bahan dan permintaan pasokan ke HQ." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-inventory" />,
});
