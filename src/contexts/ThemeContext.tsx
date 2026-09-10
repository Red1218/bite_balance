import React, { createContext, useContext, useEffect, useState } from 'react';

type ResolvedTheme = 'light' | 'dark';
type ThemePreference = ResolvedTheme | 'system';

interface ThemeContextType {
  theme: ResolvedTheme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const resolve = (preference: ThemePreference, mql: MediaQueryList): ResolvedTheme => {
  if (preference === 'system') return mql.matches ? 'dark' : 'light';
  return preference;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as ThemePreference) || 'dark';
  });
  const [theme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = resolve(preference, mql);
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    };

    apply();
    localStorage.setItem('theme', preference);

    if (preference === 'system') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [preference]);

  const toggleTheme = () => {
    setPreferenceState((prev) => (resolve(prev, window.matchMedia('(prefers-color-scheme: dark)')) === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: ThemePreference) => {
    setPreferenceState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
