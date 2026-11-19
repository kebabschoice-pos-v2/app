import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkHQRouteAccess } from "@/integrations/supabase/role-resolver";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/waste")({
  beforeLoad: async () => {
    const access = await checkHQRouteAccess("waste");
    if (!access.allowed) throw redirect({ to: access.redirectTo });
  },
  component: () => <KebabsChoicePOSApp page="waste" />,
});
