import { createFileRoute } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile | KebabsChoicePOS 2026" },
      {
        name: "description",
        content:
          "Profil admin KebabsChoicePOS, peran bisnis, preferensi AI, dan kesiapan perangkat POS.",
      },
      { property: "og:title", content: "Profile KebabsChoicePOS 2026" },
      {
        property: "og:description",
        content: "Kelola identitas admin, role, dan preferensi bisnis di KebabsChoicePOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <KebabsChoicePOSApp page="profile" />,
});
