import { appThemeOptions } from "../theme/themes";
import { useThemeStore } from "../store/themeStore";

type ThemeToggleProps = {
  compact?: boolean;
};

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      className={compact
        ? "inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low p-1"
        : "inline-flex items-center rounded-2xl border border-outline-variant bg-surface-container-low p-1.5 shadow-sm"}
    >
      {appThemeOptions.map((option) => {
        const active = option.value === themeName;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={compact
              ? `rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`
              : `rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-primary text-on-primary shadow-[0_10px_30px_rgba(0,0,0,0.16)]" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}