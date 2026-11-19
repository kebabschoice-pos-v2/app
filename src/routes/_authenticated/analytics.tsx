import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Advanced Analytics | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Analitik KebabsChoicePOS untuk tren revenue, customer growth, product performance, dan laporan AI otomatis.",
      },
      { property: "og:title", content: "Advanced Analytics KebabsChoicePOS 2026" },
      {
        property: "og:description",
        content: "Dashboard data-driven untuk membaca performa bisnis dan peluang pertumbuhan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("analytics");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="analytics" />,
});
