import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit,
  TrendingUp,
  Clock,
  Sparkles,
  AlertCircle,
  Users,
  Package,
  Calendar,
  Zap,
  ArrowRight,
  Loader2,
  RefreshCw,
  Store,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getComprehensiveAnalytics,
  exportToCSV,
  type BusinessAnalyticsSummary,
  type DateRangePreset,
} from "@/services/reports.service";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InsightAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsSummary | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangePreset>("last_7_days");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let bId =
        typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
          : "";
      if (!bId) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const { data: b } = await supabase
            .from("businesses")
            .select("id")
            .eq("owner_id", data.user.id)
            .limit(1)
            .maybeSingle();
          bId = b?.id || "";
          if (!bId) {
            const { data: mem } = await supabase
              .from("business_members")
              .select("business_id")
              .eq("user_id", data.user.id)
              .limit(1)
              .maybeSingle();
            bId = mem?.business_id || "";
          }
        }
      }
      if (bId) {
        if (outletsList.length === 0) {
          const { data: oData } = await supabase
            .from("outlets")
            .select("id, name")
            .eq("business_id", bId)
            .order("name", { ascending: true });
          if (oData && oData.length > 0) {
            setOutletsList(oData);
          }
        }

        const data = await getComprehensiveAnalytics(bId, {
          outletId: selectedOutletId,
          dateRange,
          startDate: dateRange === "custom" ? startDate : undefined,
          endDate: dateRange === "custom" ? endDate : undefined,
        });
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to load insight analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, dateRange, startDate, endDate, outletsList.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !analytics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-ai" />
          <p className="text-sm font-bold text-muted-foreground">
            Menganalisis pola transaksi & engine AI...
          </p>
        </div>
      </div>
    );
  }

  const recommendations = analytics?.recommendations || [];
  const dailyTrends = analytics?.dailyTrends || [];
  const peakHours = analytics?.peakHours || [];
  const topOutlet = analytics?.outlets[0];

  const handleExportCSV = () => {
    if (!analytics || dailyTrends.length === 0) {
      toast.error("Tidak ada data insight untuk diekspor");
      return;
    }
    const headers = ["No", "Hari", "Tanggal", "Omzet Aktual", "Proyeksi AI", "Jumlah Transaksi"];

    const rows = dailyTrends.map((t, idx) => [
      idx + 1,
      t.day,
      t.dateStr,
      t.aktual ? formatRupiah(t.aktual) : "Rp 0",
      formatRupiah(t.prediksi),
      t.orders,
    ]);

    const dateLabel =
      dateRange === "today"
        ? "Hari_Ini"
        : dateRange === "last_7_days"
          ? "7_Hari_Terakhir"
          : dateRange === "this_month"
            ? "Bulan_Ini"
            : `${startDate || "Awal"}_sd_${endDate || "Akhir"}`;

    const filename = `Laporan_Insight_Analytics_${dateLabel}_${new Date().toISOString().split("T")[0]}`;
    const success = exportToCSV(filename, headers, rows);
    if (success) {
      toast.success("Data analitik insight berhasil diekspor ke CSV!");
    } else {
      toast.error("Gagal mengekspor laporan CSV.");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header Banner */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-ai-soft text-ai">
                <BrainCircuit className="size-5" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Insight Analytics</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Intelligence engine yang menganalisis transaksi kasir, prediksi omzet, jam sibuk
              outlet, dan rekomendasi restock bahan baku.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Cabang Dropdown */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 shadow-xs">
              <Store className="size-4 text-primary shrink-0" />
              <div className="text-xs">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                  Cabang
                </span>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="bg-transparent font-black text-foreground focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">Semua Cabang ({outletsList.length})</option>
                  {outletsList.map((o) => (
                    <option key={o.id} value={o.id}>
                      📍 {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 shadow-xs">
              <Calendar className="size-4 text-primary shrink-0" />
              <div className="text-xs">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                  Periode
                </span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                  className="bg-transparent font-black text-foreground focus:outline-none cursor-pointer pr-1"
                >
                  <option value="today">Hari Ini</option>
                  <option value="last_7_days">7 Hari Terakhir</option>
                  <option value="this_month">Bulan Ini</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            {/* Custom Date Pickers */}
            {dateRange === "custom" && (
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-2.5 py-1.5 shadow-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                />
                <span className="text-muted-foreground text-[10px] font-bold">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {/* Export CSV Button */}
            <Button
              variant="default"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || dailyTrends.length === 0}
              className="rounded-xl gap-1.5 font-bold shadow-xs cursor-pointer"
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="rounded-xl gap-1.5 font-bold cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Perbarui Prediksi
            </Button>
          </div>
        </div>
      </div>

      {/* AI Recommendations Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-black text-foreground">
          <Sparkles className="size-4 text-ai" />
          <span>Rekomendasi Cerdas AI (Decision Engine)</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      rec.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : rec.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    Prioritas {rec.priority}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground capitalize">
                    {rec.type}
                  </span>
                </div>
                <h3 className="text-sm font-black text-foreground">{rec.title}</h3>
                <p className="text-xs leading-5 text-muted-foreground">{rec.description}</p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600 truncate max-w-[180px]">
                  💡 {rec.impact}
                </span>
                {rec.actionLabel && rec.actionHref && (
                  <Link
                    to={rec.actionHref}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0"
                  >
                    {rec.actionLabel}
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts: Sales Forecast & Peak Hours */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trend & Prediksi Penjualan */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div>
            <h2 className="text-base font-black">Trend Omzet Harian & Prediksi AI</h2>
            <p className="text-xs text-muted-foreground">
              Perbandingan penjualan aktual 7 hari terakhir dengan proyeksi target cerdas
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aktualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="prediksiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ai)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--ai)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis
                  fontSize={11}
                  domain={[0, "auto"]}
                  tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString("id-ID")}k`}
                />
                <ChartTooltip
                  formatter={(val: any, name: string) => [
                    val ? formatRupiah(Number(val)) : "Belum Berjalan",
                    name === "aktual" ? "Aktual" : "Prediksi",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="aktual"
                  stroke="var(--primary)"
                  fill="url(#aktualGrad)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="prediksi"
                  stroke="var(--ai)"
                  strokeDasharray="4 4"
                  fill="url(#prediksiGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs pt-1">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" /> Aktual
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-ai" /> Proyeksi AI
            </span>
          </div>
        </div>

        {/* Pola Jam Sibuk (Peak Hours) */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div>
            <h2 className="text-base font-black">Distribusi Jam Ramai (Peak Hours)</h2>
            <p className="text-xs text-muted-foreground">
              Volume order per jam operasional dihitung langsung dari riwayat transaksi
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="hour" fontSize={10} />
                <YAxis fontSize={11} />
                <ChartTooltip formatter={(val: any) => [`${val} Order`, "Volume Transaksi"]} />
                <Bar dataKey="orders" fill="var(--ai)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Waktu terpadat terdeteksi pada jam makan siang (12:00) dan makan malam (18:00 - 20:00).
          </p>
        </div>
      </div>
    </div>
  );
}
