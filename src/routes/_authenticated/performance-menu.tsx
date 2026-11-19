import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/performance-menu")({
  head: () => ({
    meta: [
      { title: "Performa Menu | KebabsChoicePOS" },
      {
        name: "description",
        content: "Analisis performa penjualan, revenue, dan margin per menu.",
      },
    ],
  }),
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("performance-menu");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="performance-menu" />,
});
