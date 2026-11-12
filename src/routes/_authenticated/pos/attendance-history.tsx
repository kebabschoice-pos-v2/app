import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/attendance-history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Riwayat Absensi | KebabsChoicePOS" },
      { name: "description", content: "Riwayat kehadiran karyawan POS." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-attendance-history" />,
});
