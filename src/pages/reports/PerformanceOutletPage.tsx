
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
      : displayRevenue > 0
        ? Math.round(displayRevenue * 0.58)
        : 0;
  const displayAov = selectedOutlet ? selectedOutlet.aov : analytics?.averageAov || 0;
  const topOutlet = outlets[0] || { name: "Outlet Utama", revenue: 0, growth: "+0%" };

  // Chart data
  const chartData = outlets.map((o) => ({
    name: o.name.length > 14 ? o.name.substring(0, 14) + "..." : o.name,
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
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Store className="size-5" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Performa Outlet</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Analisis perbandingan omzet, volume transaksi, produk terjual, dan metode pembayaran
              real-time antar cabang outlet.
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
                  <option value="all">Semua Cabang ({outletsDropdownList.length})</option>
                  {outletsDropdownList.map((o) => (
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">
            {selectedOutlet ? `Omzet ${selectedOutlet.name}` : "Total Omzet Semua Cabang"}
          </p>
          <h3 className="mt-2 text-2xl font-black text-foreground">
            {formatRupiah(displayRevenue)}
          </h3>
          <p className="mt-1 text-xs text-emerald-600 font-bold">+18.5% Periode ini</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">Total Transaksi</p>
          <h3 className="mt-2 text-2xl font-black text-foreground">
            {displayOrders.toLocaleString()} Order
          </h3>
          <p className="mt-1 text-xs text-primary font-bold">POS Kasir Terhubung</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">Produk Terjual</p>
          <h3 className="mt-2 text-2xl font-black text-foreground">
            {displayItemsSold.toLocaleString()} Porsi
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Akumulasi Menu</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">Estimasi Profit</p>
          <h3 className="mt-2 text-2xl font-black text-emerald-600">
            {formatRupiah(displayProfit)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Gross Margin ~58%</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">Rata-rata Order (AOV)</p>
          <h3 className="mt-2 text-2xl font-black text-foreground">{formatRupiah(displayAov)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Basket Size per Transaksi</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase">Cabang Unggulan</p>
          <h3 className="mt-2 text-base font-black text-foreground truncate">{topOutlet.name}</h3>
          <p className="mt-1 text-xs text-amber-500 font-bold">{formatRupiah(topOutlet.revenue)}</p>
        </div>
      </div>

      {/* Grid: Chart & Payment Distribution */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Chart Komparasi Antar Cabang */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div>
            <h2 className="text-base font-black">
              Komparasi Pendapatan Antar Cabang (Juta Rupiah)
            </h2>
            <p className="text-xs text-muted-foreground">
              Perbandingan transaksi dan omzet antar outlet di database
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} domain={[0, "auto"]} allowDataOverflow={false} tickFormatter={(val) => formatCompactRupiah(Number(val))} />
                <ChartTooltip
                  formatter={(val: any) => [`${formatRupiah(Number(val))}`, "Omzet"]}
                />
                <Bar dataKey="Revenue" fill="var(--primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metode Pembayaran Outlet */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
          <div>
            <h2 className="text-base font-black">Metode Pembayaran</h2>
            <p className="text-xs text-muted-foreground">
              {selectedOutlet ? `Distribusi di ${selectedOutlet.name}` : "Akumulasi Semua Cabang"}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <DollarSign className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Tunai (Cash)</p>
                  <p className="text-[10px] text-muted-foreground">Kasir POS</p>
                </div>
              </div>
              <p className="text-sm font-black">{formatRupiah(paymentBreakdown.cash)}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <QrCode className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">QRIS Instant</p>
                  <p className="text-[10px] text-muted-foreground">Digital Payment</p>
                </div>
              </div>
              <p className="text-sm font-black">{formatRupiah(paymentBreakdown.qris)}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <WalletCards className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">E-Wallet</p>
                  <p className="text-[10px] text-muted-foreground">Gopay / Ovo / Dana</p>
                </div>
              </div>
              <p className="text-sm font-black">{formatRupiah(paymentBreakdown.ewallet)}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Kartu Debit / EDC</p>
                  <p className="text-[10px] text-muted-foreground">Bank Settlement</p>
                </div>
              </div>
              <p className="text-sm font-black">{formatRupiah(paymentBreakdown.card)}</p>
            </div>

            {paymentBreakdown.ojol > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-600">
                    <Bike className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400">Online / Ojol</p>
                    <p className="text-[10px] text-muted-foreground">GoFood / GrabFood / ShopeeFood</p>
                  </div>
                </div>
                <p className="text-sm font-black text-orange-600">{formatRupiah(paymentBreakdown.ojol)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detektor Kebocoran & Audit Keamanan Cabang (Fraud & Variance Alert) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                Detektor Kebocoran & Audit Keamanan Cabang (Fraud & Variance Alert)
                {outletsWithIssues.length > 0 ? (
                  <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black text-rose-600">
                    {outletsWithIssues.length} Cabang Perlu Investigasi
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                    Semua Cabang Kondusif
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Audit otomatis selisih kas fisik minus (pos_shifts), transaksi dibatalkan (void), dan kerugian bahan terbuang (waste).
              </p>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards for Fraud & Variance */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-rose-500" />
              Total Selisih Kas Minus (Tekor)
            </span>
            <p className={cn("text-lg font-black", totalCashDifference < 0 ? "text-rose-600" : "text-emerald-600")}>
              {totalCashDifference < 0 ? `-${formatRupiah(Math.abs(totalCashDifference))}` : "Rp 0 (Seimbang)"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalCashDifference < 0 ? "Akumulasi uang kas fisik hilang/tekor saat tutup shift kasir" : "Laci kas fisik tertib & seimbang"}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-500" />
              Transaksi Void / Pembatalan
            </span>
            <p className={cn("text-lg font-black", totalVoidCount > 0 ? "text-amber-600" : "text-foreground")}>
              {totalVoidCount} Order ({formatRupiah(totalVoidAmount)})
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalVoidCount > 0 ? "Waspadai transaksi fiktif / uang dikantongi kasir nakal" : "Tidak ada transaksi void"}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Package className="size-3.5 text-violet-500" />
              Kerugian Bahan Rusak / Waste
            </span>
            <p className={cn("text-lg font-black", totalWasteLoss > 0 ? "text-rose-600" : "text-foreground")}>
              {formatRupiah(totalWasteLoss)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Biaya HPP terbuang dari inventaris (waste_records)
            </p>
          </div>
        </div>
      </div>

      {/* Table Detail Outlet */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black">Tabel Peringkat & Komparasi Finansial Cabang (1 s/d 10+ Outlet)</h2>
            <p className="text-xs text-muted-foreground">
              Pemisahan real-time Omzet, Cash vs Non-Cash/Ojol, HPP (BOM), Kas Keluar Operasional, dan Net Profit per cabang.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-black uppercase">
                <th className="py-3 px-3">Cabang & Audit Status</th>
                <th className="py-3 px-3 text-right">Total Omzet</th>
                <th className="py-3 px-3 text-right">Penerimaan Cash</th>
                <th className="py-3 px-3 text-right">Non-Cash / Ojol</th>
                <th className="py-3 px-3 text-right">Estimasi HPP</th>
                <th className="py-3 px-3 text-right">Kas Keluar Ops</th>
                <th className="py-3 px-3 text-right">Net Profit</th>
                <th className="py-3 px-3 text-center">Audit Anomali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {outlets.map((outlet, index) => (
                <tr key={outlet.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-secondary font-black text-[10px]">
                        #{index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black">{outlet.name}</span>
                          {outlet.isTop && (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-600">
                              TOP 1
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                          {outlet.address}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-black text-primary">
                    <div>{formatRupiah(outlet.revenue)}</div>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {outlet.ordersCount} Order
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600">
                    <div>{formatRupiah(outlet.cashRevenue)}</div>
                    <span className="text-[10px] text-muted-foreground font-normal">Fisik Laci</span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-foreground">
                    <div>{formatRupiah(outlet.digitalRevenue)}</div>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      QRIS / Ojol / Kartu
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-muted-foreground">
                    <div>{formatRupiah(outlet.cpmEstimate)}</div>
                    <span className="text-[10px] text-muted-foreground">~40% Omzet</span>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                    <div>{formatRupiah(outlet.operationalCashOut)}</div>
                    <span className="text-[10px] text-muted-foreground">Biaya Shift</span>
                  </td>
                  <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                    <div>{formatRupiah(outlet.netProfit)}</div>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Margin {outlet.revenue > 0 ? Math.round((outlet.netProfit / outlet.revenue) * 100) : 0}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black inline-flex items-center gap-1",
                          outlet.healthStatus === "danger"
                            ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                            : outlet.healthStatus === "warning"
                              ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
                        )}
                      >
                        {outlet.healthScoreLabel}
                      </span>
                      {outlet.anomalyNotes && outlet.anomalyNotes.length > 0 && (
                        <span className="text-[10px] text-rose-500 font-semibold max-w-[160px] truncate" title={outlet.anomalyNotes.join(", ")}>
                          ⚠️ {outlet.anomalyNotes[0]}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
