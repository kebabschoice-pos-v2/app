import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Pantau pesanan, pembayaran, channel transaksi, dan status order di KebabsChoicePOS 2026.",
      },
      { property: "og:title", content: "Orders KebabsChoicePOS 2026" },
      {
        property: "og:description",
        content: "Monitoring order modern untuk toko, dine-in, takeaway, dan pembayaran digital.",
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
  component: () => <KebabsChoicePOSApp page="orders" />,
});
