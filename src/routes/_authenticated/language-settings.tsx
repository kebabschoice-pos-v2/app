import { createFileRoute } from "@tanstack/react-router";
import { KebabsChoicePOSApp } from "@/components/kebabschoicepos/KebabsChoicePOSApp";

export const Route = createFileRoute("/_authenticated/language-settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan Bahasa | KebabsChoicePOS" },
      { name: "description", content: "Pilih bahasa sistem POS dan dashboard." },
    ],
  }),
  component: () => <KebabsChoicePOSApp page="language-settings" />,
});
