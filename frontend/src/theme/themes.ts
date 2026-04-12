import { theme as antdTheme, type ThemeConfig } from "antd";

export type AppThemeName = "classic" | "atrium-dark";

type AppThemeDefinition = {
  name: AppThemeName;
  label: string;
  mode: "light" | "dark";
  antTheme: ThemeConfig;
};

export const defaultThemeName: AppThemeName = "atrium-dark";

export const appThemeOptions: Array<{ value: AppThemeName; label: string }> = [
  { value: "classic", label: "Classic" },
  { value: "atrium-dark", label: "Atrium Dark" },
];

const appThemes: Record<AppThemeName, AppThemeDefinition> = {
  classic: {
    name: "classic",
    label: "Classic",
    mode: "light",
    antTheme: {
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#131b2e",
        colorInfo: "#131b2e",
        colorSuccess: "#008cc7",
        colorWarning: "#c77b00",
        colorError: "#ba1a1a",
        colorBgBase: "#f6fafe",
        colorBgContainer: "#ffffff",
        colorTextBase: "#171c1f",
        colorBorder: "#c6c6cd",
        borderRadius: 12,
        fontFamily: "Inter, sans-serif",
      },
    },
  },
  "atrium-dark": {
    name: "atrium-dark",
    label: "Atrium Dark",
    mode: "dark",
    antTheme: {
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: "#a3a6ff",
        colorInfo: "#a3a6ff",
        colorSuccess: "#6bffc1",
        colorWarning: "#ffd166",
        colorError: "#ff6e84",
        colorBgBase: "#060e20",
        colorBgContainer: "#0f1930",
        colorTextBase: "#dee5ff",
        colorBorder: "#40485d",
        borderRadius: 14,
        fontFamily: "Plus Jakarta Sans, sans-serif",
      },
    },
  },
};

export function isAppThemeName(value: string | null | undefined): value is AppThemeName {
  return value === "classic" || value === "atrium-dark";
}

export function getAppThemeDefinition(name: AppThemeName): AppThemeDefinition {
  return appThemes[name];
}