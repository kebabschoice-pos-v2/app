import { createFileRoute } from "@tanstack/react-router";
import { AuthExperience } from "@/components/kebabschoicepos/AuthExperience";

export const Route = createFileRoute("/login/pos")({
  component: () => <AuthExperience loginType="pos" />,
});
