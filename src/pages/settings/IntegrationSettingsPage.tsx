import { useState } from "react";
import { Puzzle, Check, ExternalLink, RefreshCw, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function IntegrationSettingsPage() {
  const [gofoodActive, setGofoodActive] = useState(false);
  const [grabfoodActive, setGrabfoodActive] = useState(false);
  const [shopeefoodActive, setShopeefoodActive] = useState(false);
  const [jurnalActive, setJurnalActive] = useState(false);
  const [apiKey, setApiKey] = useState("kc_live_948f938201fa84c98e21");
  const [webhookUrl, setWebhookUrl] = useState("https://api.yourdomain.com/pos/webhook");

  const generateNewKey = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    setApiKey(`kc_live_${randomHex}`);
    toast.success("API Secret Key baru berhasil di-generate");
  };

  const handleSave = () => {
    toast.success("Pengaturan Integrasi berhasil disimpan");
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <h1 className="text-3xl font-black tracking-normal">Integrasi Ekosistem</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Hubungkan KebabsChoicePOS dengan layanan pesan antar makanan (Food Delivery), aplikasi
          akuntansi, dan Webhook API.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Layanan Pesan Antar Online */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Puzzle className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Online Food Delivery Integration</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Terima pesanan online langsung masuk ke layar POS dan kurangi stok otomatis.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            {/* GoFood */}
            <div className="rounded-2xl border p-4 flex flex-col justify-between space-y-4 bg-background">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">GoFood / GoBiz</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      gofoodActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {gofoodActive ? "Terhubung" : "Nonaktif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Sinkronisasi menu dan order via GoBiz API.
                </p>
              </div>
              <Button
                type="button"
                variant={gofoodActive ? "outline" : "default"}
                size="sm"
                className="w-full rounded-xl text-xs font-bold"
                onClick={() => {
                  setGofoodActive(!gofoodActive);
                  toast.success(
                    gofoodActive ? "GoFood dinonaktifkan" : "GoFood berhasil dihubungkan!",
                  );
                }}
              >
                {gofoodActive ? "Putuskan" : "Hubungkan"}
              </Button>
            </div>

            {/* GrabFood */}
            <div className="rounded-2xl border p-4 flex flex-col justify-between space-y-4 bg-background">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">GrabFood Merchant</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      grabfoodActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {grabfoodActive ? "Terhubung" : "Nonaktif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Sinkronisasi pesanan dari GrabFood Partner.
                </p>
              </div>
              <Button
                type="button"
                variant={grabfoodActive ? "outline" : "default"}
                size="sm"
                className="w-full rounded-xl text-xs font-bold"
                onClick={() => {
                  setGrabfoodActive(!grabfoodActive);
                  toast.success(
                    grabfoodActive ? "GrabFood dinonaktifkan" : "GrabFood berhasil dihubungkan!",
                  );
                }}
              >
                {grabfoodActive ? "Putuskan" : "Hubungkan"}
              </Button>
            </div>

            {/* ShopeeFood */}
            <div className="rounded-2xl border p-4 flex flex-col justify-between space-y-4 bg-background">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">ShopeeFood Partner</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      shopeefoodActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {shopeefoodActive ? "Terhubung" : "Nonaktif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Integrasi order langsung Shopee Partner.
                </p>
              </div>
              <Button
                type="button"
                variant={shopeefoodActive ? "outline" : "default"}
                size="sm"
                className="w-full rounded-xl text-xs font-bold"
                onClick={() => {
                  setShopeefoodActive(!shopeefoodActive);
                  toast.success(
                    shopeefoodActive
                      ? "ShopeeFood dinonaktifkan"
                      : "ShopeeFood berhasil dihubungkan!",
                  );
                }}
              >
                {shopeefoodActive ? "Putuskan" : "Hubungkan"}
              </Button>
            </div>
          </div>
        </div>

        {/* Akuntansi & Webhook API */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Key className="size-5 text-primary" />
            <h2 className="text-lg font-bold">API & Webhook Developer</h2>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground/80">API Secret Key</label>
              <div className="flex gap-2 mt-1.5">
                <Input className="rounded-xl font-mono text-xs" value={apiKey} readOnly />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateNewKey}
                  className="rounded-xl text-xs font-bold shrink-0"
                >
                  <RefreshCw className="size-3.5 mr-1" />
                  Regenerate
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground/80">
                Webhook URL Transaksi Masuk
              </label>
              <Input
                className="mt-1.5 rounded-xl font-mono text-xs"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://domain.com/webhook"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} className="rounded-2xl font-bold shadow-brand">
            Simpan Konfigurasi Integrasi
          </Button>
        </div>
      </div>
    </div>
  );
}
