import { useState, useEffect } from "react";
import { Percent, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveCurrentBusinessIds } from "@/services/outlet.service";
import { sanitizeQuantityInput, stripLeadingZeros } from "@/lib/input-formatters";

export function TaxSettingsPage() {
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(10);
  const [taxName, setTaxName] = useState("PB1 (Pajak Restoran)");
  const [taxMode, setTaxMode] = useState<"inclusive" | "exclusive">("exclusive");
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [serviceRate, setServiceRate] = useState(5);

  useEffect(() => {
    async function loadSettings() {
      try {
        let resolvedConfig = {
          taxEnabled: true,
          taxRate: 10,
          taxName: "PB1 (Pajak Restoran)",
          taxMode: "exclusive" as "inclusive" | "exclusive",
          serviceEnabled: false,
          serviceRate: 5,
        };
        let foundSaved = false;

        const saved = localStorage.getItem("kebabschoicepos_tax_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          foundSaved = true;
          resolvedConfig = {
            taxEnabled: typeof parsed.taxEnabled === "boolean" ? parsed.taxEnabled : true,
            taxRate: parsed.taxRate !== undefined ? Number(parsed.taxRate) : 10,
            taxName: parsed.taxName || "PB1 (Pajak Restoran)",
            taxMode: parsed.taxMode === "inclusive" ? "inclusive" : "exclusive",
            serviceEnabled: typeof parsed.serviceEnabled === "boolean" ? parsed.serviceEnabled : false,
            serviceRate: parsed.serviceRate !== undefined ? Number(parsed.serviceRate) : 5,
          };
        }

        // Check Supabase outlets.settings.tax_settings scoped to active user's businesses
        let allBizIds: string[] = [];
        try {
          const biz = await resolveCurrentBusinessIds();
          allBizIds = biz.allIds;
        } catch {}

        let outletsQuery = supabase.from("outlets").select("id, settings");
        if (allBizIds.length > 0) {
          outletsQuery = outletsQuery.in("business_id", allBizIds);
        } else {
          outletsQuery = outletsQuery.limit(5);
        }
        const { data: outletsData } = await outletsQuery;
        if (outletsData && Array.isArray(outletsData)) {
          for (const out of outletsData) {
            const taxConf = (out.settings as any)?.tax_settings;
            if (taxConf) {
              foundSaved = true;
              resolvedConfig = {
                taxEnabled:
                  typeof taxConf.taxEnabled === "boolean"
                    ? taxConf.taxEnabled
                    : resolvedConfig.taxEnabled,
                taxRate:
                  taxConf.taxRate !== undefined ? Number(taxConf.taxRate) : resolvedConfig.taxRate,
                taxName: taxConf.taxName || resolvedConfig.taxName,
                taxMode: taxConf.taxMode === "inclusive" ? "inclusive" : "exclusive",
                serviceEnabled:
                  typeof taxConf.serviceEnabled === "boolean"
                    ? taxConf.serviceEnabled
                    : resolvedConfig.serviceEnabled,
                serviceRate:
                  taxConf.serviceRate !== undefined
                    ? Number(taxConf.serviceRate)
                    : resolvedConfig.serviceRate,
              };
              break;
            }
          }
        }

        setTaxEnabled(resolvedConfig.taxEnabled);
        setTaxRate(resolvedConfig.taxRate);
        setTaxName(resolvedConfig.taxName);
        setTaxMode(resolvedConfig.taxMode);
        setServiceEnabled(resolvedConfig.serviceEnabled);
        setServiceRate(resolvedConfig.serviceRate);

        // Always keep localStorage synced so Smart Cart /pos matches the active state displayed in /tax
        if (!foundSaved || !saved) {
          localStorage.setItem("kebabschoicepos_tax_settings", JSON.stringify(resolvedConfig));
          window.dispatchEvent(new CustomEvent("tax:updated", { detail: resolvedConfig }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    const data = {
      taxEnabled,
      taxRate: Number(taxRate) || 0,
      taxName: taxName.trim() || "PB1 (Pajak Restoran)",
      taxMode,
      serviceEnabled,
      serviceRate: Number(serviceRate) || 0,
    };
    localStorage.setItem("kebabschoicepos_tax_settings", JSON.stringify(data));

    try {
      let allBizIds: string[] = [];
      try {
        const biz = await resolveCurrentBusinessIds();
        allBizIds = biz.allIds;
      } catch {}

      let outletsQuery = supabase.from("outlets").select("id, settings");
      if (allBizIds.length > 0) {
        outletsQuery = outletsQuery.in("business_id", allBizIds);
      }
      const { data: allOutlets } = await outletsQuery;
      if (allOutlets && Array.isArray(allOutlets)) {
        for (const out of allOutlets) {
          const curr =
            out.settings && typeof out.settings === "object" && !Array.isArray(out.settings)
              ? (out.settings as Record<string, any>)
              : {};
          await supabase
            .from("outlets")
            .update({
              settings: { ...curr, tax_settings: data } as any,
            })
            .eq("id", out.id);
        }
      }
    } catch (sbErr) {
      console.warn("Tax settings Supabase sync warning:", sbErr);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("tax:updated", { detail: data }));
    }
    toast.success("Pengaturan Pajak & Biaya Layanan berhasil disimpan");
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <h1 className="text-3xl font-black tracking-normal">Pengaturan Pajak</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Kelola tarif pajak PB1 restoran, PPN, mekanisme inklusif/eksklusif, serta service charge.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Pajak Restoran / PPN */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Pajak Penjualan (PB1 / PPN)</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{taxEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>

          {taxEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Label / Nama Pajak di Struk
                  </label>
                  <Input
                    className="mt-1.5 rounded-xl"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    placeholder="PB1 (Pajak Restoran)"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Persentase Pajak (%)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="rounded-xl font-mono"
                      value={stripLeadingZeros(taxRate)}
                      onChange={(e) =>
                        setTaxRate(Math.min(100, sanitizeQuantityInput(e.target.value)))
                      }
                      placeholder="10"
                    />
                    <div className="flex gap-1.5">
                      {[10, 11, 12].map((pct) => (
                        <Button
                          key={pct}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs h-9 px-3"
                          onClick={() => setTaxRate(pct)}
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/80 block mb-2">
                  Metode Perhitungan Pajak
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaxMode("exclusive")}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      taxMode === "exclusive"
                        ? "border-primary bg-primary/10 text-primary shadow-soft"
                        : "border-border bg-background hover:bg-secondary/50 text-foreground"
                    }`}
                  >
                    <p className="font-bold text-sm">Harga Belum Termasuk Pajak (Exclusive)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pajak akan ditambahkan di subtotal saat checkout transaksi POS.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaxMode("inclusive")}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      taxMode === "inclusive"
                        ? "border-primary bg-primary/10 text-primary shadow-soft"
                        : "border-border bg-background hover:bg-secondary/50 text-foreground"
                    }`}
                  >
                    <p className="font-bold text-sm">Harga Sudah Termasuk Pajak (Inclusive)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Harga di menu sudah mencakup pajak, rincian pajak tetap tertera di struk.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Biaya Layanan (Service Charge) */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Biaya Layanan (Service Charge)</h2>
              <p className="text-xs text-muted-foreground">
                Opsional untuk pesanan dine-in atau operasional resto.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={serviceEnabled}
                onChange={(e) => setServiceEnabled(e.target.checked)}
                className="size-4 accent-primary rounded"
              />
              <span className="text-sm font-bold">{serviceEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>

          {serviceEnabled && (
            <div className="pt-2 border-t border-border max-w-sm">
              <label className="text-xs font-bold text-foreground/80">
                Persentase Service Charge (%)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                className="mt-1.5 rounded-xl font-mono"
                value={stripLeadingZeros(serviceRate)}
                onChange={(e) =>
                  setServiceRate(Math.min(50, sanitizeQuantityInput(e.target.value)))
                }
                placeholder="5"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} className="rounded-2xl font-bold shadow-brand">
            Simpan Pengaturan Pajak
          </Button>
        </div>
      </div>
    </div>
  );
}
