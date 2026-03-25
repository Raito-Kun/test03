import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
  localStorage.setItem('crm-theme', theme);
}

const savedTheme = (typeof localStorage !== 'undefined' ? localStorage.getItem('crm-theme') : null) as Theme | null;
if (savedTheme) applyTheme(savedTheme);

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: savedTheme || 'light',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
