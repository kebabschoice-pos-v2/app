import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/shift-cash")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shift & Cash | KebabsChoicePOS" },
      {
        name: "description",
        content: "Opening shift kasir, mutasi kas, dan rekonsiliasi kasir POS.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-shift-cash" />,
});
