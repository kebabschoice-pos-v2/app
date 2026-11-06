import { useState, useMemo, useEffect } from "react";
import { Globe2, Search, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setAppLanguage } from "@/i18n/config";
import { supabase } from "@/integrations/supabase/client";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  region: "asia" | "europe" | "middle_east";
}

const LANGUAGES: LanguageOption[] = [
  // ASIA
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", region: "asia" },
  { code: "en", name: "English (US)", nativeName: "English", flag: "🇺🇸", region: "asia" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", region: "asia" },
  { code: "zh", name: "Chinese Simplified", nativeName: "简体中文", flag: "🇨🇳", region: "asia" },
  {
    code: "zh-TW",
    name: "Chinese Traditional",
    nativeName: "繁體中文",
    flag: "🇹🇼",
    region: "asia",
  },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", region: "asia" },
  { code: "th", name: "Thai", nativeName: "ภาษาไทย", flag: "🇹🇭", region: "asia" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", region: "asia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", region: "asia" },
  { code: "fil", name: "Filipino", nativeName: "Tagalog", flag: "🇵🇭", region: "asia" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", region: "asia" },

  // EUROPE
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", region: "europe" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", region: "europe" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", region: "europe" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", region: "europe" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", region: "europe" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", region: "europe" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", region: "europe" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", region: "europe" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", region: "europe" },

  // MIDDLE EAST
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", region: "middle_east" },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", region: "middle_east" },
];

export function LanguageSettingsPage() {
  const [currentLang, setCurrentLang] = useState<string>("id");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kebabschoicepos_language");
      if (saved) setCurrentLang(saved);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        supabase
          .from("profiles")
          .select("language")
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: profileData }) => {
            if (profileData?.language) {
              setCurrentLang(profileData.language);
            }
          });
      }
    });
  }, []);

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter((lang) => {
      const matchRegion = selectedRegion === "all" || lang.region === selectedRegion;
      const matchSearch =
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRegion && matchSearch;
    });
  }, [searchQuery, selectedRegion]);

  const activeLanguageObj = useMemo<LanguageOption>(() => {
    return LANGUAGES.find((l) => l.code === currentLang) || (LANGUAGES[0] as LanguageOption);
  }, [currentLang]);

  const handleSelectLanguage = async (lang: LanguageOption) => {
    setCurrentLang(lang.code);
    await setAppLanguage(lang.code, userId);
    toast.success(`Bahasa diubah ke ${lang.nativeName} (${lang.name})`, {
      description: "Preferensi disimpan di profil akun & browser lokal",
    });
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header Banner */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Globe2 className="size-5" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Pengaturan Bahasa</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Pilih bahasa tampilan sistem KebabsChoicePOS yang paling sesuai untuk operasional
              bisnis harian Anda.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 self-start">
            {LANGUAGES.length} Bahasa Tersedia
          </span>
        </div>
      </div>

      {/* Active Language Highlight Card */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 shadow-soft flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{activeLanguageObj.flag}</div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase">
              Bahasa Aktif Saat Ini
            </p>
            <h2 className="text-xl font-black text-foreground">
              {activeLanguageObj.nativeName}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({activeLanguageObj.name})
              </span>
            </h2>
            <p className="text-xs text-primary font-semibold mt-0.5">
              Kode ISO: {activeLanguageObj.code.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary font-bold text-xs bg-primary/10 px-3 py-1.5 rounded-full">
          <Check className="size-4" />
          <span>Digunakan</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Semua Wilayah" },
              { id: "asia", label: "Asia" },
              { id: "europe", label: "Eropa" },
              { id: "middle_east", label: "Timur Tengah" },
            ].map((reg) => (
              <Button
                key={reg.id}
                type="button"
                variant={selectedRegion === reg.id ? "default" : "outline"}
                size="sm"
                className="rounded-xl text-xs font-bold"
                onClick={() => setSelectedRegion(reg.id)}
              >
                {reg.label}
              </Button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama bahasa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {filteredLanguages.map((lang) => {
            const isSelected = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-soft"
                    : "border-border bg-background hover:bg-secondary/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{lang.flag}</span>
                  <div className="truncate">
                    <p
                      className={`text-sm truncate leading-tight ${isSelected ? "font-black text-primary" : "font-bold"}`}
                    >
                      {lang.nativeName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{lang.name}</p>
                  </div>
                </div>

                <div
                  className={`size-6 rounded-full flex items-center justify-center shrink-0 border ml-2 ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border"
                  }`}
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
