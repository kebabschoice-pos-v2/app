import { createFileRoute, redirect } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/shift")({
  beforeLoad: () => {
    throw redirect({ to: "/pos/shift-cash" });
  },
  component: () => <KebabsChoicePOSApp page="pos-shift-cash" />,
});
