import { useEffect, useState } from "react";
import { Check, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_LANGUAGES,
  useTranslation,
  type AppLanguage,
  type SupportedLanguageOption,
} from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSettingsPage({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  const activeLanguageObj: SupportedLanguageOption =
    SUPPORTED_LANGUAGES.find((item) => item.code === language) ?? SUPPORTED_LANGUAGES[0]!;

  const handleSelectLanguage = async (opt: SupportedLanguageOption) => {
    await setLanguage(opt.code as AppLanguage, userId);
    toast.success(`${t("language.toast_changed", "Bahasa aplikasi diubah ke")} ${opt.nativeName} (${opt.iso})`, {
      description: t("language.toast_desc", "Seluruh tampilan diperbarui secara real-time."),
    });
  };

  return (
    <div className="space-y-4 w-full max-w-none">
      {!compact && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe2 className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {t("language.title", "Bahasa Aplikasi")}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {t(
                  "language.subtitle",
                  "Pilih bahasa tampilan KebabsChoicePOS. Seluruh menu Kasir & Profil langsung berganti secara real-time tanpa muat ulang.",
                )}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 self-start sm:self-center whitespace-nowrap">
            {t("language.supported_badge", "2 Bahasa Aktif")}
          </span>
        </div>
      )}

      {/* Bahasa Aktif Saat Ini */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm tracking-wider">
            {activeLanguageObj.iso}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("language.active_language", "Bahasa Aktif Saat Ini")}
            </p>
            <h2 className="text-base sm:text-lg font-black text-foreground truncate">
              {activeLanguageObj.nativeName}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                ({activeLanguageObj.iso})
              </span>
            </h2>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shrink-0">
          <Check className="size-3.5" />
          <span>{t("language.in_use", "Digunakan")}</span>
        </span>
      </div>

      {/* Pilihan 2 Bahasa Resmi yang Didukung Penuh */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("language.choose_label", "Pilih Bahasa Tampilan")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORTED_LANGUAGES.map((opt) => {
            const isSelected = opt.code === language;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => handleSelectLanguage(opt)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer active:scale-[0.99]",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-xs"
                    : "border-border bg-background hover:bg-secondary/60 text-foreground",
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl font-black text-xs tracking-wider border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-border",
                    )}
                  >
                    {opt.iso}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm truncate",
                        isSelected ? "font-black text-primary" : "font-bold text-foreground",
                      )}
                    >
                      {opt.nativeName} ({opt.iso})
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {language === "en" ? opt.descriptionEn : opt.descriptionId}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center shrink-0 border",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {isSelected && <Check className="size-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
