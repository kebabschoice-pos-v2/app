import { createFileRoute } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/security")({
  component: () => <KebabsChoicePOSApp page="security" />,
});
