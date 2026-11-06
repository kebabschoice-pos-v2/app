import { createFileRoute, redirect } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/receipt")({
  beforeLoad: () => {
    throw redirect({ to: "/pos/receipt" });
  },
  component: () => <KebabsChoicePOSApp page="pos-receipt" />,
});
