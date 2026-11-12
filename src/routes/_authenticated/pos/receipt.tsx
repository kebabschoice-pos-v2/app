import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/receipt")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cetak Struk POS | KebabsChoicePOS 2026" },
      { name: "description", content: "Cetak struk dan invoice digital transaksi POS kasir." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-receipt" />,
});
