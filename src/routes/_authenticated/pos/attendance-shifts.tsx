import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/attendance-shifts")({
  head: () => ({
    meta: [
      { title: "Jadwal Shift | KebabsChoicePOS" },
      { name: "description", content: "Jadwal shift kerja karyawan cabang POS." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-attendance-shifts" />,
});
