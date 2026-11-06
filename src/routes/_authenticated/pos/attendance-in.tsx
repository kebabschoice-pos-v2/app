import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/attendance-in")({
  head: () => ({
    meta: [
      { title: "Absensi Masuk | KebabsChoicePOS" },
      {
        name: "description",
        content: "Absensi masuk karyawan POS menggunakan pemindaian wajah biometrik.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-attendance-in" />,
});
