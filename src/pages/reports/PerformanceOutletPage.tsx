
function formatCompactRupiah(num: number): string {
  if (!num || num === 0) return "Rp 0";
  if (num >= 1000000000) return `Rp ${(num / 1000000000).toFixed(1).replace(/\.0$/, "")} M`;
  if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1).replace(/\.0$/, "")} Jt`;
  if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}rb`;
  return `Rp ${num}`;
}
import { useState, useEffect, useCallback } from "react";
import {
  Store,
  TrendingUp,
  MapPin,
  Clock,
  DollarSign,
  Receipt,
  Award,
  ArrowUpRight,
  Package,
  CreditCard,
  QrCode,
  WalletCards,
  Loader2,
  RefreshCw,
  Download,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Bike,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
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
  type OutletMetric,
  type BusinessAnalyticsSummary,
  type DateRangePreset,
} from "@/services/reports.service";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PerformanceOutletPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsSummary | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangePreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [allOutletsList, setAllOutletsList] = useState<{ id: string; name: string }[]>([]);

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
        // Fetch list of all outlets for filter dropdown if not yet populated
        if (allOutletsList.length === 0) {
          const { data: oList } = await supabase
            .from("outlets")
            .select("id, name")
            .eq("business_id", bId)
            .order("name", { ascending: true });
          if (oList && oList.length > 0) {
            setAllOutletsList(oList);
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
      console.error("Failed to load outlet analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, dateRange, startDate, endDate, allOutletsList.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !analytics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">
            Memuat data analitik outlet real-time...
          </p>
        </div>
      </div>
    );
  }

  const outlets = analytics?.outlets || [];
  const selectedOutlet =
    selectedOutletId === "all" ? null : outlets.find((o) => o.id === selectedOutletId);

  // Compute metrics based on filter
  const displayRevenue = selectedOutlet ? selectedOutlet.revenue : analytics?.totalRevenue || 0;
  const displayOrders = selectedOutlet ? selectedOutlet.ordersCount : analytics?.totalOrders || 0;
  const rawItemsSold = selectedOutlet
    ? selectedOutlet.itemsSold
    : analytics?.totalItemsSold || 0;
  const displayItemsSold =
    rawItemsSold > 0 ? rawItemsSold : displayOrders > 0 ? displayOrders : 0;
  const rawProfit = selectedOutlet
    ? selectedOutlet.profitEstimate
    : analytics?.totalProfitEstimate || 0;
  const displayProfit =
    rawProfit > 0
      ? rawProfit
      : displayRevenue > 0 && !selectedOutlet
        ? analytics?.totalProfitEstimate || 0
        : 0;
  const displayMarginPct =
    displayRevenue > 0
      ? Math.round((displayProfit / displayRevenue) * 100)
      : analytics?.marginPercentage || 0;
  const displayAov = selectedOutlet ? selectedOutlet.aov : analytics?.averageAov || 0;
  const topOutlet = outlets[0] || { name: "Outlet Utama", revenue: 0, growth: "+0%" };

  // Chart data (nama cabang utuh tanpa terpotong)
  const chartData = outlets.map((o) => ({
    name: o.name,
    Revenue: o.revenue,
    Orders: o.ordersCount,
  }));

  // Payment methods breakdown for active selection
  const paymentBreakdown = selectedOutlet
    ? {
        ...selectedOutlet.paymentMethods,
        ojol: selectedOutlet.paymentMethods.ojol || 0,
      }
    : outlets.reduce(
        (acc, o) => {
          acc.cash += o.paymentMethods.cash;
          acc.qris += o.paymentMethods.qris;
          acc.ewallet += o.paymentMethods.ewallet;
          acc.card += o.paymentMethods.card;
          acc.ojol += o.paymentMethods.ojol || 0;
          return acc;
        },
        { cash: 0, qris: 0, ewallet: 0, card: 0, ojol: 0 },
      );

  // Aggregated Fraud & Variance Audit Stats
  const totalVoidCount = outlets.reduce((sum, o) => sum + (o.voidCount || 0), 0);
  const totalVoidAmount = outlets.reduce((sum, o) => sum + (o.voidAmount || 0), 0);
  const totalCashDifference = outlets.reduce((sum, o) => sum + (o.cashDifference || 0), 0);
  const totalWasteLoss = outlets.reduce((sum, o) => sum + (o.wasteLoss || 0), 0);
  const totalOperationalCashOut = outlets.reduce(
    (sum, o) => sum + (o.operationalCashOut || 0),
    0,
  );
  const totalNetProfit = outlets.reduce((sum, o) => sum + (o.netProfit || 0), 0);
  const outletsWithIssues = outlets.filter(
    (o) => o.healthStatus === "danger" || o.healthStatus === "warning",
  );

  const handleExportCSV = () => {
    if (!analytics || outlets.length === 0) {
      toast.error("Tidak ada data outlet untuk diekspor");
      return;
    }
    const headers = [
      "No",
      "Nama Outlet",
      "Kode Cabang",
      "Alamat Cabang",
      "Total Transaksi",
      "Total Omzet",
      "Penerimaan Tunai (Cash)",
      "Penerimaan Non-Tunai / Ojol",
      "Estimasi HPP (Food Cost)",
      "Kas Keluar Operasional",
      "Net Profit Cabang",
      "Status Audit Keamanan",
      "Selisih Kas Fisik",
      "Transaksi Void / Batal",
      "Nominal Void",
      "Kerugian Waste Bahan",
      "Jam Sibuk",
    ];

    const rows = outlets.map((o, idx) => [
      idx + 1,
      o.name,
      o.code,
      o.address,
      o.ordersCount,
      formatRupiah(o.revenue),
      formatRupiah(o.cashRevenue),
      formatRupiah(o.digitalRevenue),
      formatRupiah(o.cpmEstimate),
      formatRupiah(o.operationalCashOut),
      formatRupiah(o.netProfit),
      o.healthScoreLabel,
      formatRupiah(o.cashDifference),
      o.voidCount,
      formatRupiah(o.voidAmount),
      formatRupiah(o.wasteLoss),
      o.peakTime,
    ]);

    const dateLabel =
      dateRange === "today"
        ? "Hari_Ini"
        : dateRange === "last_7_days"
          ? "7_Hari_Terakhir"
          : dateRange === "this_month"
            ? "Bulan_Ini"
            : `${startDate || "Awal"}_sd_${endDate || "Akhir"}`;

    const filename = `Laporan_Performa_Outlet_${dateLabel}_${new Date().toISOString().split("T")[0]}`;
    const success = exportToCSV(filename, headers, rows);
    if (success) {
      toast.success("Laporan performa outlet & deteksi kebocoran berhasil diekspor ke CSV!");
    } else {
      toast.error("Gagal mengekspor laporan CSV.");
    }
  };

  const outletsDropdownList = allOutletsList.length > 0 ? allOutletsList : outlets;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/70">
                <Store className="w-4 h-4" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Performa Outlet</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Analisis perbandingan omzet, volume transaksi, produk terjual, dan metode pembayaran
              antar cabang outlet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Cabang Dropdown */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 shadow-xs">
              <Store className="w-4 h-4 text-foreground/70 shrink-0" />
              <div className="text-xs">
                <span className="block text-xs font-bold text-muted-foreground uppercase">
                  Cabang
                </span>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="bg-transparent font-black text-foreground focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">Semua Cabang ({outletsDropdownList.length})</option>
                  {outletsDropdownList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 shadow-xs">
              <Calendar className="w-4 h-4 text-foreground/70 shrink-0" />
              <div className="text-xs">
                <span className="block text-xs font-bold text-muted-foreground uppercase">
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
              disabled={loading || outlets.length === 0}
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
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">
            {selectedOutlet ? `Omzet ${selectedOutlet.name}` : "Total Omzet Semua Cabang"}
          </p>
          <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {formatRupiah(displayRevenue)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            {displayOrders.toLocaleString()} transaksi lunas
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">Total Transaksi</p>
          <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {displayOrders.toLocaleString()} Order
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">POS Kasir Terhubung</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">Produk Terjual</p>
          <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {displayItemsSold.toLocaleString()} Porsi
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Akumulasi Menu</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">Estimasi Profit</p>
          <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {formatRupiah(displayProfit)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            Gross Margin {displayMarginPct}%
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">Rata-rata Order (AOV)</p>
          <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {formatRupiah(displayAov)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Nilai rata-rata per struk</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground leading-snug">Cabang Unggulan</p>
          <h3 className="mt-2 text-base font-bold text-foreground leading-snug">{topOutlet.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground font-semibold whitespace-nowrap">
            {formatRupiah(topOutlet.revenue)}
          </p>
        </div>
      </div>

      {/* Grid: Chart & Payment Distribution */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Chart Pendapatan per Cabang */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">Pendapatan per Cabang</h2>
            <p className="text-xs text-muted-foreground">
              Perbandingan omzet antar cabang pada periode terpilih
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} interval={0} />
                <YAxis
                  fontSize={12}
                  domain={[0, "auto"]}
                  allowDataOverflow={false}
                  tickFormatter={(val) => formatCompactRupiah(Number(val))}
                />
                <ChartTooltip
                  formatter={(val: any) => [`${formatRupiah(Number(val))}`, "Omzet"]}
                />
                <Bar
                  dataKey="Revenue"
                  fill="var(--primary)"
                  maxBarSize={48}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metode Pembayaran Outlet */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">Metode Pembayaran</h2>
            <p className="text-xs text-muted-foreground">
              {selectedOutlet ? `Distribusi di ${selectedOutlet.name}` : "Akumulasi Semua Cabang"}
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Tunai (Cash)</p>
                  <p className="text-xs text-muted-foreground">Kasir POS</p>
                </div>
              </div>
              <p className="text-sm font-black text-foreground whitespace-nowrap">
                {formatRupiah(paymentBreakdown.cash)}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">QRIS</p>
                  <p className="text-xs text-muted-foreground">Pembayaran Digital</p>
                </div>
              </div>
              <p className="text-sm font-black text-foreground whitespace-nowrap">
                {formatRupiah(paymentBreakdown.qris)}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
                  <WalletCards className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">E-Wallet</p>
                  <p className="text-xs text-muted-foreground">GoPay / OVO / DANA</p>
                </div>
              </div>
              <p className="text-sm font-black text-foreground whitespace-nowrap">
                {formatRupiah(paymentBreakdown.ewallet)}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Kartu Debit / EDC</p>
                  <p className="text-xs text-muted-foreground">Settlement Bank</p>
                </div>
              </div>
              <p className="text-sm font-black text-foreground whitespace-nowrap">
                {formatRupiah(paymentBreakdown.card)}
              </p>
            </div>

            {paymentBreakdown.ojol > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Online / Ojol</p>
                    <p className="text-xs text-muted-foreground">GoFood / GrabFood / ShopeeFood</p>
                  </div>
                </div>
                <p className="text-sm font-black text-foreground whitespace-nowrap">
                  {formatRupiah(paymentBreakdown.ojol)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Operasional Cabang */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/70">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-foreground">Audit Operasional Cabang</h2>
                {outletsWithIssues.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    {outletsWithIssues.length} Cabang Perlu Ditinjau
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-bold text-foreground/80">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Semua Cabang Normal
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pantauan otomatis selisih kas fisik, pesanan dibatalkan, dan kerugian bahan terbuang di setiap cabang.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards — Monokrom Netral (Merah hanya jika benar-benar bermasalah) */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground/70">
                <DollarSign className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-muted-foreground">Selisih Kas</span>
            </div>
            <p
              className={cn(
                "text-lg font-bold tracking-tight whitespace-nowrap",
                totalCashDifference < 0 ? "text-rose-600" : "text-foreground",
              )}
            >
              {totalCashDifference < 0
                ? `-${formatRupiah(Math.abs(totalCashDifference))}`
                : "Rp 0 (Seimbang)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalCashDifference < 0
                ? "Akumulasi selisih kas minus saat tutup shift"
                : "Laci kas fisik tertib dan seimbang"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground/70">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-muted-foreground">Pesanan Dibatalkan</span>
            </div>
            <p
              className={cn(
                "text-lg font-bold tracking-tight whitespace-nowrap",
                totalVoidCount > 0 ? "text-rose-600" : "text-foreground",
              )}
            >
              {totalVoidCount} Order ({formatRupiah(totalVoidAmount)})
            </p>
            <p className="text-xs text-muted-foreground">
              {totalVoidCount > 0
                ? "Terdapat pembatalan pesanan yang perlu ditinjau"
                : "Tidak ada pesanan dibatalkan"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground/70">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-muted-foreground">Bahan Terbuang</span>
            </div>
            <p
              className={cn(
                "text-lg font-bold tracking-tight whitespace-nowrap",
                totalWasteLoss > 0 ? "text-rose-600" : "text-foreground",
              )}
            >
              {formatRupiah(totalWasteLoss)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalWasteLoss > 0
                ? "Total nilai bahan baku rusak atau kedaluwarsa"
                : "Tidak ada kerugian bahan terbuang"}
            </p>
          </div>
        </div>
      </div>

      {/* Table Detail Outlet */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-foreground">Ringkasan Keuangan per Cabang</h2>
            <p className="text-xs text-muted-foreground">
              Perbandingan omzet, penerimaan tunai, non-tunai, HPP, biaya operasional, dan laba bersih setiap cabang.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-black uppercase">
                <th className="py-2.5 px-3">Cabang</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Omzet</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Penerimaan Tunai</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Non-Tunai / Ojol</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Estimasi HPP</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Kas Keluar Ops</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Laba Bersih</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                  Status Audit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {outlets.map((outlet, index) => {
                const actualHppPct =
                  outlet.revenue > 0 ? Math.round((outlet.cpmEstimate / outlet.revenue) * 100) : 0;
                const actualMarginPct =
                  outlet.revenue > 0 ? Math.round((outlet.netProfit / outlet.revenue) * 100) : 0;
                return (
                  <tr key={outlet.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-xs text-foreground/70">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold whitespace-nowrap">{outlet.name}</span>
                            {outlet.isTop && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary whitespace-nowrap">
                                Terbaik
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-normal block">
                            {outlet.address}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                      <div>{formatRupiah(outlet.revenue)}</div>
                      <span className="text-xs text-muted-foreground font-normal">
                        {outlet.ordersCount} Order
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground whitespace-nowrap">
                      <div>{formatRupiah(outlet.cashRevenue)}</div>
                      <span className="text-xs text-muted-foreground font-normal">Fisik Laci</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground whitespace-nowrap">
                      <div>{formatRupiah(outlet.digitalRevenue)}</div>
                      <span className="text-xs text-muted-foreground font-normal">
                        QRIS / Ojol / Kartu
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">
                      <div>{formatRupiah(outlet.cpmEstimate)}</div>
                      <span className="text-xs text-muted-foreground font-normal">
                        {actualHppPct}% Omzet
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-semibold whitespace-nowrap",
                        outlet.operationalCashOut > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <div>{formatRupiah(outlet.operationalCashOut)}</div>
                      <span className="text-xs text-muted-foreground font-normal">Biaya Shift</span>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-bold whitespace-nowrap",
                        outlet.netProfit < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground",
                      )}
                    >
                      <div>{formatRupiah(outlet.netProfit)}</div>
                      <span className="text-xs text-muted-foreground font-normal">
                        Margin {actualMarginPct}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap",
                            outlet.healthStatus === "danger"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                              : outlet.healthStatus === "warning"
                                ? "bg-muted text-foreground border border-border"
                                : "bg-muted text-foreground/80 border border-border/60",
                          )}
                        >
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full inline-block",
                              outlet.healthStatus === "danger"
                                ? "bg-rose-500"
                                : outlet.healthStatus === "warning"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                          {outlet.healthScoreLabel}
                        </span>
                        {outlet.anomalyNotes && outlet.anomalyNotes.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-rose-600 font-semibold"
                            title={outlet.anomalyNotes.join(", ")}
                          >
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>{outlet.anomalyNotes[0]}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
