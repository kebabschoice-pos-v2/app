import { createFileRoute, redirect } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/order")({
  beforeLoad: () => {
    throw redirect({ to: "/orders" });
  },
  component: () => <KebabsChoicePOSApp page="orders" />,
});
