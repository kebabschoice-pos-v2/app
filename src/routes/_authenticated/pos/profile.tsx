import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profil Kasir | KebabsChoicePOS" },
      {
        name: "description",
        content: "Informasi penugasan kasir, ganti password, dan log aktivitas kasir.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-profile" />,
});
