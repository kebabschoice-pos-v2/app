import { createFileRoute, redirect } from "@tanstack/react-router";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "KebabsChoicePOS 2026 Dashboard | AI Business OS" },
      {
        name: "description",
        content:
          "Dashboard AI KebabsChoicePOS untuk revenue, order, stok, pelanggan, dan rekomendasi bisnis real-time.",
      },
      { property: "og:title", content: "KebabsChoicePOS 2026 Dashboard" },
      {
        property: "og:description",
        content: "Command center AI untuk operasional restoran, cafe, retail, dan UMKM.",
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
  component: () => <KebabsChoicePOSApp page="dashboard" />,
});
