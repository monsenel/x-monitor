import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Language = 'en' | 'fa';
export type ThemeMode = 'dark' | 'light';

interface PreferencesContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  isRtl: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  t: (en: string, fa: string) => string;
}

const PreferencesContext = createContext<PreferencesContextType>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  isRtl: false,
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  t: (en) => en,
});

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xmonitor_lang');
      if (saved === 'en' || saved === 'fa') return saved;
    }
    return 'en';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xmonitor_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('xmonitor_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('xmonitor_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    }
  }, [theme]);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'fa' : 'en'));
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const t = useCallback(
    (en: string, fa: string) => {
      return lang === 'fa' ? fa : en;
    },
    [lang]
  );

  return (
    <PreferencesContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        isRtl: lang === 'fa',
        theme,
        setTheme,
        toggleTheme,
        t,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferencesContext);
