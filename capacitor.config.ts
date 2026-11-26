import type { CapacitorConfig } from "@capacitor/cli";

/**
 * KebabsChoice POS — Android (.apk) wrapper via Capacitor.
 *
 * LIVE URL MODE: WebView langsung memuat aplikasi live di Vercel, sehingga setiap
 * deploy baru di Vercel otomatis ikut ter-update di tablet tanpa install ulang .apk.
 *
 * `webDir` hanya berisi halaman fallback statis kecil (dipakai `cap sync`), karena
 * build TanStack Start (SSR) tidak menghasilkan index.html statis. Folder ini tidak
 * menyentuh build Vercel sama sekali.
 */
const config: CapacitorConfig = {
  appId: "com.kebabschoice.pos",
  appName: "KebabsChoice POS",
  webDir: "capacitor-www",
  server: {
    url: "https://kebabschoice.vercel.app/login/pos",
    cleartext: false,
    allowNavigation: ["kebabschoice.vercel.app", "*.supabase.co"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
