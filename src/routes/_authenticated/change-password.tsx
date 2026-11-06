import { createFileRoute } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: () => <KebabsChoicePOSApp page="change-password" />,
});
