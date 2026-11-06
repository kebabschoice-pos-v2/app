import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import idTranslation from "@/locales/id.json";
import enTranslation from "@/locales/en.json";
import jaTranslation from "@/locales/ja.json";
import zhTranslation from "@/locales/zh.json";
import koTranslation from "@/locales/ko.json";
import arTranslation from "@/locales/ar.json";
import esTranslation from "@/locales/es.json";
import frTranslation from "@/locales/fr.json";
import deTranslation from "@/locales/de.json";
import ptTranslation from "@/locales/pt.json";
import itTranslation from "@/locales/it.json";
import ruTranslation from "@/locales/ru.json";
import hiTranslation from "@/locales/hi.json";
import thTranslation from "@/locales/th.json";
import viTranslation from "@/locales/vi.json";
import trTranslation from "@/locales/tr.json";
import msTranslation from "@/locales/ms.json";
import filTranslation from "@/locales/fil.json";
import nlTranslation from "@/locales/nl.json";
import plTranslation from "@/locales/pl.json";
import { supabase } from "@/integrations/supabase/client";

const resources = {
  id: { translation: idTranslation },
  en: { translation: enTranslation },
  ja: { translation: jaTranslation },
  zh: { translation: zhTranslation },
  ko: { translation: koTranslation },
  ar: { translation: arTranslation },
  es: { translation: esTranslation },
  fr: { translation: frTranslation },
  de: { translation: deTranslation },
  pt: { translation: ptTranslation },
  it: { translation: itTranslation },
  ru: { translation: ruTranslation },
  hi: { translation: hiTranslation },
  th: { translation: thTranslation },
  vi: { translation: viTranslation },
  tr: { translation: trTranslation },
  ms: { translation: msTranslation },
  fil: { translation: filTranslation },
  nl: { translation: nlTranslation },
  pl: { translation: plTranslation },
};

const getInitialLanguage = (): string => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("kebabschoicepos_language");
    if (saved && resources[saved as keyof typeof resources]) {
      document.documentElement.dir = ["ar", "fa"].includes(saved) ? "rtl" : "ltr";
      document.documentElement.lang = saved;
      return saved;
    }
  }
  return "id";
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: ["en", "id"],
  interpolation: {
    escapeValue: false,
  },
});

export async function setAppLanguage(languageCode: string, userId?: string | null) {
  try {
    await i18n.changeLanguage(languageCode);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_language", languageCode);
      // Set html dir for RTL if Arabic or Persian
      document.documentElement.dir = ["ar", "fa"].includes(languageCode) ? "rtl" : "ltr";
      document.documentElement.lang = languageCode;
      window.dispatchEvent(
        new CustomEvent("languagechange", { detail: { language: languageCode } }),
      );
    }

    if (userId) {
      await supabase.from("profiles").update({ language: languageCode }).eq("user_id", userId);
    }
  } catch (error) {
    console.error("Failed to change language:", error);
  }
}

export default i18n;
