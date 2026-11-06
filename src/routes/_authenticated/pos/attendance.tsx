import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pos/attendance")({
  beforeLoad: () => {
    throw redirect({ to: "/pos/attendance-in" });
  },
  component: () => null,
});
