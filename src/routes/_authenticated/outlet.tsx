import { createFileRoute, redirect } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/outlet")({
  beforeLoad: () => {
    throw redirect({ to: "/outlets" });
  },
  component: () => <KebabsChoicePOSApp page="outlets" />,
});
