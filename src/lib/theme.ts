export type ThemeAppearance = "light" | "dark" | "system";
export type ThemeColor = "orange" | "blue" | "green" | "purple";

export const THEME_COLOR_CONFIG: Record<
  ThemeColor,
  { label: string; primary: string; hex: string; ring: string; shadow: string }
> = {
  orange: {
    label: "Orange (Kebabs)",
    primary: "oklch(0.689 0.205 37.7)",
    hex: "#f97316",
    ring: "oklch(0.689 0.205 37.7)",
    shadow: "0 16px 45px -18px oklch(0.689 0.205 37.7 / 72%)",
  },
  blue: {
    label: "Blue (Sky)",
    primary: "oklch(0.6 0.2 245)",
    hex: "#0284c7",
    ring: "oklch(0.6 0.2 245)",
    shadow: "0 16px 45px -18px oklch(0.6 0.2 245 / 72%)",
  },
  green: {
    label: "Green (Emerald)",
    primary: "oklch(0.62 0.19 148)",
    hex: "#10b981",
    ring: "oklch(0.62 0.19 148)",
    shadow: "0 16px 45px -18px oklch(0.62 0.19 148 / 72%)",
  },
  purple: {
    label: "Purple (Royal)",
    primary: "oklch(0.6 0.22 305)",
    hex: "#9333ea",
    ring: "oklch(0.6 0.22 305)",
    shadow: "0 16px 45px -18px oklch(0.6 0.22 305 / 72%)",
  },
};

const STORAGE_APPEARANCE_KEY = "kebabschoicepos_theme_appearance";
const STORAGE_COLOR_KEY = "kebabschoicepos_theme_color";

export function getStoredTheme(): { appearance: ThemeAppearance; color: ThemeColor } {
  if (typeof window === "undefined") {
    return { appearance: "system", color: "orange" };
  }
  const appearance = (localStorage.getItem(STORAGE_APPEARANCE_KEY) as ThemeAppearance) || "light";
  const color = (localStorage.getItem(STORAGE_COLOR_KEY) as ThemeColor) || "orange";
  return { appearance, color };
}

export function applyTheme(appearance: ThemeAppearance, color: ThemeColor) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  // 1. Appearance (Dark / Light / System)
  let isDark = false;
  if (appearance === "dark") {
    isDark = true;
  } else if (appearance === "light") {
    isDark = false;
  } else if (appearance === "system") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Custom Color
  const colorConfig = THEME_COLOR_CONFIG[color] || THEME_COLOR_CONFIG.orange;
  root.style.setProperty("--primary", colorConfig.primary);
  root.style.setProperty("--ring", colorConfig.ring);
  root.style.setProperty("--sidebar-primary", colorConfig.primary);
  root.style.setProperty("--shadow-brand", colorConfig.shadow);
}

export function saveTheme(appearance: ThemeAppearance, color: ThemeColor) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_APPEARANCE_KEY, appearance);
  localStorage.setItem(STORAGE_COLOR_KEY, color);
  applyTheme(appearance, color);
}
