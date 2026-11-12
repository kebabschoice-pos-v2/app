import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await resolveAuthenticatedUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
