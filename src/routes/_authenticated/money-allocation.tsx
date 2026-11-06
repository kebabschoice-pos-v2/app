import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
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
    const { data } = await supabase.auth.getUser();
    const role = data.user ? await getUserRole(data.user.id) : null;
    if (!isHQRole(role)) throw redirect({ to: "/pos" });
  },
  component: () => <KebabsChoicePOSApp page="money-allocation" />,
});
