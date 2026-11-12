import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Smart POS | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Transaksi POS modern dengan cart pintar, QRIS, e-wallet, kartu, dan receipt digital.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos" />,
});
