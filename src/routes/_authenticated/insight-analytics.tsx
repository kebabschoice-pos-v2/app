import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/insight-analytics")({
  head: () => ({
    meta: [
      { title: "Insight Analytics | KebabsChoicePOS" },
      {
        name: "description",
        content: "Analisis cerdas, prediksi penjualan, dan rekomendasi AI otomatis.",
      },
    ],
  }),
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("insight-analytics");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="insight-analytics" />,
});
