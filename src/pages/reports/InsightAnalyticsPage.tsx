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
  ChevronDown,
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
import { getOutletList } from "@/services/outlet.service";
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
          const unifiedOutlets = await getOutletList(bId).catch(() => []);
          if (unifiedOutlets.length > 0) {
            setOutletsList(
              unifiedOutlets.map((o) => ({ id: o.id, name: o.name || o.outlet_name })),
            );
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
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">
            Menganalisis pola transaksi...
          </p>
        </div>
      </div>
    );
  }

  const recommendations = analytics?.recommendations || [];
  const dailyTrends = analytics?.dailyTrends || [];
  const peakHours = analytics?.peakHours || [];
  const topOutlet = analytics?.outlets[0];
  const hasDailySalesData = dailyTrends.some(
    (d) => (Number(d.aktual) || 0) > 0 || (Number(d.prediksi) || 0) > 0,
  );
  const hasPeakHoursData = peakHours.some((h) => (Number(h.orders) || 0) > 0);

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
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/75">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Insight Analytics</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Analisis transaksi kasir, prediksi omzet, jam sibuk outlet, dan rekomendasi restock bahan baku.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Cabang Dropdown */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-2 shadow-xs">
              <Store className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col items-start justify-center min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
                  Cabang
                </span>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="p-0 m-0 pl-0 bg-transparent appearance-none leading-tight font-semibold text-sm text-foreground focus:outline-none cursor-pointer mt-0.5"
                >
                  <option value="all">Semua Cabang ({outletsList.length})</option>
                  {outletsList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 self-center pointer-events-none" />
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-2 shadow-xs">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col items-start justify-center min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
                  Periode
                </span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                  className="p-0 m-0 pl-0 bg-transparent appearance-none leading-tight font-semibold text-sm text-foreground focus:outline-none cursor-pointer mt-0.5"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="today">Hari Ini</option>
                  <option value="last_7_days">7 Hari Terakhir</option>
                  <option value="this_month">Bulan Ini</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 self-center pointer-events-none" />
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
                <span className="text-muted-foreground text-xs font-bold">-</span>
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
          <Sparkles className="w-4 h-4 text-foreground/70" />
          <span>Rekomendasi Cerdas AI</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      rec.priority === "high"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-muted text-foreground/80"
                    }`}
                  >
                    Prioritas {rec.priority}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground capitalize">
                    {rec.type}
                  </span>
                </div>
                <h3 className="text-sm font-black text-foreground">{rec.title}</h3>
                <p className="text-xs leading-5 text-muted-foreground">{rec.description}</p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                  <Sparkles className="size-3.5 shrink-0 text-foreground/60" />
                  <span>{rec.impact}</span>
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
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">Trend Omzet Harian &amp; Prediksi AI</h2>
            <p className="text-xs text-muted-foreground">
              {dateRange === "custom" && !startDate && !endDate
                ? "Pilih tanggal mulai dan tanggal akhir pada Custom Range untuk menampilkan perbandingan aktual dan proyeksi"
                : dateRange === "today"
                  ? "Perbandingan penjualan aktual hari ini dengan proyeksi target cerdas"
                  : dateRange === "this_month"
                    ? "Perbandingan penjualan aktual bulan ini dengan proyeksi target cerdas"
                    : dateRange === "all"
                      ? "Perbandingan penjualan aktual semua waktu dengan proyeksi target cerdas"
                      : dateRange === "custom"
                        ? `Perbandingan penjualan aktual (${startDate || "Awal"} s/d ${endDate || "Akhir"}) dengan proyeksi target cerdas`
                        : "Perbandingan penjualan aktual 7 hari terakhir dengan proyeksi target cerdas"}
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            {dateRange === "custom" && !startDate && !endDate ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                <Calendar className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Rentang tanggal Custom Range belum dipilih
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Isi tanggal mulai dan tanggal akhir di atas untuk memuat grafik transaksi dan proyeksi AI.
                </p>
              </div>
            ) : !hasDailySalesData ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Belum ada transaksi pada periode terpilih
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Grafik trend omzet harian dan proyeksi akan muncul otomatis setelah transaksi tercatat.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aktualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="prediksiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    domain={[0, "auto"]}
                    allowDecimals={false}
                    allowDataOverflow={false}
                    tickFormatter={(val) => {
                      const num = Number(val) || 0;
                      if (num === 0) return "Rp 0";
                      if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1).replace(/\.0$/, "")} Jt`;
                      if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}rb`;
                      return `Rp ${num}`;
                    }}
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
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    fill="url(#prediksiGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {hasDailySalesData && (
            <div className="flex items-center justify-center gap-6 text-xs pt-1">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-primary" /> Aktual
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-muted-foreground" /> Proyeksi AI
              </span>
            </div>
          )}
        </div>

        {/* Pola Jam Sibuk (Peak Hours) */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">Distribusi Jam Ramai</h2>
            <p className="text-xs text-muted-foreground">
              Volume order per jam operasional berdasarkan riwayat transaksi
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            {!hasPeakHoursData ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                <Clock className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Belum ada transaksi pada periode terpilih
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Distribusi jam sibuk akan tampil otomatis setelah ada pesanan masuk di kasir.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="hour" fontSize={11} />
                  <YAxis fontSize={12} domain={[0, "auto"]} allowDecimals={false} />
                  <ChartTooltip formatter={(val: any) => [`${val} Order`, "Volume Transaksi"]} />
                  <Bar dataKey="orders" fill="var(--primary)" maxBarSize={48} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {hasPeakHoursData && (
            <p className="text-center text-xs text-muted-foreground">
              Distribusi volume order berdasarkan waktu transaksi aktual pada periode terpilih.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
