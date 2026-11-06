import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Smart Inventory | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Inventori prediktif KebabsChoicePOS dengan stock health score, alert AI, dan rekomendasi restock.",
      },
      { property: "og:title", content: "Smart Inventory KebabsChoicePOS 2026" },
      {
        property: "og:description",
        content: "Prediksi stok dan rekomendasi pembelian untuk operasional yang lebih cepat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const role = data.user ? await getUserRole(data.user.id) : null;
    if (!isHQRole(role)) throw redirect({ to: "/pos" });
  },
  component: () => <KebabsChoicePOSApp page="inventory" />,
});
