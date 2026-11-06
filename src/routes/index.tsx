import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/kebabschoicepos/LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
});
