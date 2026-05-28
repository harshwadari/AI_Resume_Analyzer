import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "../../features/theme/theme.context.jsx";

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
      aria-label="Toggle theme"
    >
      {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
      <span>{isDark ? "Light" : "Dark"} mode</span>
    </button>
  );
};

export default ThemeToggle;
