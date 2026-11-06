import { createFileRoute } from "@tanstack/react-router";
import { RegisterExperience } from "@/components/kebabschoicepos/RegisterExperience";

export const Route = createFileRoute("/register")({
  component: RegisterExperience,
});
