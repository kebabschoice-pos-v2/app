import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/attendance-history")({
  head: () => ({
    meta: [
      { title: "Riwayat Absensi | KebabsChoicePOS" },
      { name: "description", content: "Riwayat kehadiran karyawan POS." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-attendance-history" />,
});
