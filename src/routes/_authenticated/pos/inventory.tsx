import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/inventory")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inventaris Outlet | KebabsChoicePOS" },
      { name: "description", content: "Monitoring stok bahan dan permintaan pasokan ke HQ." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-inventory" />,
});
