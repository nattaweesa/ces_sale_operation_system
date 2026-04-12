import { create } from "zustand";
import { defaultThemeName, isAppThemeName, type AppThemeName } from "../theme/themes";

type ThemeState = {
  themeName: AppThemeName;
  setTheme: (themeName: AppThemeName) => void;
};

function getInitialTheme(): AppThemeName {
  const raw = localStorage.getItem("app_theme");
  return isAppThemeName(raw) ? raw : defaultThemeName;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: getInitialTheme(),
  setTheme: (themeName) => {
    localStorage.setItem("app_theme", themeName);
    set({ themeName });
  },
}));