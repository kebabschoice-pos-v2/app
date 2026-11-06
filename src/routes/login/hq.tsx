import { createFileRoute } from "@tanstack/react-router";
import { AuthExperience } from "@/components/kebabschoicepos/AuthExperience";

export const Route = createFileRoute("/login/hq")({
  component: () => <AuthExperience loginType="hq" />,
});
