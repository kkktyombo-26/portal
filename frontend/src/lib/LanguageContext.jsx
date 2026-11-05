'use client';
import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext({ lang: 'sw', setLang: () => {} });

export function LanguageProvider({ children, defaultLang = 'sw' }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lang') || defaultLang;
    }
    return defaultLang;
  });

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);