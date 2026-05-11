import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

function hexToRgb(hex) {
  try {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  } catch {
    return '13,148,136'; // teal fallback
  }
}

export function ThemeProvider({ children, overrideTheme }) {
  const { hospital } = useAuth();
  const theme = overrideTheme || hospital?.theme;

  useEffect(() => {
    if (!theme) return;
    try {
      const root = document.documentElement;
      const set = (v, val) => { if (val) root.style.setProperty(v, val); };
      set('--color-primary',   theme.primary);
      set('--color-secondary', theme.secondary);
      set('--color-accent',    theme.accent);
      set('--color-bg',        theme.background || theme.secondary);
      set('--color-surface',   theme.surface);
      if (theme.primary) {
        root.style.setProperty('--color-primary-rgb', hexToRgb(theme.primary));
      }
    } catch (e) {
      console.warn('Theme apply failed:', e);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
