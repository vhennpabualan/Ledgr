import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { formatMoney as formatMoneyUtil, type SupportedCurrency } from '@ledgr/types';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Currency = SupportedCurrency;

interface Settings {
  theme: ThemePreference;
  currency: Currency;
  budgetAlertThreshold: number; // percentage 0-100
}

interface SettingsContextValue extends Settings {
  setTheme: (t: ThemePreference) => void;
  setCurrency: (c: Currency) => void;
  setBudgetAlertThreshold: (n: number) => void;
  formatMoney: (minorUnits: number) => string;
}

const STORAGE_KEY = 'ledgr_settings';

const DEFAULTS: Settings = {
  theme: 'system',
  currency: 'PHP',
  budgetAlertThreshold: 80,
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
      // Update theme-color meta for PWA/browser chrome
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#0f0f1a' : '#f1f5f9');
    };

    if (settings.theme === 'dark') {
      applyTheme(true);
    } else if (settings.theme === 'light') {
      applyTheme(false);
    } else {
      // system — match OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark);
    }
  }, [settings.theme]);

  // Also listen for OS theme changes when set to 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const isDark = e.matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#0f0f1a' : '#f1f5f9');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  function save(next: Settings) {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // Memoize formatMoney to return a stable function per currency
  const formatMoney = useMemo(() => {
    return (minorUnits: number): string => formatMoneyUtil(minorUnits, settings.currency);
  }, [settings.currency]);

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setTheme: (theme) => save({ ...settings, theme }),
      setCurrency: (currency) => save({ ...settings, currency }),
      setBudgetAlertThreshold: (budgetAlertThreshold) => save({ ...settings, budgetAlertThreshold }),
      formatMoney,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
