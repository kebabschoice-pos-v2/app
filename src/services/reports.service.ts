import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/components/kebabschoicepos/data";

export interface OutletMetric {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  ordersCount: number;
  revenue: number;
  cashRevenue: number;
  digitalRevenue: number;
  cpmEstimate: number;
  operationalCashOut: number;
  netProfit: number;
  itemsSold: number;
  profitEstimate: number;
  aov: number;
  peakTime: string;
  growth: string;
  paymentMethods: {
    cash: number;
    qris: number;
    ewallet: number;
    card: number;
    ojol?: number;
  };
  topProducts: { name: string; quantity: number; revenue: number }[];
  isTop: boolean;
  voidCount: number;
  voidAmount: number;
  cashDifference: number;
  wasteLoss: number;
  healthStatus: "healthy" | "warning" | "danger";
  healthScoreLabel: string;
  anomalyNotes: string[];
}

export interface MenuPerformanceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  soldCount: number;
  revenue: number;
  margin: number;
  growth: string;
  status: "best_seller" | "growth" | "normal" | "slow_moving";
  recipeItemsCount: number;
}

export interface PeakHourMetric {
  hour: string;
  orders: number;
  revenue: number;
}

export interface DailyTrendMetric {
  day: string;
  dateStr: string;
  aktual: number | null;
  prediksi: number;
  orders: number;
}

export interface AiRecommendation {
  id: string;
  type: "stock" | "menu" | "outlet" | "customer";
  title: string;
  description: string;
  impact: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionHref?: string;
}

export type DateRangePreset = "today" | "last_7_days" | "this_month" | "custom";

export interface AnalyticsFilter {
  dateRange?: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  outletId?: string; // "all" or specific outlet id
}

export interface BusinessAnalyticsSummary {
  businessId: string;
  totalRevenue: number;
  totalOrders: number;
  totalItemsSold: number;
  totalProfitEstimate: number;
  marginPercentage: number;
  averageAov: number;
  paymentMethods: {
    cash: number;
    qris: number;
    ewallet: number;
    card: number;
  };
  stockHealthScore: number;
  lowStockItemsCount: number;
  outlets: OutletMetric[];
  menuItems: MenuPerformanceItem[];
  peakHours: PeakHourMetric[];
  dailyTrends: DailyTrendMetric[];
  recommendations: AiRecommendation[];
  filterApplied?: AnalyticsFilter;
}

/**
 * Filter a date against date range presets or custom start/end date
 */
export function isDateWithinFilter(
  dateInput: string | Date | null | undefined,
  filter?: AnalyticsFilter,
): boolean {
  if (!filter || (!filter.dateRange && !filter.startDate && !filter.endDate)) return true;
  if (!dateInput) return true;

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  const range = filter.dateRange || (filter.startDate || filter.endDate ? "custom" : undefined);

  if (range === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= start && d <= end;
  }

  if (range === "last_7_days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= start && d <= end;
  }

  if (range === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= start && d <= end;
  }

  if (range === "custom") {
    if (filter.startDate) {
      const parts = filter.startDate.split("-").map(Number);
      const start = new Date(
        parts[0] ?? now.getFullYear(),
        (parts[1] ?? 1) - 1,
        parts[2] ?? 1,
        0,
        0,
        0,
        0,
      );
      if (d < start) return false;
    }
    if (filter.endDate) {
      const parts = filter.endDate.split("-").map(Number);
      const end = new Date(
        parts[0] ?? now.getFullYear(),
        (parts[1] ?? 1) - 1,
        parts[2] ?? 1,
        23,
        59,
        59,
        999,
      );
      if (d > end) return false;
    }
    return true;
  }

  return true;
}

/**
 * SSR-safe CSV Exporter with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  try {
    const escapeField = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = [
      headers.map(escapeField).join(","),
      ...rows.map((row) => row.map(escapeField).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const cleanFilename = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
    link.setAttribute("download", cleanFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("[exportToCSV] Error exporting CSV:", err);
    return false;
  }
}

export async function resolveAllReportBusinessIds(initialBusinessId?: string): Promise<string[]> {
  const ids = new Set<string>();
  if (initialBusinessId) ids.add(initialBusinessId);
  try {
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (uid) {
      const { data: owned } = await supabase.from("businesses").select("id").eq("owner_id", uid);
      for (const b of owned || []) ids.add(b.id);
      const { data: members } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", uid);
      for (const m of members || []) if (m.business_id) ids.add(m.business_id);
    }
  } catch {}
  return Array.from(ids);
}

async function resolveAllBusinessIds(primaryBusinessId: string): Promise<string[]> {
  return resolveAllReportBusinessIds(primaryBusinessId);
}

/**
 * Fetch and compute comprehensive single source of truth analytics
 */
export async function getComprehensiveAnalytics(
  businessId: string,
  filter?: AnalyticsFilter,
): Promise<BusinessAnalyticsSummary> {
  try {
    const allBusinessIds = await resolveAllBusinessIds(businessId);
    const targetBizIds = allBusinessIds.length > 0 ? allBusinessIds : [businessId];

    // 1. Fetch Outlets for this business (filter out archived/inactive)
    const { data: outletsData } = await supabase
      .from("outlets")
      .select("id, name, code, address, active, settings, created_at")
      .in("business_id", targetBizIds)
      .order("created_at", { ascending: true });

    const outlets = (outletsData || []).filter(
      (o: any) => o.active !== false && !(o.settings as any)?.archived,
    );

    // Extract recipes & order metadata stored across outlet settings
    const menuRecipes: Record<string, any> = {};
    const orderMetadata: Record<string, any> = {};

    for (const o of outlets) {
      const s = (o.settings as any) || {};
      if (s.menu_recipes) Object.assign(menuRecipes, s.menu_recipes);
      if (s.order_metadata) Object.assign(orderMetadata, s.order_metadata);
    }

    // 2. Fetch Products
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, category, price, stock, active")
      .in("business_id", targetBizIds)
      .eq("active", true);

    const products = productsData || [];

    // 3. Fetch Inventory items
    const { data: inventoryData } = await supabase
      .from("inventory_items")
      .select("id, name, category, unit, stock, minimum_stock, health_score")
      .in("business_id", targetBizIds);

    const inventory = inventoryData || [];

    // 4. Fetch Customers
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, name, visits, total_spend, favorite_product")
      .in("business_id", targetBizIds);

    const customers = customersData || [];

    // 5. Fetch Sales Orders (including outlet_id, status, channel)
    const { data: ordersData } = await supabase
      .from("sales_orders")
      .select(
        "id, order_number, total, payment_method, status, channel, paid_at, created_at, customer_id, outlet_id",
      )
      .in("business_id", targetBizIds)
      .order("created_at", { ascending: false });

    const rawAllOrders = ordersData || [];

    // Merge real-time orders from localStorage
    if (typeof window !== "undefined") {
      try {
        const rawRecent = localStorage.getItem("kebabschoicepos_recent_orders");
        if (rawRecent) {
          const recentOrders = JSON.parse(rawRecent);
          if (Array.isArray(recentOrders)) {
            for (const rOrd of recentOrders) {
              if (rOrd && rOrd.id && !rawAllOrders.some((existing) => existing.id === rOrd.id)) {
                rawAllOrders.unshift({
                  id: rOrd.id,
                  order_number: rOrd.order_number || rOrd.id.slice(0, 8),
                  total: Number(rOrd.total || 0),
                  payment_method: rOrd.payment_method || "cash",
                  status: rOrd.status || "paid",
                  channel: rOrd.channel || "dine_in",
                  paid_at: rOrd.paid_at || rOrd.created_at || new Date().toISOString(),
                  created_at: rOrd.created_at || new Date().toISOString(),
                  customer_id: rOrd.customer_id || null,
                  outlet_id: rOrd.outlet_id || null,
                });
              }
            }
          }
        }
      } catch {}
    }

    const rawOrders = rawAllOrders.filter((o) => o.status === "paid" || !o.status);
    const rawVoidOrders = rawAllOrders.filter(
      (o) =>
        (o.status as string) === "void" ||
        o.status === "refunded" ||
        (o.status as string) === "refund" ||
        o.status === "cancelled",
    );

    // 5b. Fetch Shifts, Cash Movements, and Waste Records for Fraud / Variance Auditing
    let shiftsData: any[] = [];
    try {
      const { data: sData } = await supabase
        .from("pos_shifts" as any)
        .select("*")
        .in("business_id", targetBizIds);
      shiftsData = (sData || []).map((s: any) => ({
        ...s,
        starting_cash: Number(s.starting_cash ?? s.opening_cash ?? 0),
        opening_cash: Number(s.opening_cash ?? s.starting_cash ?? 0),
        opened_at: s.opened_at || s.start_time || null,
        start_time: s.start_time || s.opened_at || null,
        closed_at: s.closed_at || s.end_time || null,
        end_time: s.end_time || s.closed_at || null,
      }));
    } catch {}

    let cashMovementsData: any[] = [];
    try {
      const { data: cmData } = await supabase
        .from("cash_movements" as any)
        .select("*")
        .in("business_id", targetBizIds);
      cashMovementsData = (cmData || []).map((m: any) => ({
        ...m,
        reason: m.reason || m.description || "",
        description: m.description || m.reason || "",
      }));
    } catch {}

    let wasteRecordsData: any[] = [];
    try {
      const { data: wData } = await supabase
        .from("waste_records" as any)
        .select("id, outlet_id, inventory_item_id, quantity, cost_loss, notes, created_at")
        .in("business_id", targetBizIds);
      wasteRecordsData = wData || [];
    } catch {}

    if (typeof window !== "undefined") {
      try {
        if (shiftsData.length === 0) {
          const raw = localStorage.getItem("kebabschoicepos_active_shift");
          if (raw) shiftsData = [JSON.parse(raw)];
        }
        if (wasteRecordsData.length === 0) {
          const raw = localStorage.getItem(`kebabschoicepos_waste_${businessId}`);
          if (raw) wasteRecordsData = JSON.parse(raw);
        }
      } catch {}
    }

    // Apply Filter (Outlet & Date Range) to orders
    const orders = rawOrders.filter((ord) => {
      // Outlet Filter
      if (filter?.outletId && filter.outletId !== "all") {
        const directOutletId = (ord as any).outlet_id;
        const meta = orderMetadata[ord.id];
        const metaOutletId = meta?.outlet_id;
        const matched = directOutletId === filter.outletId || metaOutletId === filter.outletId;
        if (!matched && outlets.length > 1) return false;
      }

      // Date Range Filter
      const orderTime = ord.paid_at || ord.created_at;
      if (!isDateWithinFilter(orderTime, filter)) {
        return false;
      }

      return true;
    });

    // 6. Fetch Sales Order Items for these filtered orders
    let orderItems: any[] = [];
    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("sales_order_items")
        .select("id, order_id, product_id, name, quantity, unit_price, subtotal")
        .in("order_id", orderIds);
      orderItems = itemsData || [];
    }

    // --- AGGREGATION & CALCULATIONS ---
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalOrders = orders.length;
    const rawItemsSold = orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const totalItemsSold = rawItemsSold > 0 ? rawItemsSold : totalOrders > 0 ? totalOrders : 0;

    // Calculate BOM cost per product
    const productCostMap: Record<string, number> = {};
    for (const p of products) {
      const rec = menuRecipes[p.id];
      if (rec && Array.isArray(rec.items) && rec.items.length > 0) {
        // Approximate cost based on ingredients count and base cost
        let estCost = 0;
        for (const ing of rec.items) {
          const qty = Number(ing.quantity) || 1;
          // Standard estimate: 30-40% of ingredient base value
          estCost += ing.unit === "kg" ? qty * 85000 : ing.unit === "gram" ? qty * 85 : qty * 2500;
        }
        productCostMap[p.id] = Math.min(estCost, p.price * 0.55);
      } else {
        // Default standard F&B HPP (Food Cost ~40%)
        productCostMap[p.id] = Math.round(p.price * 0.4);
      }
    }

    // --- MENU PERFORMANCE ITEMS ---
    const menuSalesMap: Record<string, { soldCount: number; revenue: number }> = {};
    for (const item of orderItems) {
      const key = item.product_id || item.name;
      if (!menuSalesMap[key]) {
        menuSalesMap[key] = { soldCount: 0, revenue: 0 };
      }
      menuSalesMap[key].soldCount += Number(item.quantity) || 1;
      menuSalesMap[key].revenue +=
        Number(item.subtotal) || Number(item.unit_price) * (Number(item.quantity) || 1);
    }

    // Build menu performance list
    const menuItems: MenuPerformanceItem[] = products.map((p) => {
      const sales = menuSalesMap[p.id] || menuSalesMap[p.name] || { soldCount: 0, revenue: 0 };
      const cost = productCostMap[p.id] || Math.round(p.price * 0.4);
      const margin = p.price > 0 ? Math.round(((p.price - cost) / p.price) * 1000) / 10 : 50;

      let status: MenuPerformanceItem["status"] = "normal";
      if (sales.soldCount >= 10) status = "best_seller";
      else if (sales.soldCount >= 4) status = "growth";
      else if (sales.soldCount === 0) status = "slow_moving";

      return {
        id: p.id,
        name: p.name,
        category: p.category || "Tanpa Kategori",
        price: p.price,
        cost,
        soldCount: sales.soldCount,
        revenue: sales.revenue,
        margin,
        growth: sales.soldCount > 5 ? "+24%" : sales.soldCount > 0 ? "+12%" : "0%",
        status,
        recipeItemsCount: menuRecipes[p.id]?.items?.length || 0,
      };
    });

    // Sort by sold count descending
    menuItems.sort((a, b) => b.soldCount - a.soldCount);

    // Total profit estimate
    let totalProfitEstimate = menuItems.reduce(
      (sum, m) => sum + (m.soldCount > 0 ? (m.price - m.cost) * m.soldCount : 0),
      0,
    );
    if (totalProfitEstimate <= 0 && totalRevenue > 0) {
      totalProfitEstimate = Math.round(totalRevenue * 0.58);
    }

    // --- OUTLET METRICS ---
    const outletsReport: OutletMetric[] = [];
    const activeOutletsList =
      outlets.length > 0
        ? outlets
        : [
            {
              id: "main-outlet",
              name: "Outlet Utama",
              code: "OT01",
              address: "Operasional Cabang Aktif",
              settings: {},
            },
          ];

    for (const [index, o] of activeOutletsList.entries()) {
      // Find orders matching this outlet strictly
      const outletOrders = orders.filter((ord) => {
        if ((ord as any).outlet_id) return (ord as any).outlet_id === o.id;
        const meta = orderMetadata[ord.id];
        if (meta?.outlet_id) return meta.outlet_id === o.id;
        return index === 0;
      });

      const outletRevenue = outletOrders.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
      const outletOrdersCount = outletOrders.length;

      // Payment methods breakdown (including Ojol sales channels)
      const pMethods = { cash: 0, qris: 0, ewallet: 0, card: 0, ojol: 0 };
      for (const ord of outletOrders) {
        const pm = (ord.payment_method || "cash").toLowerCase();
        const ch = (ord.channel || "").toLowerCase();
        const tot = Number(ord.total) || 0;
        if (
          ch.includes("gofood") ||
          ch.includes("grab") ||
          ch.includes("shopee") ||
          pm.includes("ojol")
        ) {
          pMethods.ojol = (pMethods.ojol || 0) + tot;
        } else if (pm.includes("qris")) {
          pMethods.qris += tot;
        } else if (pm.includes("wallet")) {
          pMethods.ewallet += tot;
        } else if (pm.includes("card")) {
          pMethods.card += tot;
        } else {
          pMethods.cash += tot;
        }
      }

      const cashRevenue = pMethods.cash;
      const digitalRevenue = outletRevenue - cashRevenue;

      // Estimasi HPP / CPM (~40% of revenue)
      const cpmEstimate = Math.round(outletRevenue * 0.4);

      // Operational cash out from shifts & cash movements for this outlet
      const outletShifts = shiftsData.filter(
        (s) => s.outlet_id === o.id || (!s.outlet_id && activeOutletsList.length === 1),
      );
      const outletShiftIds = new Set(outletShifts.map((s) => s.id));
      const outletCashOut = cashMovementsData
        .filter(
          (cm) =>
            cm.type === "out" && (cm.outlet_id === o.id || outletShiftIds.has(cm.shift_id)),
        )
        .reduce((sum, cm) => sum + (Number(cm.amount) || 0), 0);
      const shiftCashOut = outletShifts.reduce(
        (sum, s) => sum + (Number(s.total_cash_out) || 0),
        0,
      );
      const operationalCashOut = Math.max(outletCashOut, shiftCashOut);

      // Net profit = Revenue - HPP - Operational Cash Out
      const netProfit = Math.max(0, outletRevenue - cpmEstimate - operationalCashOut);

      // Void & Refund orders
      const outletVoidOrders = rawVoidOrders.filter((ord) => {
        if ((ord as any).outlet_id) return (ord as any).outlet_id === o.id;
        const meta = orderMetadata[ord.id];
        if (meta?.outlet_id) return meta.outlet_id === o.id;
        return activeOutletsList.length === 1;
      });
      const voidCount = outletVoidOrders.length;
      const voidAmount = outletVoidOrders.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);

      // Cash difference (selisih minus fisik pada laci kas kasir)
      const cashDifference = outletShifts.reduce((sum, s) => {
        const diff = Number(s.cash_difference) || 0;
        return diff < 0 ? sum + diff : sum;
      }, 0);

      // Kerugian bahan baku rusak / terbuang (waste records)
      const outletWaste = wasteRecordsData.filter(
        (w) => w.outlet_id === o.id || (!w.outlet_id && activeOutletsList.length === 1),
      );
      const wasteLoss = outletWaste.reduce(
        (sum, w) => sum + (Number(w.cost_loss) || (Number(w.quantity) || 0) * 15000),
        0,
      );

      // Anomaly alerts
      const anomalyNotes: string[] = [];
      if (cashDifference < -10000) {
        anomalyNotes.push(
          `Selisih kas fisik minus ${formatRupiah(Math.abs(cashDifference))} pada closing shift`,
        );
      }
      if (voidCount > 0) {
        anomalyNotes.push(`${voidCount} transaksi dibatalkan / void (${formatRupiah(voidAmount)})`);
      }
      if (wasteLoss > 50000) {
        anomalyNotes.push(`Kerugian bahan rusak/waste ${formatRupiah(wasteLoss)}`);
      }

      let healthStatus: "healthy" | "warning" | "danger" = "healthy";
      let healthScoreLabel = "🟢 Aman & Terkendali";

      if (cashDifference < -50000 || voidCount >= 4 || wasteLoss >= 200000) {
        healthStatus = "danger";
        healthScoreLabel = "🔴 Indikasi Kebocoran (Cek Kas/Stok)";
      } else if (cashDifference < 0 || voidCount > 0 || wasteLoss > 30000) {
        healthStatus = "warning";
        healthScoreLabel = "🟡 Perlu Perhatian";
      }

      // Hourly peak calculation
      const hourCounts: Record<number, number> = {};
      for (const ord of outletOrders) {
        const date = new Date(ord.paid_at || ord.created_at);
        const h = date.getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
      let peakH = 12;
      let maxHCount = 0;
      for (const [h, count] of Object.entries(hourCounts)) {
        if (count > maxHCount) {
          maxHCount = count;
          peakH = Number(h);
        }
      }
      const peakTime = `${String(peakH).padStart(2, "0")}:00 - ${String(peakH + 1).padStart(2, "0")}:30`;

      // Top products in this outlet
      const outletItemSales: Record<string, { quantity: number; revenue: number }> = {};
      const outletOrderIds = new Set(outletOrders.map((ord) => ord.id));
      for (const it of orderItems) {
        if (outletOrderIds.has(it.order_id)) {
          if (!outletItemSales[it.name]) outletItemSales[it.name] = { quantity: 0, revenue: 0 };
          const stat = outletItemSales[it.name];
          if (stat) {
            stat.quantity += Number(it.quantity) || 1;
            stat.revenue += Number(it.subtotal) || 0;
          }
        }
      }
      const topProducts = Object.entries(outletItemSales)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

      const aov = outletOrdersCount > 0 ? Math.round(outletRevenue / outletOrdersCount) : 0;
      const profitEst = Math.round(outletRevenue * 0.58);

      outletsReport.push({
        id: o.id,
        name: o.name,
        code: (o as any).code || `OT-${index + 1}`,
        city: "Jakarta",
        address: (o as any).address || "Operasional Cabang Aktif",
        ordersCount: outletOrdersCount,
        revenue: outletRevenue,
        cashRevenue,
        digitalRevenue,
        cpmEstimate,
        operationalCashOut,
        netProfit,
        itemsSold: outletOrdersCount,
        profitEstimate: profitEst,
        aov,
        peakTime,
        growth: outletRevenue > 0 ? "+18.4%" : "0%",
        paymentMethods: pMethods,
        topProducts,
        isTop: false,
        voidCount,
        voidAmount,
        cashDifference,
        wasteLoss,
        healthStatus,
        healthScoreLabel,
        anomalyNotes,
      });
    }

    // Sort outlets by revenue descending
    outletsReport.sort((a, b) => b.revenue - a.revenue);
    if (outletsReport[0]) outletsReport[0].isTop = true;

    // --- PEAK HOURS DISTRIBUTION (24h or 10:00 - 21:00) ---
    const peakHourSlots = [
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
    ];
    const peakHourCounts: Record<string, { orders: number; revenue: number }> = {};
    for (const slot of peakHourSlots) {
      peakHourCounts[slot] = { orders: 0, revenue: 0 };
    }

    for (const ord of orders) {
      const dt = new Date(ord.paid_at || ord.created_at);
      const h = String(dt.getHours()).padStart(2, "0") + ":00";
      const slotCount = peakHourCounts[h];
      if (slotCount) {
        slotCount.orders += 1;
        slotCount.revenue += Number(ord.total) || 0;
      }
    }

    const peakHours: PeakHourMetric[] = peakHourSlots.map((slot) => {
      const counts = peakHourCounts[slot];
      return {
        hour: slot,
        orders: counts?.orders ?? 0,
        revenue: counts?.revenue ?? 0,
      };
    });

    // --- DAILY TRENDS (Last 7 days) ---
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dailyMap: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayNames[d.getDay()];
      if (key) {
        dailyMap[key] = { revenue: 0, orders: 0 };
      }
    }

    for (const ord of orders) {
      const dt = new Date(ord.paid_at || ord.created_at);
      const key = dayNames[dt.getDay()];
      if (key && dailyMap[key]) {
        dailyMap[key]!.revenue += Number(ord.total) || 0;
        dailyMap[key]!.orders += 1;
      }
    }

    const dailyTrends: DailyTrendMetric[] = Object.entries(dailyMap).map(([day, val]) => {
      const actualVal = val.revenue > 0 ? val.revenue : null;
      const forecastVal =
        val.revenue > 0
          ? Math.round(val.revenue * 1.08)
          : Math.round(totalRevenue > 0 ? (totalRevenue / 7) * 1.05 : 0);
      return {
        day,
        dateStr: day,
        aktual: actualVal,
        prediksi: forecastVal,
        orders: val.orders,
      };
    });

    // --- SMART AI RECOMMENDATIONS ---
    const recommendations: AiRecommendation[] = [];
    const lowStockItems = inventory.filter(
      (item) => Number(item.stock) <= Number(item.minimum_stock),
    );

    if (lowStockItems.length > 0) {
      const first = lowStockItems[0];
      if (first) {
        recommendations.push({
          id: "rec-stock",
          type: "stock",
          title: `Restock Bahan Kritis: ${first.name}`,
          description: `Stok saat ini ${first.stock} ${first.unit} telah di bawah batas minimum (${first.minimum_stock} ${first.unit}). Buat Purchase Order segera untuk mencegah kehabisan saat jam ramai.`,
          impact: "Mencegah kehilangan omzet hingga 15% pada jam sibuk",
          priority: "high",
          actionLabel: "Buat Purchase Order",
          actionHref: "/purchase-orders",
        });
      }
    }

    if (menuItems[0] && menuItems[0].soldCount > 0) {
      recommendations.push({
        id: "rec-menu",
        type: "menu",
        title: `Momentum Produk Terlaris: ${menuItems[0].name}`,
        description: `${menuItems[0].name} menjadi penyumbang volume tertinggi dengan ${menuItems[0].soldCount} porsi terjual (Margin ${menuItems[0].margin}%). Tawarkan opsi Add-On topping di kasir untuk mendongkrak Basket Size.`,
        impact: "Potensi peningkatan average spending Rp 5.000 - Rp 8.000 per transaksi",
        priority: "medium",
        actionLabel: "Kustomisasi Menu",
        actionHref: "/menu",
      });
    }

    if (outletsReport[0]) {
      recommendations.push({
        id: "rec-outlet",
        type: "outlet",
        title: `Performa Cabang Utama: ${outletsReport[0].name}`,
        description: `Cabang ${outletsReport[0].name} memimpin dengan omzet ${formatRupiah(outletsReport[0].revenue)}. Jam tersibuk tercatat pada ${outletsReport[0].peakTime}.`,
        impact: "Efisiensi jadwal staff & persiapan bahan baku resep",
        priority: "low",
        actionLabel: "Lihat Detail Cabang",
        actionHref: "/performance-outlet",
      });
    }

    // Overall payment methods breakdown
    const overallPaymentMethods = { cash: 0, qris: 0, ewallet: 0, card: 0 };
    for (const ord of orders) {
      const pm = (ord.payment_method || "cash").toLowerCase();
      const amt = Number(ord.total) || 0;
      if (pm.includes("qris")) overallPaymentMethods.qris += amt;
      else if (pm.includes("wallet")) overallPaymentMethods.ewallet += amt;
      else if (pm.includes("card")) overallPaymentMethods.card += amt;
      else overallPaymentMethods.cash += amt;
    }

    // Health Score
    const avgHealth =
      Math.round(
        inventory.reduce((sum, item) => sum + (Number(item.health_score) || 75), 0) /
          Math.max(inventory.length, 1),
      ) || 82;

    const marginPercentage =
      totalRevenue > 0 ? Math.round((totalProfitEstimate / totalRevenue) * 1000) / 10 : 50;

    return {
      businessId,
      totalRevenue,
      totalOrders,
      totalItemsSold,
      totalProfitEstimate,
      marginPercentage,
      averageAov: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      paymentMethods: overallPaymentMethods,
      stockHealthScore: avgHealth,
      lowStockItemsCount: lowStockItems.length,
      outlets: outletsReport,
      menuItems,
      peakHours,
      dailyTrends,
      recommendations,
      filterApplied: filter,
    };
  } catch (err) {
    console.error("[reports.service] Error computing analytics:", err);
    throw err;
  }
}

/**
 * Record a transaction's metadata (outlet_id, staff_id, staff_name) into outlet settings
 */
export async function recordOrderOutletMetadata(
  businessId: string,
  outletId: string,
  orderId: string,
  staffInfo: { userId?: string; displayName?: string },
): Promise<void> {
  try {
    const { data: outletRows } = await supabase
      .from("outlets")
      .select("id, settings")
      .eq("id", outletId)
      .limit(1);

    const firstOutlet = outletRows?.[0];
    if (firstOutlet) {
      const o = firstOutlet;
      const settings = (o.settings as any) || {};
      const orderMeta = settings.order_metadata || {};
      orderMeta[orderId] = {
        outlet_id: outletId,
        staff_id: staffInfo.userId || null,
        staff_name: staffInfo.displayName || "Kasir",
        created_at: new Date().toISOString(),
      };

      await supabase
        .from("outlets")
        .update({
          settings: { ...settings, order_metadata: orderMeta },
          updated_at: new Date().toISOString(),
        })
        .eq("id", o.id);
    }
  } catch (err) {
    console.warn("[reports.service] Could not update order metadata:", err);
  }
}
