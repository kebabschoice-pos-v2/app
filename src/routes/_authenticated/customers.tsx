import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, isHQRole } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customer CRM | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "CRM pelanggan KebabsChoicePOS dengan profil, riwayat belanja, produk favorit, dan insight AI.",
      },
      { property: "og:title", content: "Customer CRM KebabsChoicePOS 2026" },
      {
        property: "og:description",
        content: "Kelola pelanggan dan peluang repeat order dengan insight AI.",
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
  component: () => <KebabsChoicePOSApp page="customers" />,
});
