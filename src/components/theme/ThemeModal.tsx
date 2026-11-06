import { useState, useEffect } from "react";
import { Sun, Moon, Laptop, Palette, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ThemeAppearance,
  ThemeColor,
  THEME_COLOR_CONFIG,
  getStoredTheme,
  saveTheme,
} from "@/lib/theme";
import { toast } from "sonner";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const [appearance, setAppearance] = useState<ThemeAppearance>("light");
  const [color, setColor] = useState<ThemeColor>("orange");

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredTheme();
      setAppearance(stored.appearance);
      setColor(stored.color);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAppearance = (app: ThemeAppearance) => {
    setAppearance(app);
    saveTheme(app, color);
    toast.success(
      `Tampilan diubah ke ${app === "light" ? "Light Mode ☀️" : app === "dark" ? "Dark Mode 🌙" : "System Mode 🌓"}`,
    );
  };

  const handleSelectColor = (col: ThemeColor) => {
    setColor(col);
    saveTheme(appearance, col);
    toast.success(`Warna tema diubah ke ${THEME_COLOR_CONFIG[col].label}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="size-5" />
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

        <div className="mt-5 space-y-6">
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
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
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
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-xs font-bold transition-all text-left ${
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

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} className="rounded-xl px-5 font-bold">
            Selesai
          </Button>
        </div>
      </div>
    </div>
  );
}
