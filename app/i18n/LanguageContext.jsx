import { createContext, useContext, useMemo } from "react";
import { TRANSLATIONS } from "./translations";

const LanguageContext = createContext({ locale: "en", t: (key) => key });

// eslint-disable-next-line react/prop-types
export function LanguageProvider({ locale, children }) {
  const value = useMemo(() => {
    const dict = TRANSLATIONS[locale] || TRANSLATIONS.en;
    const t = (key, params) => {
      let str = dict[key] ?? TRANSLATIONS.en[key] ?? key;
      if (params) {
        for (const [name, replacement] of Object.entries(params)) {
          str = str.replaceAll(`{${name}}`, replacement);
        }
      }
      return str;
    };
    return { locale, t };
  }, [locale]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
