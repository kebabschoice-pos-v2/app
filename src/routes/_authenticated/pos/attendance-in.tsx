import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/attendance-in")({
  ssr: false,
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
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-attendance-in" />,
});
