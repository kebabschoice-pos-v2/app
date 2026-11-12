import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/orders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Riwayat Transaksi POS | KebabsChoicePOS 2026" },
      { name: "description", content: "Riwayat transaksi kasir POS dan cetak ulang struk." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-orders" />,
});
