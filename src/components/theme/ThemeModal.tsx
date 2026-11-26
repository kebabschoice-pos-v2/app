import { useState, useEffect } from "react";
import { Sun, Moon, Laptop, Palette, Check, X, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ThemeAppearance,
  ThemeColor,
  UiScale,
  UI_SCALE_OPTIONS,
  THEME_COLOR_CONFIG,
  getStoredTheme,
  getStoredUiScale,
  saveTheme,
  saveUiScale,
} from "@/lib/theme";
import { toast } from "sonner";

interface ThemeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export function ThemeModal({ isOpen = true, onClose, inline = false }: ThemeModalProps) {
  const [appearance, setAppearance] = useState<ThemeAppearance>(() => getStoredTheme().appearance);
  const [color, setColor] = useState<ThemeColor>(() => getStoredTheme().color);
  const [uiScale, setUiScale] = useState<UiScale>(() => getStoredUiScale());

  useEffect(() => {
    if (isOpen || inline) {
      const stored = getStoredTheme();
      setAppearance(stored.appearance);
      setColor(stored.color);
      setUiScale(getStoredUiScale());
    }
  }, [isOpen, inline]);

  useEffect(() => {
    const syncScale = (e: Event) => {
      const detail = (e as CustomEvent<UiScale>).detail;
      setUiScale(detail || getStoredUiScale());
    };
    window.addEventListener("ui-scale-changed", syncScale);
    return () => window.removeEventListener("ui-scale-changed", syncScale);
  }, []);

  if (!inline && !isOpen) return null;

  const handleSelectAppearance = (app: ThemeAppearance) => {
    setAppearance(app);
    saveTheme(app, color);
    toast.success(
      `Tampilan diubah ke ${app === "light" ? "Light Mode" : app === "dark" ? "Dark Mode" : "System Mode"}`,
    );
  };

  const handleSelectColor = (col: ThemeColor) => {
    setColor(col);
    saveTheme(appearance, col);
    toast.success(`Warna tema diubah ke ${THEME_COLOR_CONFIG[col].label}`);
  };

  const handleSelectScale = (scale: UiScale) => {
    setUiScale(scale);
    saveUiScale(scale);
    toast.success(`Ukuran tampilan diubah ke ${scale}%`);
  };

  const controlsContent = (
    <div className={inline ? "mt-4 space-y-5" : "mt-5 space-y-6"}>
      <div className={inline ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "space-y-6"}>
        {/* Appearance Switcher */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-2.5">
            Mode Tampilan (Appearance)
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Laptop },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = appearance === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectAppearance(item.id as ThemeAppearance)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-brand ring-1 ring-primary"
                      : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Switcher */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-2.5">
            Warna Utama & Aksen (Brand Color)
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {(Object.keys(THEME_COLOR_CONFIG) as ThemeColor[]).map((key) => {
              const conf = THEME_COLOR_CONFIG[key];
              const isSelected = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectColor(key)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-xs font-bold transition-all text-left cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary"
                      : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                  }`}
                >
                  <span
                    className="size-5 rounded-full shrink-0 flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: conf.hex }}
                  >
                    {isSelected && <Check className="size-3 text-white stroke-[3]" />}
                  </span>
                  <span className="truncate">{conf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* UI Scale Switcher (80% / 85% / 90% / 100%) */}
      {!inline && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Monitor className="size-3.5" />
              <span>Ukuran Tampilan (UI Scale)</span>
            </label>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Default Tablet: 85%
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {UI_SCALE_OPTIONS.map((opt) => {
              const isSelected = uiScale === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectScale(opt.value)}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2.5 px-2 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-brand ring-1 ring-primary"
                      : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="text-sm font-black">{opt.label}</span>
                  <span
                    className={`text-[11px] font-medium ${
                      isSelected ? "text-primary-foreground/85" : "text-muted-foreground"
                    }`}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-border pb-3.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Palette className="size-4.5" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-normal text-foreground">
              Kustomisasi Tema Warna & Mode Tampilan
            </h2>
            <p className="text-xs text-muted-foreground">
              Pilih mode terang/gelap dan warna utama antarmuka aplikasi secara langsung.
            </p>
          </div>
        </div>
        {controlsContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/75">
              <Palette className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-normal">Kustomisasi Tema UI</h2>
              <p className="text-xs text-muted-foreground">
                Pilih mode tampilan & warna aksen aplikasi
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {controlsContent}

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} className="rounded-xl px-5 font-bold">
            Selesai
          </Button>
        </div>
      </div>
    </div>
  );
}
