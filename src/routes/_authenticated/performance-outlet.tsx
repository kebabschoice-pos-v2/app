import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/performance-outlet")({
  head: () => ({
    meta: [
      { title: "Performa Outlet | KebabsChoicePOS" },
      {
        name: "description",
        content: "Analisis performa, omzet, dan transaksi antar cabang outlet.",
      },
    ],
  }),
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("performance-outlet");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="performance-outlet" />,
});
