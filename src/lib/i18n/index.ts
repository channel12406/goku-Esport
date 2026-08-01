import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { fr } from "./fr";
import { en } from "./en";

if (!i18n.isInitialized) {
  const chain = typeof window !== "undefined" ? i18n.use(LanguageDetector) : i18n;
  chain.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: "fr",
    lng: typeof window === "undefined" ? "fr" : undefined,
    supportedLngs: ["fr", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "firearena.lang",
    },
    react: { useSuspense: false },
  });
}

export default i18n;
