export type ThemeAppearance = "light" | "dark" | "system";
export type ThemeColor = "orange" | "blue" | "green" | "purple";
export type UiScale = "80" | "85" | "90" | "100";

export const UI_SCALE_OPTIONS: Array<{
  value: UiScale;
  label: string;
  px: string;
  desc: string;
}> = [
  { value: "80", label: "80%", px: "12.8px", desc: "Padat" },
  { value: "85", label: "85%", px: "13.6px", desc: "Tablet" },
  { value: "90", label: "90%", px: "14.4px", desc: "Sedang" },
  { value: "100", label: "100%", px: "16px", desc: "Normal" },
];

export const UI_SCALE_PX_MAP: Record<UiScale, string> = {
  "80": "12.8px",
  "85": "13.6px",
  "90": "14.4px",
  "100": "16px",
};

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
    label: "Green (Kebab's Choice)",
    primary: "oklch(0.58 0.175 148)",
    hex: "#16a34a",
    ring: "oklch(0.58 0.175 148)",
    shadow: "0 16px 45px -18px oklch(0.58 0.175 148 / 72%)",
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
export const STORAGE_UI_SCALE_KEY = "kebabschoicepos_ui_scale";

export function isValidUiScale(val: unknown): val is UiScale {
  return val === "80" || val === "85" || val === "90" || val === "100";
}

export function resolveAutoUiScale(viewportWidth?: number): UiScale {
  const width =
    typeof viewportWidth === "number"
      ? viewportWidth
      : typeof window !== "undefined"
        ? window.innerWidth
        : 1280;
  if (width >= 680 && width <= 1180) {
    return "85";
  }
  return "100";
}

export function hasExplicitUiScale(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isValidUiScale(localStorage.getItem(STORAGE_UI_SCALE_KEY));
  } catch {
    return false;
  }
}

export function getStoredUiScale(): UiScale {
  if (typeof window === "undefined") {
    return "100";
  }
  try {
    const saved = localStorage.getItem(STORAGE_UI_SCALE_KEY);
    if (isValidUiScale(saved)) {
      return saved;
    }
  } catch {}
  return resolveAutoUiScale(window.innerWidth);
}

export function applyUiScale(scale?: UiScale) {
  if (typeof window === "undefined") return;
  const resolved = scale && isValidUiScale(scale) ? scale : getStoredUiScale();
  const root = document.documentElement;
  root.style.fontSize = UI_SCALE_PX_MAP[resolved] || "16px";
  root.dataset.uiScale = resolved;
}

export function saveUiScale(scale: UiScale) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_UI_SCALE_KEY, scale);
  } catch {}
  applyUiScale(scale);
  window.dispatchEvent(new CustomEvent("ui-scale-changed", { detail: scale }));
}

export function getStoredTheme(): { appearance: ThemeAppearance; color: ThemeColor } {
  if (typeof window === "undefined") {
    return { appearance: "system", color: "green" };
  }
  const appearance = (localStorage.getItem(STORAGE_APPEARANCE_KEY) as ThemeAppearance) || "light";
  const color = (localStorage.getItem(STORAGE_COLOR_KEY) as ThemeColor) || "green";
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
  const colorConfig = THEME_COLOR_CONFIG[color] || THEME_COLOR_CONFIG.green;
  root.style.setProperty("--primary", colorConfig.primary);
  root.style.setProperty("--ring", colorConfig.ring);
  root.style.setProperty("--sidebar-primary", colorConfig.primary);
  root.style.setProperty("--shadow-brand", colorConfig.shadow);

  // 3. Global UI Scale (Auto 85% / 13.6px on Tablet 680px-1180px unless explicitly saved)
  applyUiScale();
}

export function saveTheme(appearance: ThemeAppearance, color: ThemeColor) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_APPEARANCE_KEY, appearance);
  localStorage.setItem(STORAGE_COLOR_KEY, color);
  applyTheme(appearance, color);
}
