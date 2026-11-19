import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/money-allocation")({
  head: () => ({
    meta: [
      { title: "Alokasi & Celengan Operasional | KebabsChoicePOS" },
      {
        name: "description",
        content: "Alokasi tabungan belanja bahan baku BOM dan cadangan operasional harian outlet.",
      },
    ],
  }),
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("money-allocation");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="money-allocation" />,
});
