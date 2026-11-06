import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/pos/shift-cash")({
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
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <KebabsChoicePOSApp page="pos-shift-cash" />,
});
