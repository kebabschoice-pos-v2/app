import { useState, useEffect, useMemo, useCallback } from "react";
import {
  UtensilsCrossed,
  TrendingUp,
  Award,
  AlertTriangle,
  DollarSign,
  ArrowUpRight,
  Search,
  Filter,
  Package,
  Layers,
  Loader2,
  RefreshCw,
  Store,
  Calendar,
  Download,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getComprehensiveAnalytics,
  exportToCSV,
  type MenuPerformanceItem,
  type BusinessAnalyticsSummary,
  type DateRangePreset,
} from "@/services/reports.service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PerformanceMenuPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangePreset>("all");
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
      console.error("Failed to load menu analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, dateRange, startDate, endDate, outletsList.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const menuItems = analytics?.menuItems || [];

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === "all" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Aggregate Metrics
  const totalRevenue = useMemo(
    () => menuItems.reduce((acc, item) => acc + item.revenue, 0),
    [menuItems],
  );
  const totalSold = useMemo(
    () => menuItems.reduce((acc, item) => acc + item.soldCount, 0),
    [menuItems],
  );
  const bestSeller = useMemo(() => (menuItems.length > 0 ? menuItems[0] : null), [menuItems]);
  const lowestSeller = useMemo(() => {
    if (menuItems.length === 0) return null;
    return [...menuItems].reverse()[0];
  }, [menuItems]);

  const avgMargin = useMemo(() => {
    if (analytics?.marginPercentage && totalRevenue > 0) {
      return analytics.marginPercentage;
    }
    if (totalRevenue > 0 && menuItems.length > 0) {
      const totalProfit = menuItems.reduce(
        (acc, item) => acc + (item.soldCount > 0 ? Math.max(0, item.price - item.cost) * item.soldCount : 0),
        0,
      );
      return Math.round((totalProfit / totalRevenue) * 100);
    }
    if (menuItems.length === 0) return 0;
    const sum = menuItems.reduce((acc, item) => acc + item.margin, 0);
    return Math.round(sum / menuItems.length);
  }, [analytics?.marginPercentage, totalRevenue, menuItems]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set(menuItems.map((item) => item.category));
    return ["all", ...Array.from(set)];
  }, [menuItems]);

  // Chart Data Top 6 (nama menu utuh)
  const chartData = useMemo(() => {
    return [...menuItems].slice(0, 6).map((item) => ({
      name: item.name,
      Terjual: item.soldCount,
      Revenue: item.revenue / 1000000,
    }));
  }, [menuItems]);

  const handleExportCSV = () => {
    if (!analytics || filteredItems.length === 0) {
      toast.error("Tidak ada data menu untuk diekspor");
      return;
    }
    const headers = [
      "No",
      "Nama Menu",
      "Kategori",
      "Harga Jual",
      "HPP (Cost)",
      "Margin (%)",
      "Jumlah Terjual (Porsi)",
      "Total Revenue",
      "Status",
      "Recipe Items Count",
    ];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      item.name,
      item.category,
      formatRupiah(item.price),
      formatRupiah(item.cost),
      `${item.margin}%`,
      item.soldCount,
      formatRupiah(item.revenue),
      item.status,
      item.recipeItemsCount,
    ]);

    const dateLabel =
      dateRange === "today"
        ? "Hari_Ini"
        : dateRange === "last_7_days"
          ? "7_Hari_Terakhir"
          : dateRange === "this_month"
            ? "Bulan_Ini"
            : `${startDate || "Awal"}_sd_${endDate || "Akhir"}`;

    const filename = `Laporan_Performa_Menu_${dateLabel}_${new Date().toISOString().split("T")[0]}`;
    const success = exportToCSV(filename, headers, rows);
    if (success) {
      toast.success("Laporan performa menu berhasil diekspor ke CSV!");
    } else {
      toast.error("Gagal mengekspor laporan CSV.");
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">
            Memuat performa menu & Recipe BOM...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/70">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <h1 className="text-3xl font-black tracking-normal">Performa Menu</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Analisis performa penjualan, margin resep, menu terlaris, dan pergerakan produk per cabang.
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
              disabled={loading || filteredItems.length === 0}
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
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Menu Revenue */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground leading-snug">Total Omzet Menu</p>
            <div className="w-8 h-8 shrink-0 rounded-xl bg-muted flex items-center justify-center text-foreground/70">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="mt-2.5 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {formatRupiah(totalRevenue)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{totalSold} porsi menu terjual</p>
        </div>

        {/* Best Seller */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground leading-snug">
              Menu Terlaris (Rank 1)
            </p>
            <div className="w-8 h-8 shrink-0 rounded-xl bg-muted flex items-center justify-center text-foreground/70">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <h3 className="mt-2.5 text-base font-bold text-foreground leading-snug">
            {bestSeller ? bestSeller.name : "-"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-semibold whitespace-nowrap">
            {bestSeller
              ? `${bestSeller.soldCount} porsi (${formatRupiah(bestSeller.revenue)})`
              : "-"}
          </p>
        </div>

        {/* Slow Moving */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground leading-snug">Menu Terendah</p>
            <div className="w-8 h-8 shrink-0 rounded-xl bg-muted flex items-center justify-center text-foreground/70">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="mt-2.5 text-base font-bold text-foreground leading-snug">
            {lowestSeller ? lowestSeller.name : "-"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground font-semibold whitespace-nowrap">
            {lowestSeller ? `${lowestSeller.soldCount} porsi (${lowestSeller.growth})` : "-"}
          </p>
        </div>

        {/* Avg Margin */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground leading-snug">
              Rata-rata Margin Resep
            </p>
            <div className="w-8 h-8 shrink-0 rounded-xl bg-muted flex items-center justify-center text-foreground/70">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="mt-2.5 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {avgMargin}%
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Berdasarkan kalkulasi HPP resep</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-black text-foreground">Menu Paling Populer (Volume Penjualan)</h2>
          <p className="text-xs text-muted-foreground">
            Jumlah porsi produk terjual pada periode terpilih
          </p>
        </div>

        <div className="h-64 w-full pt-2">
          {!chartData.some((c) => (Number(c.Terjual) || 0) > 0) ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <UtensilsCrossed className="w-5 h-5 text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground">
                Belum ada transaksi pada periode terpilih
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Grafik volume penjualan menu akan tampil otomatis setelah ada pesanan.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} interval={0} />
                <YAxis fontSize={12} domain={[0, "auto"]} allowDecimals={false} />
                <ChartTooltip
                  formatter={(val: any, name: string) => [
                    name === "Revenue" ? `${formatRupiah(Number(val) * 1000000)}` : `${val} porsi`,
                    name === "Revenue" ? "Omzet" : "Terjual",
                  ]}
                />
                <Bar dataKey="Terjual" fill="var(--primary)" maxBarSize={48} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">Detail Performa per Menu</h2>
            <p className="text-xs text-muted-foreground">
              Ringkasan harga jual, HPP bahan baku, margin, volume terjual, dan total pendapatan per menu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-48">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat === "all" ? "Semua" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-black uppercase">
                <th className="py-2.5 px-3">Nama Menu</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Harga Jual</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">HPP (Cost)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Margin (%)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Terjual</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Revenue</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                  Recipe BOM
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-black text-xs">
                        #{index + 1}
                      </span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-foreground tabular-nums whitespace-nowrap">
                    {formatRupiah(item.price)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-normal text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatRupiah(item.cost)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                      item.margin < 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {item.margin}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {item.soldCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                    {formatRupiah(item.revenue)}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {item.status === "best_seller" ? (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        Best Seller
                      </span>
                    ) : item.status === "growth" ? (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                        Growth
                      </span>
                    ) : item.status === "slow_moving" ? (
                      <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                        Slow Moving
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Normal
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                    {item.recipeItemsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <Package className="size-3.5 text-muted-foreground" /> {item.recipeItemsCount} Bahan
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standar 40%</span>
                    )}
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
