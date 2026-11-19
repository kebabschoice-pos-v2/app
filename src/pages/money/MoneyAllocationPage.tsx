import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  Receipt,
  ShoppingCart,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Store,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Boxes,
  Zap,
  Building,
  History,
  FileSpreadsheet,
  Settings,
  PackagePlus,
  Users,
  Banknote,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah, type Snapshot } from "@/components/kebabschoicepos/data";
import {
  getComprehensiveAnalytics,
  isDateWithinFilter,
  resolveFilterDateBounds,
  type BusinessAnalyticsSummary,
  type DateRangePreset,
} from "@/services/reports.service";
import { getManagerPermissions, type ManagerPermissions } from "@/services/manager-permissions.service";
import {
  getInventoryItems,
  getStockMovements,
  createInventoryItem,
  recordStockIn,
  loadBranchMoneyLedger,
  saveBranchMoneyLedger,
  type InventoryItemDetail,
  type StockMovementRecord,
} from "@/services/inventory.service";
import { getHRStaffProfiles, type StaffProfile, type StaffPayroll } from "@/services/hr.service";
import { convertRecipeToInventoryQuantity, getMenuItems } from "@/services/menu.service";
import {
  estimateOrdersBomMetrics,
  normalizeOrderOutletId,
  resolvePrimaryOutletId,
} from "@/lib/bom-analytics";

export interface PackConfig {
  pack_size: number;
  pack_price: number;
}

export interface OperationalExpensePocket {
  id: string;
  name: string;
  category: "kios" | "listrik" | "parkir" | "operasional_lain";
  target_monthly?: number; // target nominal bulanan (misal Rp 1.000.000)
  daily_allocation: number; // alokasi target per hari (misal 50.000)
  days_collected?: number; // jumlah hari terkumpul
  accumulated_balance: number; // saldo tabungan terkumpul
  last_paid_date?: string;
  total_paid: number;
  manual_stash?: number; // penambahan manual
}

export interface CashMovementRecord {
  id: string;
  shiftId?: string;
  type: "in" | "out";
  amount: number;
  notes?: string;
  timestamp: string;
  outlet_id?: string;
  outlet_name?: string;
}

export interface MoneyAllocationHistoryItem {
  id: string;
  outlet_id: string;
  outlet_name: string;
  type: "belanja_bahan" | "bayar_operasional" | "bayar_gaji" | "suntik_saldo";
  title: string;
  amount: number;
  timestamp: string;
  note?: string;
}

interface MoneyAllocationSettings {
  pack_configs?: Record<string, PackConfig>;
  spent_amounts?: Record<string, number>;
  manual_added?: Record<string, number>;
  opPockets?: OperationalExpensePocket[];
  salary_paid?: Record<string, number>;
  history?: MoneyAllocationHistoryItem[];
}

const STORAGE_KEY = "kebabschoicepos_money_allocation";

export function MoneyAllocationPage({
  snapshot,
  onRefresh,
}: {
  snapshot?: Snapshot;
  onRefresh?: () => Promise<void> | void;
}) {
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangePreset>("all");
  const [managerPermissions, setManagerPermissions] = useState<ManagerPermissions | null>(null);
  const [userRole, setUserRole] = useState<string>("owner");
  const [loading, setLoading] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsSummary | null>(null);

  // Real Inventory & Movement Data
  const [inventoryList, setInventoryList] = useState<InventoryItemDetail[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([]);

  // Dual-Engine: Sales orders & Menu Recipes
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [menuProducts, setMenuProducts] = useState<any[]>([]);
  const [orderMetaMap, setOrderMetaMap] = useState<Record<string, any>>({});
  const [menuRecipes, setMenuRecipes] = useState<Record<string, any>>({});

  // Staff HR & Cash Movements
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [salaryPaid, setSalaryPaid] = useState<Record<string, number>>({});
  const [cashMovements, setCashMovements] = useState<CashMovementRecord[]>([]);

  // Persistent settings (Pack configs & expenses)
  const [packConfigs, setPackConfigs] = useState<Record<string, PackConfig>>({});
  const [spentAmounts, setSpentAmounts] = useState<Record<string, number>>({});
  const [manualAdded, setManualAdded] = useState<Record<string, number>>({});
  const [opPockets, setOpPockets] = useState<OperationalExpensePocket[]>([]);
  const [history, setHistory] = useState<MoneyAllocationHistoryItem[]>([]);

  // Modals
  const [isAddingItemModal, setIsAddingItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Bahan Baku Kebab");
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemInitialStock, setNewItemInitialStock] = useState<number>(0);
  const [newItemPackSize, setNewItemPackSize] = useState<number>(20);
  const [newItemPackPrice, setNewItemPackPrice] = useState<number>(20000);
  const [savingNewItem, setSavingNewItem] = useState(false);

  // Pack Config Edit Modal
  const [editingPackItem, setEditingPackItem] = useState<InventoryItemDetail | null>(null);
  const [editPackSize, setEditPackSize] = useState<number>(1);
  const [editPackPrice, setEditPackPrice] = useState<number>(0);

  // Spend Modal (Belanja Bahan)
  const [spendingItem, setSpendingItem] = useState<{
    item: InventoryItemDetail;
    pack_size: number;
    pack_price: number;
    unit_cost: number;
    accumulated_balance: number;
    canBuyPacks: number;
  } | null>(null);
  const [spendPacks, setSpendPacks] = useState<number>(1);
  const [spendNote, setSpendNote] = useState<string>("");
  const [spendingLoading, setSpendingLoading] = useState(false);

  // Top-Up / Suntik Saldo Modal (Owner Capital Injection)
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpItem, setTopUpItem] = useState<{
    item: InventoryItemDetail;
    accumulated_balance: number;
    totalEarned: number;
    spent: number;
    added: number;
    unit_cost: number;
    pack_price: number;
  } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(100000);
  const [topUpSource, setTopUpSource] = useState<
    "owner_capital" | "branch_profit" | "owner_profit" | "emergency_fund"
  >("owner_capital");
  const [topUpNote, setTopUpNote] = useState<string>("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Pay Op Modal
  const [payOpModal, setPayOpModal] = useState<OperationalExpensePocket | null>(null);
  const [payOpAmount, setPayOpAmount] = useState<number>(0);
  const [payOpNote, setPayOpNote] = useState<string>("");

  // Pay Salary Modal
  const [paySalaryModal, setPaySalaryModal] = useState(false);
  const [paySalaryAmount, setPaySalaryAmount] = useState<number>(0);
  const [paySalaryNote, setPaySalaryNote] = useState<string>("");
  const [payingSalaryLoading, setPayingSalaryLoading] = useState(false);

  // Add Op Pocket
  const [isAddingOp, setIsAddingOp] = useState(false);
  const [newOpName, setNewOpName] = useState("");
  const [newOpCategory, setNewOpCategory] = useState<OperationalExpensePocket["category"]>("kios");
  const [newOpMonthly, setNewOpMonthly] = useState<number>(1000000);
  const [newOpDaily, setNewOpDaily] = useState<number>(50000);

  const outletsList = useMemo(() => {
    return snapshot?.outlets || [];
  }, [snapshot?.outlets]);

  // Clean old dummy data from localStorage if found
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // If contains legacy dummy bomPockets with hardcoded dummy items, clean them
          if (parsed && Array.isArray(parsed.bomPockets) && parsed.bomPockets.some((b: any) => b.id?.startsWith("bom-"))) {
            delete parsed.bomPockets;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
        }
      } catch {}
    }
  }, []);

  const loadRequestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    try {
      setLoading(true);
      const bId =
        snapshot?.businessId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
          : "");

      const activeRole =
        typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_user_role") || "owner"
          : "owner";

      if (!bId) {
        setLoading(false);
        return;
      }

      const periodFilter = { dateRange, outletId: selectedOutletId };
      const { startIso: periodStartIso, endIso: periodEndIso } = resolveFilterDateBounds(periodFilter);

      let ordersQuery = supabase
        .from("sales_orders")
        .select("id, outlet_id, status, total, paid_at, created_at")
        .eq("business_id", bId);
      if (periodStartIso) {
        ordersQuery = ordersQuery.gte("created_at", periodStartIso);
      }
      if (periodEndIso) {
        ordersQuery = ordersQuery.lte("created_at", periodEndIso);
      }

      let cmQuery = supabase
        .from("cash_movements" as any)
        .select("*")
        .eq("business_id", bId);
      if (periodStartIso) {
        cmQuery = cmQuery.gte("created_at", periodStartIso);
      }
      if (periodEndIso) {
        cmQuery = cmQuery.lte("created_at", periodEndIso);
      }

      let payrollQuery = supabase
        .from("staff_payrolls" as any)
        .select("*")
        .eq("business_id", bId);

      // 1. Parallel fetch all resources simultaneously strictly scoped to businessId (bId)
      const [
        perms,
        resAnalytics,
        invItems,
        movements,
        hrProfiles,
        dbCmResponse,
        dbOrdersResponse,
        outletDataResponse,
        menuItemsList,
        branchLedgerData,
        dbPayrollsResponse,
      ] = await Promise.all([
        getManagerPermissions(bId, selectedOutletId).catch(() => null),
        getComprehensiveAnalytics(bId, {
          outletId: selectedOutletId,
          dateRange: dateRange,
        }).catch(() => null),
        getInventoryItems(bId).catch(() => [] as InventoryItemDetail[]),
        getStockMovements(bId).catch(() => [] as StockMovementRecord[]),
        getHRStaffProfiles(bId).catch(() => [] as StaffProfile[]),
        Promise.resolve(cmQuery).catch(() => ({ data: [] })),
        Promise.resolve(ordersQuery.order("created_at", { ascending: false })).catch(() => ({ data: [] })),
        Promise.resolve(
          supabase
            .from("outlets")
            .select("settings")
            .eq("business_id", bId),
        ).catch(() => ({ data: [] })),
        getMenuItems({ businessId: bId }).catch(() => [] as any[]),
        loadBranchMoneyLedger(selectedOutletId).catch(() => null),
        Promise.resolve(payrollQuery).catch(() => ({ data: [] })),
      ]);

      // Fetch sales_order_items strictly for this business's orders (never cross-tenant unscoped)
      const businessOrderIds = ((dbOrdersResponse?.data as any[]) || [])
        .map((o: any) => o.id)
        .filter(Boolean);
      const dbItemsResponse =
        businessOrderIds.length > 0
          ? await Promise.resolve(
              supabase
                .from("sales_order_items")
                .select("order_id, product_id, name, quantity")
                .in("order_id", businessOrderIds),
            ).catch(() => ({ data: [] }))
          : { data: [] };

      const branchItems =
        selectedOutletId === "all"
          ? invItems
          : invItems.filter((i: any) => {
              if (i.outlet_id) return i.outlet_id === selectedOutletId;
              const fallbackPrimary = resolvePrimaryOutletId(outletsList);
              return !fallbackPrimary || fallbackPrimary === selectedOutletId;
            });

      // Cash movements parsing
      let cmList: CashMovementRecord[] = [];
      const dbCm = dbCmResponse?.data;
      if (dbCm && Array.isArray(dbCm)) {
        cmList = dbCm.map((m: any) => ({
          id: m.id,
          shiftId: m.shift_id,
          type: m.type === "in" || m.movement_type === "in" ? "in" : "out",
          amount: Number(m.amount || 0),
          notes: m.notes || m.description || m.reason || "",
          timestamp: m.created_at || m.timestamp || new Date().toISOString(),
          outlet_id: m.outlet_id,
          outlet_name: m.outlet_name,
        }));
      }

      if (typeof window !== "undefined") {
        try {
          const rawCm = localStorage.getItem("kebabschoicepos_cash_movements");
          if (rawCm) {
            const parsedCm = JSON.parse(rawCm);
            if (Array.isArray(parsedCm)) {
              for (const c of parsedCm) {
                if (!cmList.some((existing) => existing.id === c.id)) {
                  cmList.push({
                    id: c.id,
                    shiftId: c.shiftId,
                    type: c.type || "out",
                    amount: Number(c.amount || 0),
                    notes: c.notes || "",
                    timestamp: c.timestamp || new Date().toISOString(),
                    outlet_id: c.outletId || c.outlet_id,
                    outlet_name: c.outletName || c.outlet_name,
                  });
                }
              }
            }
          }
        } catch {}
      }

      // Sales orders and items pairing
      const validOrders: any[] = [];
      const dbOrders = dbOrdersResponse?.data || [];
      const dbItems = dbItemsResponse?.data || [];

      const itemsByOrder = new Map<string, any[]>();
      for (const it of dbItems) {
        if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
        itemsByOrder.get(it.order_id)!.push(it);
      }

      for (const ord of dbOrders) {
        validOrders.push({
          ...ord,
          items: itemsByOrder.get(ord.id) || [],
        });
      }

      if (typeof window !== "undefined") {
        try {
          const rawRecent = localStorage.getItem("kebabschoicepos_recent_orders");
          if (rawRecent) {
            const recent = JSON.parse(rawRecent);
            if (Array.isArray(recent)) {
              for (const r of recent) {
                if (r && r.id && !validOrders.some((v) => v.id === r.id)) {
                  validOrders.push(r);
                }
              }
            }
          }
        } catch {}
      }

      const cleanOrders = validOrders.filter(
        (o) =>
          o.status !== "void" &&
          o.status !== "void_reversal" &&
          o.status !== "refund" &&
          o.status !== "refunded" &&
          o.status !== "cancelled",
      );

      // Recipe maps and metadata
      const recipes: Record<string, any> = {};
      const extractedOrderMeta: Record<string, any> = {};
      const outletData = outletDataResponse?.data;
      if (outletData && Array.isArray(outletData)) {
        for (const o of outletData) {
          const s = (o.settings as any) || {};
          if (s.menu_recipes) Object.assign(recipes, s.menu_recipes);
          if (s.order_metadata) Object.assign(extractedOrderMeta, s.order_metadata);
        }
      }

      for (const m of menuItemsList || []) {
        const rec = m.recipe || (m.recipe_items && m.recipe_items.length > 0 ? { items: m.recipe_items } : null);
        if (rec) {
          recipes[m.id] = rec;
          if (m.name) {
            recipes[m.name] = rec;
            recipes[m.name.toLowerCase().trim()] = rec;
          }
        }
      }

      // Money Ledger / Settings
      let loadedConfigs: MoneyAllocationSettings | null = branchLedgerData as MoneyAllocationSettings | null;
      if (!loadedConfigs && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) loadedConfigs = JSON.parse(raw);
        } catch {}
      }

      if (!loadedConfigs && Array.isArray(outletDataResponse?.data) && outletDataResponse.data.length > 0) {
        const firstOutletSettings = ((outletDataResponse.data[0] as any)?.settings as any) || {};
        if (firstOutletSettings.money_allocation_ledger) {
          loadedConfigs = firstOutletSettings.money_allocation_ledger;
        } else if (firstOutletSettings.money_allocation) {
          loadedConfigs = firstOutletSettings.money_allocation;
        }
      }

      // Discard stale out-of-order response if a newer filter/period request is already active
      if (requestId !== loadRequestIdRef.current) return;

      // Single batched state commit: All states update synchronously together
      setUserRole(activeRole);
      if (perms) setManagerPermissions(perms);
      if (resAnalytics) setAnalytics(resAnalytics);
      setInventoryList(branchItems);
      setStockMovements(movements || []);
      setStaffProfiles(hrProfiles || []);
      setCashMovements(cmList);
      setSalesOrders(cleanOrders);
      setOrderMetaMap(extractedOrderMeta);
      setMenuProducts(menuItemsList || []);
      setMenuRecipes(recipes);

      // Reconcile paid payrolls from Supabase staff_payrolls table with branch ledger salary_paid
      const dbPayrolls = ((dbPayrollsResponse?.data as unknown as StaffPayroll[]) || []).filter(
        (pr) => pr && pr.status === "paid",
      );
      const dbPaidByOutlet: Record<string, number> = {};
      for (const pr of dbPayrolls) {
        if (!isDateWithinFilter(pr.payment_date || pr.created_at, periodFilter)) continue;
        const outKey = normalizeOrderOutletId(pr.outlet_id, outletsList) || "all";
        dbPaidByOutlet[outKey] = (dbPaidByOutlet[outKey] || 0) + (Number(pr.net_salary) || 0);
      }

      if (loadedConfigs) {
        if (loadedConfigs.pack_configs) setPackConfigs(loadedConfigs.pack_configs);
        if (loadedConfigs.spent_amounts) setSpentAmounts(loadedConfigs.spent_amounts);
        if (loadedConfigs.manual_added) setManualAdded(loadedConfigs.manual_added);
        if (loadedConfigs.salary_paid || Object.keys(dbPaidByOutlet).length > 0) {
          const mergedSalaryPaid: Record<string, number> = { ...(loadedConfigs.salary_paid || {}) };
          for (const [outKey, paidSum] of Object.entries(dbPaidByOutlet)) {
            mergedSalaryPaid[outKey] = Math.max(Number(mergedSalaryPaid[outKey] || 0), paidSum);
          }
          setSalaryPaid(mergedSalaryPaid);
        }
        if (loadedConfigs.history) setHistory(loadedConfigs.history);
        if (loadedConfigs.opPockets && loadedConfigs.opPockets.length > 0) {
          setOpPockets(loadedConfigs.opPockets);
        } else {
          setOpPockets([
            {
              id: "op-sewa-kios",
              name: "Sewa Tempat / Kios Cabang",
              category: "kios",
              target_monthly: 1000000,
              daily_allocation: 50000,
              days_collected: 0,
              accumulated_balance: 0,
              total_paid: 0,
            },
            {
              id: "op-listrik",
              name: "Listrik & Air Cabang",
              category: "listrik",
              target_monthly: 300000,
              daily_allocation: 10000,
              days_collected: 0,
              accumulated_balance: 0,
              total_paid: 0,
            },
            {
              id: "op-parkir-sampah",
              name: "Iuran Kebersihan & Parkiran",
              category: "parkir",
              target_monthly: 300000,
              daily_allocation: 10000,
              days_collected: 0,
              accumulated_balance: 0,
              total_paid: 0,
            },
          ]);
        }
      } else {
        if (Object.keys(dbPaidByOutlet).length > 0) {
          setSalaryPaid(dbPaidByOutlet);
        }
        setOpPockets([
          {
            id: "op-sewa-kios",
            name: "Sewa Tempat / Kios Cabang",
            category: "kios",
            target_monthly: 1000000,
            daily_allocation: 50000,
            days_collected: 0,
            accumulated_balance: 0,
            total_paid: 0,
          },
          {
            id: "op-listrik",
            name: "Listrik & Air Cabang",
            category: "listrik",
            target_monthly: 300000,
            daily_allocation: 10000,
            days_collected: 0,
            accumulated_balance: 0,
            total_paid: 0,
          },
          {
            id: "op-parkir-sampah",
            name: "Iuran Kebersihan & Parkiran",
            category: "parkir",
            target_monthly: 300000,
            daily_allocation: 10000,
            days_collected: 0,
            accumulated_balance: 0,
            total_paid: 0,
          },
        ]);
      }

      // Commit hasLoadedData only after all ledger/pocket/payroll state updates are queued in the same batch
      setHasLoadedData(true);
    } catch (err) {
      console.error("[MoneyAllocationPage] Load error:", err);
      if (requestId === loadRequestIdRef.current) {
        setHasLoadedData(true);
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [snapshot?.businessId, selectedOutletId, dateRange, outletsList]);

  useEffect(() => {
    loadData();
    const handleInvUpdate = () => loadData();
    window.addEventListener("inventory:updated", handleInvUpdate);
    return () => window.removeEventListener("inventory:updated", handleInvUpdate);
  }, [loadData]);

  // Persist Helper (Supabase-authoritative via saveBranchMoneyLedger)
  async function persistSettings(
    newConfigs = packConfigs,
    newSpent = spentAmounts,
    newManual = manualAdded,
    newOp = opPockets,
    newHist = history,
    newSalaryPaid = salaryPaid,
  ) {
    const payload: MoneyAllocationSettings = {
      pack_configs: newConfigs,
      spent_amounts: newSpent,
      manual_added: newManual,
      opPockets: newOp,
      history: newHist,
      salary_paid: newSalaryPaid,
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {}
    }

    try {
      await saveBranchMoneyLedger(selectedOutletId, payload);
    } catch (e) {
      console.warn("[persistSettings] saveBranchMoneyLedger warning:", e);
    }
  }

  // 1. Compute Real Sales Days for Operational Allocation (Strict Non-Void & Consistently Filtered by Period)
  // Normalize order outlet_ids so null/orphaned historical transactions attribute to primary active outlet
  const normalizedSalesOrders = useMemo(() => {
    const periodFilter = { dateRange };
    return salesOrders
      .filter((ord) => isDateWithinFilter(ord.paid_at || ord.created_at, periodFilter))
      .map((ord) => ({
        ...ord,
        outlet_id: normalizeOrderOutletId(
          ord.outlet_id,
          outletsList,
          orderMetaMap[ord.id]?.outlet_id,
        ),
      }));
  }, [salesOrders, outletsList, orderMetaMap, dateRange]);

  const periodFilteredStockMovements = useMemo(() => {
    const periodFilter = { dateRange };
    return stockMovements.filter((m) => isDateWithinFilter(m.created_at, periodFilter));
  }, [stockMovements, dateRange]);

  const operationalDaysWithSales = useMemo(() => {
    const salesDates = new Set<string>();
    for (const ord of normalizedSalesOrders) {
      if (ord.created_at && (!selectedOutletId || selectedOutletId === "all" || ord.outlet_id === selectedOutletId)) {
        salesDates.add(ord.created_at.slice(0, 10));
      }
    }
    return salesDates.size;
  }, [normalizedSalesOrders, selectedOutletId]);

  // 2. Computed BOM Pockets from Real Inventory Items (DUAL-ENGINE CALCULATION, STRICT BRANCH ISOLATION + HQ MERGE)
  const computedBomPockets = useMemo(() => {
    const primaryOutletId = resolvePrimaryOutletId(outletsList);

    const perItemPockets = inventoryList.map((item) => {
      const itemOutletId = item.outlet_id
        ? normalizeOrderOutletId(item.outlet_id, outletsList)
        : primaryOutletId;

      // Pack Config fallback
      const hasYield = Number(item.yield_per_unit) > 0;
      const isPackOrPcs = item.unit === "pcs" || item.unit === "pack" || item.unit === "tiang";

      const config = packConfigs[item.id] || {
        pack_size: hasYield || isPackOrPcs ? 1 : item.unit === "gram" ? 2000 : item.unit === "ml" ? 1000 : 20,
        pack_price:
          item.cost_price > 0
            ? hasYield || isPackOrPcs
              ? item.cost_price
              : item.unit === "gram"
                ? item.cost_price * 2000
                : item.cost_price * 20
            : item.unit === "gram"
              ? 100000
              : 20000,
      };

      const pack_size = Number(config.pack_size) > 0 ? Number(config.pack_size) : 1;
      const pack_price =
        Number(config.pack_price) > 0 ? Number(config.pack_price) : item.cost_price > 0 ? item.cost_price * pack_size : 20000;
      const unit_cost =
        pack_price > 0 && pack_size > 0 ? pack_price / pack_size : item.cost_price || 0;

      // Engine 1: Real movements of type pos_sale or stock_out for this branch item (filtered by selected period, with void/refund reversal deductions)
      const itemMovements = periodFilteredStockMovements.filter((m) => {
        if (m.inventory_item_id !== item.id) return false;
        const movOutletId = normalizeOrderOutletId(m.outlet_id, outletsList);
        if (selectedOutletId !== "all" && movOutletId !== selectedOutletId) {
          return false;
        }
        if (itemOutletId && movOutletId && movOutletId !== itemOutletId) {
          return false;
        }
        const mType = (m.movement_type as string) || (m as any).type || "";
        return (
          mType === "pos_sale" ||
          mType === "stock_out" ||
          mType === "void_restore" ||
          mType === "void_reversal" ||
          mType === "refund_reversal"
        );
      });

      // Collect order IDs already captured by physical stock movements to avoid double-counting in Engine 2
      const movedOrderIds = new Set(
        itemMovements
          .map((m) => m.order_id || (m as any).reference_id)
          .filter(Boolean),
      );

      // Snapshot-aware cost calculation for Engine 1 (Movement Engine):
      let movementUsedQty = 0;
      let movementHistoricCost = 0;

      for (const m of itemMovements) {
        const rawQ = Math.abs(Number(m.quantity) || 0);
        if (rawQ === 0) continue;

        // Convert movement raw quantity to item's inventory unit (e.g. 40 gram -> 0.02 pcs if 1 pcs = 2000 gram)
        let convertedQ = rawQ;
        const mUnit = (m.unit || "").trim().toLowerCase();
        const itemUnit = (item.unit || "").trim().toLowerCase();
        const yieldUnit = (item.yield_unit || "").trim().toLowerCase();
        const yieldPerUnit = Number(item.yield_per_unit) || 0;

        if (yieldPerUnit > 0) {
          if (mUnit && yieldUnit && mUnit === yieldUnit && itemUnit !== yieldUnit) {
            convertedQ = rawQ / yieldPerUnit;
          } else if (
            rawQ >= yieldPerUnit / 10 &&
            (mUnit === "gram" || mUnit === "gr" || yieldUnit === "gram" || yieldUnit === "gr") &&
            (itemUnit === "pcs" || itemUnit === "pack" || itemUnit === "tiang")
          ) {
            convertedQ = rawQ / yieldPerUnit;
          } else {
            convertedQ = convertRecipeToInventoryQuantity(
              rawQ,
              mUnit || yieldUnit || itemUnit,
              itemUnit,
              yieldPerUnit,
              yieldUnit,
            );
          }
        }

        // Historic cost snapshot priority:
        // 1. unit_cost / cost_per_unit / cost_price recorded on stock_movement at transaction time
        // 2. fallback to current item unit_cost if snapshot is missing
        const historicUnitCost = Number(
          (m as any).unit_cost ??
          (m as any).cost_per_unit ??
          (m as any).cost_price ??
          unit_cost,
        );
        const effectiveUnitCost = historicUnitCost > 0 ? historicUnitCost : unit_cost;

        const mType = (m.movement_type as string) || (m as any).type || "";
        const isReversal =
          mType === "void_restore" ||
          mType === "void_reversal" ||
          mType === "refund_reversal";

        if (isReversal) {
          movementUsedQty = Math.max(0, movementUsedQty - convertedQ);
          movementHistoricCost = Math.max(0, movementHistoricCost - (convertedQ * effectiveUnitCost));
        } else {
          movementUsedQty += convertedQ;
          movementHistoricCost += convertedQ * effectiveUnitCost;
        }
      }

      // Engine 2: Fallback from valid non-void sales orders * menu_recipes (strictly matching this item's outlet)
      let recipeBomUsedQty = 0;
      for (const ord of normalizedSalesOrders) {
        if (selectedOutletId !== "all" && ord.outlet_id !== selectedOutletId) {
          continue;
        }
        // Prevent double-counting across branches: only orders belonging to this item's branch apply
        if (itemOutletId && ord.outlet_id && ord.outlet_id !== itemOutletId) {
          continue;
        }
        // Avoid double-counting orders that already generated stock movements
        if (ord.id && movedOrderIds.has(ord.id)) {
          continue;
        }
        const hasLineItems = Array.isArray(ord.items) && ord.items.length > 0;
        if (hasLineItems) {
          for (const line of ord.items) {
            const lineQty = Number(line.quantity) || 1;
            const lineNameClean = (line.name || "").toLowerCase().trim();
            let recipe =
              line.recipe ||
              menuRecipes[line.id] ||
              menuRecipes[line.product_id] ||
              menuRecipes[line.name] ||
              (lineNameClean ? menuRecipes[lineNameClean] : null);

            // Fuzzy/loose match if lineNameClean is e.g. "Original" or "Kebab Original"
            if (!recipe && lineNameClean) {
              for (const [recKey, recVal] of Object.entries(menuRecipes)) {
                const kClean = recKey.toLowerCase().trim();
                if (kClean && (lineNameClean.includes(kClean) || kClean.includes(lineNameClean))) {
                  recipe = recVal;
                  break;
                }
              }
            }

            const recipeItems = (recipe && (recipe.items || recipe.recipe_items)) || [];
            if (Array.isArray(recipeItems) && recipeItems.length > 0) {
              for (const ing of recipeItems) {
                const ingNameClean = (ing.ingredient_name || ing.name || "").toLowerCase().trim();
                const itemNameClean = (item.name || "").toLowerCase().trim();
                const isMatch =
                  ing.inventory_item_id === item.id ||
                  ing.id === item.id ||
                  (ingNameClean && itemNameClean && (
                    ingNameClean === itemNameClean ||
                    ingNameClean.includes(itemNameClean) ||
                    itemNameClean.includes(ingNameClean)
                  ));
                if (isMatch) {
                  const ingConverted = convertRecipeToInventoryQuantity(
                    Number(ing.quantity) || 1,
                    ing.unit || "gram",
                    item.unit || "gram",
                    item.yield_per_unit,
                    item.yield_unit,
                  );
                  recipeBomUsedQty += ingConverted * lineQty;
                }
              }
            }
          }
        } else {
          // Smart Fallback: Orders without sales_order_items rows (e.g. historical orders)
          // Estimate portion count based on main menu "Original" (@ Rp 9.000)
          const ordTotal = Number(ord.total_amount || ord.total || ord.final_amount) || 0;
          if (ordTotal > 0) {
            const estimatedQty = Math.max(1, Math.round(ordTotal / 9000));
            const itemNameClean = (item.name || "").toLowerCase().trim();

            // Try matching configured "Original" recipe first
            let origRecipe = menuRecipes["original"] || menuRecipes["kebab original"] || null;
            if (!origRecipe) {
              for (const [recKey, recVal] of Object.entries(menuRecipes)) {
                if (/original/i.test(recKey)) {
                  origRecipe = recVal;
                  break;
                }
              }
            }

            let matchedInRecipe = false;
            const recItems = (origRecipe && (origRecipe.items || origRecipe.recipe_items)) || [];
            if (Array.isArray(recItems) && recItems.length > 0) {
              for (const ing of recItems) {
                const ingNameClean = (ing.ingredient_name || ing.name || "").toLowerCase().trim();
                const isMatch =
                  ing.inventory_item_id === item.id ||
                  ing.id === item.id ||
                  (ingNameClean && itemNameClean && (
                    ingNameClean === itemNameClean ||
                    ingNameClean.includes(itemNameClean) ||
                    itemNameClean.includes(ingNameClean)
                  ));
                if (isMatch) {
                  const ingConverted = convertRecipeToInventoryQuantity(
                    Number(ing.quantity) || 1,
                    ing.unit || "gram",
                    item.unit || "gram",
                    item.yield_per_unit,
                    item.yield_unit,
                  );
                  recipeBomUsedQty += ingConverted * estimatedQty;
                  matchedInRecipe = true;
                }
              }
            }

            // Standard fallback if recipe items didn't match:
            // Tortilla: 1 pcs / 0.05 pack (@ 20 pcs/pack)
            // Daging: 20 gram / 0.01 pcs (@ 2000g/pcs)
            if (!matchedInRecipe) {
              if (itemNameClean.includes("tortilla") || itemNameClean.includes("kulit")) {
                const ingConverted = convertRecipeToInventoryQuantity(
                  1,
                  "pcs",
                  item.unit || "pack",
                  item.yield_per_unit || 20,
                  item.yield_unit || "pcs",
                );
                recipeBomUsedQty += ingConverted * estimatedQty;
              } else if (itemNameClean.includes("daging") || itemNameClean.includes("beef")) {
                const ingConverted = convertRecipeToInventoryQuantity(
                  20,
                  "gram",
                  item.unit || "pcs",
                  item.yield_per_unit || 2000,
                  item.yield_unit || "gram",
                );
                recipeBomUsedQty += ingConverted * estimatedQty;
              }
            }
          }
        }
      }

      // Dual-Engine: Physical recorded movements (with historic cost snapshot) + un-recorded retroactive orders
      const rawUsedQty = movementUsedQty + recipeBomUsedQty;
      const usedQty = Number(rawUsedQty.toFixed(3));
      // Prioritize historic snapshot cost for recorded movements + current unit_cost for retroactive recipe orders
      const retroactiveCost = recipeBomUsedQty * unit_cost;
      const totalEarned = Math.round(movementHistoricCost + retroactiveCost);
      const spent = spentAmounts[item.id] || 0;
      const added = manualAdded[item.id] || 0;
      const accumulated_balance = Math.max(0, totalEarned - spent + added);

      return {
        item,
        pack_size,
        pack_price,
        unit_cost,
        usedQty,
        totalEarned,
        spent,
        added,
        accumulated_balance,
        canBuyPacks: pack_price > 0 ? Math.floor(accumulated_balance / pack_price) : 0,
        branchCount: 1,
      };
    });

    if (selectedOutletId !== "all") {
      return perItemPockets;
    }

    // Consolidate identical ingredient names across branches into 1 HQ card (summing branch-isolated earnings/stock)
    const mergedByName = new Map<string, typeof perItemPockets>();
    for (const pocket of perItemPockets) {
      const key = (pocket.item.name || "").trim().toLowerCase() || pocket.item.id;
      const existingGroup = mergedByName.get(key) || [];
      existingGroup.push(pocket);
      mergedByName.set(key, existingGroup);
    }

    return Array.from(mergedByName.values()).flatMap((group) => {
      if (group.length === 0) return [];
      if (group.length === 1 && group[0]) return [group[0]];

      const rep =
        group.find((p) => p.item.outlet_id === primaryOutletId) ||
        group.find((p) => p.totalEarned > 0) ||
        group[0];
      if (!rep) return [];

      const mergedStock = Number(
        group.reduce((sum, p) => sum + (Number(p.item.stock) || 0), 0).toFixed(3),
      );
      const mergedUsedQty = Number(
        group.reduce((sum, p) => sum + (Number(p.usedQty) || 0), 0).toFixed(3),
      );
      const mergedEarned = group.reduce((sum, p) => sum + (Number(p.totalEarned) || 0), 0);
      const mergedSpent = group.reduce((sum, p) => sum + (Number(p.spent) || 0), 0);
      const mergedAdded = group.reduce((sum, p) => sum + (Number(p.added) || 0), 0);
      const mergedBalance = Math.max(0, mergedEarned - mergedSpent + mergedAdded);

      return [
        {
          ...rep,
          item: {
            ...rep.item,
            stock: mergedStock,
          },
          usedQty: mergedUsedQty,
          totalEarned: mergedEarned,
          spent: mergedSpent,
          added: mergedAdded,
          accumulated_balance: mergedBalance,
          canBuyPacks: rep.pack_price > 0 ? Math.floor(mergedBalance / rep.pack_price) : 0,
          branchCount: group.length,
        },
      ];
    });
  }, [
    inventoryList,
    packConfigs,
    periodFilteredStockMovements,
    selectedOutletId,
    spentAmounts,
    manualAdded,
    normalizedSalesOrders,
    outletsList,
    menuRecipes,
  ]);

  // 3. Financial KPI Preliminary Totals (Strictly synchronized with the active dateRange & outlet filter)
  const salesOrdersSum = useMemo(() => {
    return normalizedSalesOrders.reduce((sum, ord) => {
      if (selectedOutletId !== "all" && ord.outlet_id !== selectedOutletId) {
        return sum;
      }
      return sum + (Number(ord.total_amount || ord.total || ord.final_amount) || 0);
    }, 0);
  }, [normalizedSalesOrders, selectedOutletId]);

  const totalOmzet =
    analytics?.filterApplied?.dateRange === dateRange &&
    (analytics?.filterApplied?.outletId || "all") === selectedOutletId &&
    typeof analytics?.totalRevenue === "number"
      ? Math.max(salesOrdersSum, analytics.totalRevenue)
      : salesOrdersSum;
  const totalBomSavings = computedBomPockets.reduce((sum, b) => sum + b.accumulated_balance, 0);

  // Pure BOM savings generated strictly from sales without manual injections
  const totalBomFromSales = computedBomPockets.reduce(
    (sum, b) => sum + Math.max(0, b.totalEarned - b.spent),
    0,
  );

  // 4. Celengan Gaji & Tunjangan Tim Cabang + Kas Keluar Laci Kasir Cabang
  const branchStaffProfiles = useMemo(() => {
    return staffProfiles.filter((p) => {
      if (selectedOutletId === "all") return true;
      return !p.outlet_id || p.outlet_id === selectedOutletId;
    });
  }, [staffProfiles, selectedOutletId]);

  const dailyStaffSalaryTotal = useMemo(() => {
    return branchStaffProfiles.reduce((sum, p) => {
      const baseDaily = Math.round((p.base_salary || 2000000) / 30);
      const allowDaily = Math.round(p.daily_allowance || 25000);
      return sum + baseDaily + allowDaily;
    }, 0);
  }, [branchStaffProfiles]);

  const currentSalaryPaid = useMemo(() => {
    if (selectedOutletId === "all") {
      return Object.values(salaryPaid).reduce((s, a) => s + Math.round(a), 0);
    }
    return Math.round(salaryPaid[selectedOutletId] || 0);
  }, [salaryPaid, selectedOutletId]);

  const totalSalarySavings = useMemo(() => {
    const totalAccumulated = Math.round(dailyStaffSalaryTotal * operationalDaysWithSales);
    return Math.max(0, Math.round(totalAccumulated - currentSalaryPaid));
  }, [dailyStaffSalaryTotal, operationalDaysWithSales, currentSalaryPaid]);

  const outletCashOutMovements = useMemo(() => {
    const periodFilter = { dateRange };
    return cashMovements.filter((m) => {
      if (m.type !== "out") return false;
      if (!isDateWithinFilter(m.timestamp, periodFilter)) return false;
      if (selectedOutletId === "all") return true;
      return normalizeOrderOutletId(m.outlet_id, outletsList) === selectedOutletId;
    });
  }, [cashMovements, selectedOutletId, outletsList, dateRange]);

  const totalCashOut = useMemo(() => {
    return outletCashOutMovements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  }, [outletCashOutMovements]);

  const totalExpenseAndSalaryPaid = currentSalaryPaid + totalCashOut;

  // 5. Computed Operational Pockets (Proportional to active sales days, capped by remaining cash after BOM & expenses)
  const computedOpPockets = useMemo(() => {
    const availableCashAfterBomAndExpense = Math.max(
      0,
      totalOmzet - totalBomFromSales - totalExpenseAndSalaryPaid,
    );

    const unconstrained = opPockets.map((op) => {
      const days = Math.max(op.days_collected ?? 0, operationalDaysWithSales);
      const dailyTarget =
        Number(op.daily_allocation) || Math.round((Number(op.target_monthly) || 0) / 30);
      const autoEarned = Math.round(days * dailyTarget);
      const manual = Math.round(op.manual_stash || 0);
      const targetAllocation = Math.max(0, Math.round(autoEarned + manual - (op.total_paid || 0)));
      return {
        ...op,
        daily_allocation: dailyTarget,
        effective_days: days,
        target_allocation: targetAllocation,
      };
    });

    const totalTarget = unconstrained.reduce((sum, op) => sum + op.target_allocation, 0);

    // Profit First: Batasi alokasi celengan operasional maksimal 30% dari Laba Kotor berjalan agar laba murni owner terlindungi
    const maxOpCap = Math.round(availableCashAfterBomAndExpense * 0.30);
    const availableForOp = Math.min(availableCashAfterBomAndExpense, maxOpCap);

    // Cap realized balance to availableForOp (max 30% of gross profit) so Card 2 + Card 3 + Card 4 + Card 5 === Card 1
    let allocatedSoFar = 0;
    const positiveIndices = unconstrained
      .map((op, idx) => (op.target_allocation > 0 ? idx : -1))
      .filter((idx) => idx >= 0);
    const lastPositiveIdx =
      positiveIndices.length > 0 ? positiveIndices[positiveIndices.length - 1] : -1;

    return unconstrained.map((op, idx) => {
      let balance = op.target_allocation;
      if (totalTarget > availableForOp && totalTarget > 0) {
        if (idx === lastPositiveIdx) {
          balance = Math.max(0, availableForOp - allocatedSoFar);
        } else {
          balance = Math.round(
            (op.target_allocation / totalTarget) * availableForOp,
          );
          allocatedSoFar += balance;
        }
      }
      return {
        ...op,
        accumulated_balance: balance,
      };
    });
  }, [opPockets, operationalDaysWithSales, totalOmzet, totalBomFromSales, totalExpenseAndSalaryPaid]);

  const totalMonthlyOpTarget = useMemo(() => {
    return computedOpPockets.reduce(
      (sum, op) =>
        sum + (Number(op.target_monthly) || Math.round((Number(op.daily_allocation) || 0) * 30)),
      0,
    );
  }, [computedOpPockets]);

  // 6. Financial KPI Totals (Balanced Zero-Sum Accounting Equation: Card2 + Card3 + Card4 + Card5 = Card1)
  const ownerProfitTransferDeduction = Number(spentAmounts["__owner_profit__"] || 0);
  const emergencyFundTransferDeduction = Number(spentAmounts["__emergency_fund__"] || 0);

  const rawTotalOpSavings = computedOpPockets.reduce((sum, op) => sum + op.accumulated_balance, 0);
  const totalOpSavings = Math.max(0, rawTotalOpSavings - emergencyFundTransferDeduction);

  const baseProfit = Math.max(
    0,
    Math.round(totalOmzet - totalBomFromSales - rawTotalOpSavings - currentSalaryPaid - totalCashOut),
  );
  const labaBersihMurni = Math.max(0, Math.round(baseProfit - ownerProfitTransferDeduction));

  // ACTION: Cairkan Gaji & Tunjangan Tim
  async function handleDisburseSalary() {
    const amt = Number(paySalaryAmount);
    if (amt <= 0) {
      toast.error("Nominal pencairan gaji harus lebih dari 0");
      return;
    }
    if (amt > totalSalarySavings) {
      toast.error(`Nominal melebihi saldo celengan gaji (${formatRupiah(totalSalarySavings)})`);
      return;
    }

    setPayingSalaryLoading(true);
    try {
      const activeOutletKey = selectedOutletId;
      const updatedSalaryPaid = {
        ...salaryPaid,
        [activeOutletKey]: (salaryPaid[activeOutletKey] || 0) + amt,
      };
      setSalaryPaid(updatedSalaryPaid);

      const activeOutletName =
        outletsList.find((o) => o.id === selectedOutletId)?.name || "Semua Cabang (HQ)";

      const newHist: MoneyAllocationHistoryItem = {
        id: `hist-sal-${Date.now()}`,
        outlet_id: selectedOutletId,
        outlet_name: activeOutletName,
        type: "bayar_gaji",
        title: `Pencairan Gaji & Tunjangan Tim (${branchStaffProfiles.length} Karyawan)`,
        amount: amt,
        timestamp: new Date().toISOString(),
        note: paySalaryNote || "Pencairan Gaji & Tunjangan Harian kru cabang",
      };

      const updatedHistory = [newHist, ...history];
      setHistory(updatedHistory);

      await persistSettings(
        packConfigs,
        spentAmounts,
        manualAdded,
        opPockets,
        updatedHistory,
        updatedSalaryPaid,
      );

      toast.success(
        `Berhasil mencairkan ${formatRupiah(amt)} untuk gaji & tunjangan tim ${activeOutletName}!`,
      );
      setPaySalaryModal(false);
      setPaySalaryAmount(0);
      setPaySalaryNote("");
    } catch (err: any) {
      toast.error("Gagal mencairkan celengan gaji", { description: err.message });
    } finally {
      setPayingSalaryLoading(false);
    }
  }

  // ACTION: Add New Inventory Item with Pack Config
  async function handleCreateNewItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) {
      toast.error("Nama bahan baku wajib diisi");
      return;
    }
    setSavingNewItem(true);
    try {
      const bId =
        snapshot?.businessId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
          : "");

      const calculatedUnitCost =
        newItemPackPrice > 0 && newItemPackSize > 0
          ? Math.round(newItemPackPrice / newItemPackSize)
          : 0;

      const created = await createInventoryItem(
        {
          name: newItemName.trim(),
          category: newItemCategory.trim() || "Bahan Baku Kebab",
          unit: newItemUnit.trim() || "pcs",
          stock: Number(newItemInitialStock) || 0,
          minimum_stock: 5,
          cost_price: calculatedUnitCost,
          outlet_id: selectedOutletId === "all" ? null : selectedOutletId,
        },
        bId || undefined,
      );

      // Save pack config
      const updatedConfigs = {
        ...packConfigs,
        [created.id]: {
          pack_size: Number(newItemPackSize) || 1,
          pack_price: Number(newItemPackPrice) || 0,
        },
      };

      setPackConfigs(updatedConfigs);
      await persistSettings(updatedConfigs, spentAmounts, manualAdded, opPockets, history);

      toast.success(
        `Bahan baku "${created.name}" berhasil ditambahkan ke Inventory & Celengan!`,
      );
      setIsAddingItemModal(false);
      setNewItemName("");
      setNewItemInitialStock(0);
      setNewItemPackSize(20);
      setNewItemPackPrice(20000);
      await loadData();
    } catch (err) {
      console.error("[MoneyAllocationPage] Error creating item:", err);
      toast.error("Gagal menambahkan bahan baku");
    } finally {
      setSavingNewItem(false);
    }
  }

  // ACTION: Save Pack Config Edit
  async function handleSavePackConfig() {
    if (!editingPackItem) return;
    const updatedConfigs = {
      ...packConfigs,
      [editingPackItem.id]: {
        pack_size: Number(editPackSize) > 0 ? Number(editPackSize) : 1,
        pack_price: Number(editPackPrice) >= 0 ? Number(editPackPrice) : 0,
      },
    };
    setPackConfigs(updatedConfigs);
    await persistSettings(updatedConfigs, spentAmounts, manualAdded, opPockets, history);
    setEditingPackItem(null);
    toast.success(`Pengaturan kemasan untuk "${editingPackItem.name}" berhasil disimpan!`);
  }

  // ACTION: Belanja Bahan Baku (Deduct Celengan & Record Stock In)
  async function handleExecuteSpend() {
    if (!spendingItem) return;
    const packs = Number(spendPacks);
    if (packs <= 0) {
      toast.error("Jumlah pack belanja minimal 1");
      return;
    }

    const totalCost = spendingItem.pack_price * packs;
    if (spendingItem.accumulated_balance < totalCost) {
      toast.error(
        `Saldo celengan tidak mencukupi! Saldo: ${formatRupiah(spendingItem.accumulated_balance)}, Dibutuhkan: ${formatRupiah(totalCost)}`,
      );
      return;
    }

    setSpendingLoading(true);
    try {
      const addedQuantity = packs * spendingItem.pack_size;

      // 1. Record Real Stock In to Inventory
      await recordStockIn({
        inventory_item_id: spendingItem.item.id,
        quantity: addedQuantity,
        unit_cost: spendingItem.unit_cost,
        notes: `Restock ${packs} Pack dari Celengan Bahan Baku`,
      });

      // 2. Update spent amount for this item
      const updatedSpent = {
        ...spentAmounts,
        [spendingItem.item.id]: (spentAmounts[spendingItem.item.id] || 0) + totalCost,
      };

      // 3. Record History
      const activeOutletName =
        outletsList.find((o) => o.id === selectedOutletId)?.name || "Semua Cabang (HQ)";

      const newHistoryItem: MoneyAllocationHistoryItem = {
        id: `hist-spend-${Date.now()}`,
        outlet_id: selectedOutletId,
        outlet_name: activeOutletName,
        type: "belanja_bahan",
        title: `Belanja ${packs} Pack ${spendingItem.item.name}`,
        amount: totalCost,
        timestamp: new Date().toISOString(),
        note: spendNote || `Restock +${addedQuantity} ${spendingItem.item.unit} ke Inventory`,
      };

      const updatedHistory = [newHistoryItem, ...history];

      setSpentAmounts(updatedSpent);
      setHistory(updatedHistory);
      await persistSettings(packConfigs, updatedSpent, manualAdded, opPockets, updatedHistory);

      setSpendingItem(null);
      setSpendPacks(1);
      setSpendNote("");
      toast.success(
        `🛒 Berhasil belanja! Saldo terpotong ${formatRupiah(totalCost)} & Stok bertambah +${addedQuantity} ${spendingItem.item.unit}`,
      );
      await loadData();
    } catch (err) {
      console.error("[MoneyAllocationPage] Spend error:", err);
      toast.error("Gagal memproses belanja bahan baku");
    } finally {
      setSpendingLoading(false);
    }
  }

  // ACTION: Suntik / Tambah Saldo Celengan Bahan Baku (Owner Top-Up)
  async function handleExecuteTopUp() {
    if (!topUpItem) return;
    const amount = Number(topUpAmount);
    if (amount <= 0) {
      toast.error("Nominal suntik saldo harus lebih dari Rp 0");
      return;
    }

    // Zero-Sum Validation: Reject if amount exceeds source pocket balance
    if (topUpSource === "owner_profit" || topUpSource === "branch_profit") {
      if (amount > labaBersihMurni) {
        toast.error(
          `Nominal (${formatRupiah(amount)}) melebihi sisa Laba Murni Owner yang tersedia (${formatRupiah(labaBersihMurni)})!`,
        );
        return;
      }
    } else if (topUpSource === "emergency_fund") {
      if (amount > totalOpSavings) {
        toast.error(
          `Nominal (${formatRupiah(amount)}) melebihi sisa Dana Darurat/Operasional yang tersedia (${formatRupiah(totalOpSavings)})!`,
        );
        return;
      }
    }

    setTopUpLoading(true);
    try {
      let updatedSpent = { ...spentAmounts };
      if (topUpSource === "owner_profit" || topUpSource === "branch_profit") {
        updatedSpent["__owner_profit__"] = (updatedSpent["__owner_profit__"] || 0) + amount;
      } else if (topUpSource === "emergency_fund") {
        updatedSpent["__emergency_fund__"] = (updatedSpent["__emergency_fund__"] || 0) + amount;
      }

      const updatedManual = {
        ...manualAdded,
        [topUpItem.item.id]: (manualAdded[topUpItem.item.id] || 0) + amount,
      };

      const sourceLabel =
        topUpSource === "owner_capital"
          ? "Uang Pribadi / Suntikan Modal Owner"
          : topUpSource === "branch_profit" || topUpSource === "owner_profit"
            ? "Ambil dari Kantong Profit Owner Cabang Ini"
            : "Ambil dari Dana Darurat Cabang Ini";

      const activeOutletName =
        outletsList.find((o) => o.id === selectedOutletId)?.name || "Semua Cabang (HQ)";

      const newHistoryItem: MoneyAllocationHistoryItem = {
        id: `hist-topup-${Date.now()}`,
        outlet_id: selectedOutletId,
        outlet_name: activeOutletName,
        type: "suntik_saldo",
        title: `+ Tambah Saldo ${topUpItem.item.name}`,
        amount: amount,
        timestamp: new Date().toISOString(),
        note: topUpNote ? `${topUpNote} (${sourceLabel})` : `Sumber: ${sourceLabel}`,
      };

      const updatedHistory = [newHistoryItem, ...history];

      setSpentAmounts(updatedSpent);
      setManualAdded(updatedManual);
      setHistory(updatedHistory);
      await persistSettings(
        packConfigs,
        updatedSpent,
        updatedManual,
        opPockets,
        updatedHistory,
        salaryPaid,
      );

      setTopUpModalOpen(false);
      setTopUpItem(null);
      setTopUpAmount(100000);
      setTopUpNote("");
      toast.success(
        `💰 Berhasil menambah saldo ${formatRupiah(amount)} untuk ${topUpItem.item.name} (${sourceLabel})!`,
      );
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menambah saldo", { description: err.message });
    } finally {
      setTopUpLoading(false);
    }
  }

  // ACTION: Bayar Biaya Operasional
  async function handleExecutePayOp() {
    if (!payOpModal) return;
    const amount = Number(payOpAmount);
    if (amount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari Rp0");
      return;
    }

    if (payOpModal.accumulated_balance < amount) {
      toast.error(
        `Saldo celengan operasional tidak cukup! Saldo: ${formatRupiah(payOpModal.accumulated_balance)}`,
      );
      return;
    }

    const updatedOp = opPockets.map((op) => {
      if (op.id === payOpModal.id) {
        return {
          ...op,
          total_paid: (op.total_paid || 0) + amount,
          last_paid_date: new Date().toISOString().split("T")[0],
        };
      }
      return op;
    });

    const activeOutletName =
      outletsList.find((o) => o.id === selectedOutletId)?.name || "Semua Cabang (HQ)";

    const newHistoryItem: MoneyAllocationHistoryItem = {
      id: `hist-pay-${Date.now()}`,
      outlet_id: selectedOutletId,
      outlet_name: activeOutletName,
      type: "bayar_operasional",
      title: `Bayar ${payOpModal.name}`,
      amount: amount,
      timestamp: new Date().toISOString(),
      note: payOpNote || "Pembayaran pos operasional harian",
    };

    const updatedHistory = [newHistoryItem, ...history];

    setOpPockets(updatedOp);
    setHistory(updatedHistory);
    await persistSettings(packConfigs, spentAmounts, manualAdded, updatedOp, updatedHistory);

    setPayOpModal(null);
    setPayOpAmount(0);
    setPayOpNote("");
    toast.success(`💸 Berhasil potong saldo operasional sebesar ${formatRupiah(amount)}`);
  }

  // ACTION: Tambah Pos Operasional Baru
  async function handleAddOpPocket() {
    if (!newOpName.trim()) {
      toast.error("Nama pos operasional tidak boleh kosong");
      return;
    }
    const newPocket: OperationalExpensePocket = {
      id: `op-${Date.now()}`,
      name: newOpName.trim(),
      category: newOpCategory,
      target_monthly: Number(newOpMonthly) || 300000,
      daily_allocation: Number(newOpDaily) || 10000,
      days_collected: 0,
      accumulated_balance: 0,
      total_paid: 0,
    };

    const updatedOp = [...opPockets, newPocket];
    setOpPockets(updatedOp);
    await persistSettings(packConfigs, spentAmounts, manualAdded, updatedOp, history);

    setIsAddingOp(false);
    setNewOpName("");
    toast.success("Pos celengan operasional berhasil ditambahkan!");
  }

  // ACTION: Hapus Pos Operasional
  async function handleDeleteOpPocket(id: string) {
    const updated = opPockets.filter((p) => p.id !== id);
    setOpPockets(updated);
    await persistSettings(packConfigs, spentAmounts, manualAdded, updated, history);
    toast.success("Pos operasional dihapus");
  }

  return (
    <div className="space-y-6 w-full max-w-none pb-12">
      {/* 1. Header Banner & Filter Outlet */}
      <div className="rounded-[2.2rem] border border-border bg-card/85 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
              <PiggyBank className="size-4" />
              <span>HQ Smart Financial Vault</span>
            </div>
            <h1 className="text-3xl font-black tracking-normal text-foreground">
              Alokasi &amp; Celengan
            </h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Pembagian otomatis omzet ke modal bahan, operasional, dan laba bersih.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Periode Waktu */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-input bg-card px-3 py-1.5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground uppercase">Periode:</span>
              <select
                aria-label="Pilih Periode Akumulasi"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Waktu (Akumulasi Aktif)</option>
                <option value="this_month">Bulan Ini</option>
                <option value="last_7_days">7 Hari Terakhir</option>
                <option value="today">Hari Ini</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-2xl border border-input bg-card px-3 py-1.5 shadow-xs">
              <Store className="size-3.5 text-muted-foreground" />
              <select
                aria-label="Pilih Cabang Outlet"
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Cabang (HQ Consolidate)</option>
                {outletsList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="rounded-2xl"
              onClick={() => {
                loadData();
                if (onRefresh) onRefresh();
              }}
              title="Refresh Data Realtime"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* 2. Top Summary KPI Cards: withhold KPI numbers (render skeleton) until full Promise.all finishes to eliminate flicker */}
        {loading || !hasLoadedData ? (
          <div
            aria-label="Memuat ringkasan KPI alokasi keuangan"
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 border-t border-border/60 pt-5"
          >
            {[0, 1, 2, 3, 4].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="rounded-2xl border border-border/70 bg-muted/35 p-4 shadow-xs animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="h-3.5 w-28 rounded bg-muted-foreground/20" />
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-muted-foreground/15" />
                </div>
                <div className="h-6 w-32 rounded bg-muted-foreground/25" />
                <div className="h-2.5 w-24 rounded bg-muted-foreground/15" />
              </div>
            ))}
          </div>
        ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 border-t border-border/60 pt-5">
          {/* Omzet Masuk */}
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 shadow-xs overflow-hidden">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-muted-foreground leading-snug">1. Total Omzet</span>
              <div className="w-8 h-8 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Receipt className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap font-mono text-foreground">
              {formatRupiah(totalOmzet)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-medium">
              {normalizedSalesOrders.length > 0 ? `${normalizedSalesOrders.length} Transaksi Lunas` : "0 Transaksi"}
            </p>
          </div>

          {/* Tabungan BOM */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-xs overflow-hidden">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-snug">
                2. Celengan Bahan (BOM)
              </span>
              <div className="w-8 h-8 shrink-0 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
                <Boxes className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap font-mono text-amber-600 dark:text-amber-400">
              {formatRupiah(totalBomSavings)}
            </p>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">
              Modal bahan terpakai
            </p>
          </div>

          {/* Tabungan Operasional Harian */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 shadow-xs overflow-hidden">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 leading-snug">
                3. Celengan Operasional
              </span>
              <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                <Zap className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap font-mono text-blue-600 dark:text-blue-400">
              {formatRupiah(totalOpSavings)}
            </p>
            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-400/80 font-medium">
              30% Laba Kotor (Target: {formatRupiah(totalMonthlyOpTarget)}/bln)
            </p>
          </div>

          {/* Kas Keluar & Realisasi Gaji Cair */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 shadow-xs overflow-hidden">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 leading-snug">
                4. Kas &amp; Gaji Keluar
              </span>
              <div className="w-8 h-8 shrink-0 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                <Users className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap font-mono text-purple-600 dark:text-purple-400">
              {formatRupiah(currentSalaryPaid + totalCashOut)}
            </p>
            <p className="mt-1 text-xs text-purple-700/80 dark:text-purple-400/80 font-medium">
              Pengeluaran &amp; gaji cair
            </p>
          </div>

          {/* Laba Bersih Murni Owner */}
          {userRole !== "manager" || managerPermissions?.can_view_owner_net_profit !== false ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-4 shadow-xs overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                  5. Laba Bersih Owner
                </span>
                <div className="w-8 h-8 shrink-0 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400">
                {formatRupiah(labaBersihMurni)}
              </p>
              <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                70% Laba Kotor siap tarik
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-xs overflow-hidden flex flex-col justify-between opacity-70">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground leading-snug">
                  5. Laba Bersih Owner
                </span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground shrink-0">
                  Terkunci
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-muted-foreground">
                🔒 Khusus Hak Akses Owner
              </p>
            </div>
          )}
        </div>
        )}

        {/* Multi-Branch Comparison Cards (HQ Summary View - Strict Per-Branch Isolation) */}
        {!loading && hasLoadedData && selectedOutletId === "all" && outletsList.length > 0 && (
          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Ringkasan per Cabang
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {outletsList.map((out) => {
                const outOrders = normalizedSalesOrders.filter((o) => o.outlet_id === out.id);
                const outBom = estimateOrdersBomMetrics({
                  orders: outOrders,
                  products:
                    menuProducts.length > 0 ? menuProducts : (snapshot?.products || []),
                  menuRecipes,
                  inventoryItems: inventoryList,
                });
                const outRevenue = outBom.totalRevenue;
                const outBomSavings = outBom.totalBomCost;
                const outDays = new Set(
                  outOrders.map((o) => (o.created_at || "").slice(0, 10)),
                ).size;
                const rawOutOpCost = computedOpPockets.reduce(
                  (sum, op) =>
                    sum +
                    Math.round(
                      outDays *
                        (Number(op.daily_allocation) ||
                          Math.round((Number(op.target_monthly) || 0) / 30)),
                    ),
                  0,
                );
                const outSalaryPaid = Math.round(salaryPaid[out.id] || 0);
                const outCashOut = cashMovements
                  .filter(
                    (m) =>
                      m.type === "out" &&
                      normalizeOrderOutletId(m.outlet_id, outletsList) === out.id,
                  )
                  .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
                const outAvailableForOp = Math.max(
                  0,
                  outRevenue - outBomSavings - outSalaryPaid - outCashOut,
                );
                const maxOutOpCap = Math.round(outAvailableForOp * 0.30);
                const effectiveOutOpBudget = Math.min(outAvailableForOp, maxOutOpCap);
                const outOpCost = Math.min(effectiveOutOpBudget, rawOutOpCost);
                const outProfit = Math.max(
                  0,
                  outRevenue - outBomSavings - outOpCost - outSalaryPaid - outCashOut,
                );

                return (
                  <div
                    key={out.id}
                    className="rounded-xl border border-border bg-card p-3.5 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                      <span className="font-black text-xs text-foreground truncate">
                        {out.name}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        {out.code || "CABANG"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-muted-foreground">
                        <span>1. Total Omzet Masuk:</span>
                        <span className="font-semibold text-foreground font-mono">
                          {formatRupiah(outRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>2. Celengan Bahan (BOM):</span>
                        <span className="font-mono font-semibold">
                          -{formatRupiah(outBomSavings)}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>3. Kebutuhan Operasional:</span>
                        <span className="font-mono font-semibold">
                          -{formatRupiah(outOpCost)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border font-bold text-emerald-600 dark:text-emerald-400">
                        <span>4. Estimasi Profit Bersih:</span>
                        <span className="font-mono font-black">{formatRupiah(outProfit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Section 1: Celengan Belanja Bahan Baku (BOM Repurchase Pocket) */}
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-amber-500" />
              <h2 className="text-base font-black text-foreground">
                Celengan Belanja Bahan Baku (Sinkron Inventory HQ)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Terkoneksi langsung ke database <strong>Inventory Management</strong>. Saat menu kebab terjual di POS,
              stok berkurang dan saldo celengan bahan baku otomatis terakumulasi per porsi untuk belanja kembali.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 shrink-0">
            {computedBomPockets.length > 0 && (
              <Button
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5 shadow-brand bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap shrink-0"
                onClick={() => setIsAddingItemModal(true)}
              >
                <PackagePlus className="size-3.5 shrink-0" />
                Tambah Bahan Baku &amp; Setting Kemasan
              </Button>
            )}
            <Badge variant="outline" className="text-xs font-bold font-mono whitespace-nowrap shrink-0">
              Total Saldo BOM: {formatRupiah(totalBomSavings)}
            </Badge>
          </div>
        </div>

        {/* Empty State Jika Inventory Kosong */}
        {computedBomPockets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
            <div className="mx-auto size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              <Boxes className="size-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-sm text-foreground">
                Belum ada bahan baku di Inventory
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Silakan tambah bahan baku terlebih dahulu (otomatis tersimpan ke Inventory HQ &amp; Resep BOM).
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddingItemModal(true)}
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              Tambah Bahan Baku Sekarang
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {computedBomPockets.map((pocket) => (
              <div
                key={pocket.item.id}
                className="rounded-2xl border border-border bg-card/60 hover:bg-card/90 transition-all p-4 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-black text-sm text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{pocket.item.name}</span>
                        {(pocket as any).branchCount > 1 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                            {(pocket as any).branchCount} Cabang
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] font-medium text-muted-foreground block mt-0.5">
                        {formatRupiah(pocket.pack_price)} / {pocket.item.unit || "pack"} • {pocket.item.yield_per_unit || pocket.pack_size || 20} {pocket.item.yield_unit || "pcs"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {pocket.item.stock <= (pocket.item.minimum_stock ?? 5) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          Perlu Restock
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPackItem(pocket.item);
                          setEditPackSize(pocket.pack_size);
                          setEditPackPrice(pocket.pack_price);
                        }}
                        className="text-muted-foreground hover:text-primary p-1 rounded-md"
                        title="Atur Ukuran Kemasan dan Harga Beli"
                      >
                        <Settings className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Saldo Siap Belanja
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                        {formatRupiah(pocket.accumulated_balance)}
                      </span>
                      {pocket.canBuyPacks >= 1 ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          (Cukup beli {pocket.canBuyPacks} {pocket.item.unit || "pack"})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          (Belum cukup 1 {pocket.item.unit || "pack"})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground truncate border-t border-amber-500/15 pt-1.5 flex flex-wrap items-center gap-1.5">
                      <span>Stok: <strong>{pocket.item.stock} {pocket.item.unit}</strong></span>
                      <span>•</span>
                      <span>
                        Terpakai: <strong>{Number(pocket.usedQty.toFixed(3)).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {pocket.item.unit}</strong>
                        {Number(pocket.item.yield_per_unit) > 0 && (
                          <span className="opacity-80"> ({Math.round(pocket.usedQty * Number(pocket.item.yield_per_unit)).toLocaleString("id-ID")} {pocket.item.yield_unit || "pcs"})</span>
                        )}
                      </span>
                      <span>•</span>
                      <span>Belanja: <strong>{formatRupiah(pocket.spent)}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 flex-1"
                    onClick={() => {
                      setTopUpItem(pocket);
                      setTopUpAmount(Math.max(100000, pocket.pack_price - pocket.accumulated_balance));
                      setTopUpModalOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    + Saldo
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold text-xs gap-1 shadow-brand bg-amber-600 hover:bg-amber-700 text-white flex-1"
                    disabled={pocket.accumulated_balance < pocket.pack_price}
                    onClick={() => {
                      setSpendingItem(pocket);
                      setSpendPacks(Math.max(1, Math.min(pocket.canBuyPacks, 1)));
                    }}
                  >
                    <ShoppingCart className="size-3.5" />
                    Restock
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Section 2: Celengan Biaya Operasional Harian (Sewa Kios, Listrik, Parkir) */}
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-blue-500" />
              <h2 className="text-base font-black text-foreground">
                Celengan Biaya Operasional Harian Cabang
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Terkumpul jujur dari omzet harian ({operationalDaysWithSales} hari operasional penjualan aktif).
              Kios, listrik, dan parkir dicadangkan otomatis tanpa mengurangi kas lancar lain.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl font-bold text-xs gap-1"
              onClick={() => setIsAddingOp(!isAddingOp)}
            >
              <Plus className="size-3.5" />
              Tambah Pos Biaya
            </Button>
            <Badge variant="outline" className="text-xs font-bold font-mono">
              Total Saldo: {formatRupiah(totalOpSavings)}
            </Badge>
          </div>
        </div>

        {/* Form Tambah Pos Operasional */}
        {isAddingOp && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
            <h4 className="font-bold text-xs text-blue-700 dark:text-blue-300">
              Buat Pos Celengan Operasional Baru
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Nama Pos Pengeluaran
                </label>
                <Input
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  placeholder="Misal: Sewa Booth Mall / WiFi Cabang"
                  className="rounded-xl text-xs h-9 bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Kategori
                </label>
                <select
                  value={newOpCategory}
                  onChange={(e) => setNewOpCategory(e.target.value as any)}
                  className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-bold"
                >
                  <option value="kios">Sewa Tempat / Kios</option>
                  <option value="listrik">Listrik &amp; Air</option>
                  <option value="parkir">Parkiran &amp; Kebersihan</option>
                  <option value="operasional_lain">Lain-lain</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Target Bulanan (Rp)
                </label>
                <Input
                  type="number"
                  value={newOpMonthly}
                  onChange={(e) => {
                    const m = Number(e.target.value) || 0;
                    setNewOpMonthly(m);
                    setNewOpDaily(Math.round(m / 30));
                  }}
                  className="rounded-xl text-xs h-9 bg-card font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Alokasi per Hari (Rp)
                </label>
                <Input
                  type="number"
                  value={newOpDaily}
                  onChange={(e) => setNewOpDaily(Number(e.target.value))}
                  className="rounded-xl text-xs h-9 bg-card font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setIsAddingOp(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="rounded-xl text-xs font-bold shadow-brand"
                onClick={handleAddOpPocket}
              >
                Simpan Pos
              </Button>
            </div>
          </div>
        )}

        {/* Daftar Celengan Operasional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {computedOpPockets.map((op) => (
            <div
              key={op.id}
              className="rounded-2xl border border-border bg-card/60 hover:bg-card/90 transition-all p-4.5 flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-sm text-foreground truncate">{op.name}</h3>
                    <span className="text-xs font-bold text-muted-foreground">
                      Target: {formatRupiah(op.daily_allocation)} / hari
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOpPocket(op.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                    title="Hapus pos biaya ini"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <div className="mt-4 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">
                      Saldo Celengan Terkumpul:
                    </span>
                    {op.target_monthly && op.accumulated_balance >= op.target_monthly && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        🟢 Siap Bayar Sewa/Tagihan
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                    {formatRupiah(op.accumulated_balance)}
                  </p>

                  {/* Target and Progress Bar */}
                  {op.target_monthly && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                        <span>Target: {formatRupiah(op.target_monthly)}/bln</span>
                        <span>
                          {op.effective_days} Hari
                          ({Math.min(100, Math.round((op.accumulated_balance / op.target_monthly) * 100))}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (op.accumulated_balance / op.target_monthly) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-blue-500/20">
                    <span className="text-xs text-muted-foreground">
                      Dibayar: <strong>{formatRupiah(op.total_paid)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = opPockets.map((p) =>
                          p.id === op.id
                            ? {
                                ...p,
                                manual_stash: (p.manual_stash || 0) + p.daily_allocation,
                                days_collected: (p.days_collected || 0) + 1,
                              }
                            : p,
                        );
                        setOpPockets(updated);
                        await persistSettings(packConfigs, spentAmounts, manualAdded, updated, history);
                        toast.success(`+${formatRupiah(op.daily_allocation)} disisihkan ke ${op.name}!`);
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Sisihkan Jatah Hari Ini
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Terakhir: {op.last_paid_date || "Belum ada pembayaran"}
                </span>
                <Button
                  size="sm"
                  className="rounded-xl font-bold text-xs gap-1.5 shadow-brand bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={op.accumulated_balance <= 0}
                  onClick={() => {
                    setPayOpModal(op);
                    setPayOpAmount(op.accumulated_balance);
                  }}
                >
                  <DollarSign className="size-3.5" />
                  Bayar / Potong
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Section 3: Celengan Gaji & Tunjangan Tim Cabang (Sinkron HR & Absensi) */}
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-purple-500" />
              <h2 className="text-base font-black text-foreground">
                Celengan Gaji &amp; Tunjangan Tim Cabang (Sinkron HR &amp; Roster)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dicadangkan otomatis per hari operasional aktif ({operationalDaysWithSales} hari) berdasarkan data nyata profil gaji &amp; tunjangan karyawan cabang di sistem HR.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              size="sm"
              className="rounded-xl font-bold text-xs gap-1.5 shadow-brand bg-purple-600 hover:bg-purple-700 text-white"
              disabled={totalSalarySavings <= 0}
              onClick={() => {
                setPaySalaryAmount(totalSalarySavings);
                setPaySalaryModal(true);
              }}
            >
              <Banknote className="size-3.5" />
              Cairkan Gaji &amp; Tunjangan Tim
            </Button>
            <Badge variant="outline" className="text-xs font-bold font-mono">
              Saldo Cadangan: {formatRupiah(totalSalarySavings)}
            </Badge>
          </div>
        </div>

        {branchStaffProfiles.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Belum ada data staf/karyawan yang ditugaskan di cabang ini pada modul HR Staff Management.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchStaffProfiles.map((staff) => {
              const baseDaily = Math.round((staff.base_salary || 2000000) / 30);
              const allowDaily = staff.daily_allowance || 25000;
              const totalDaily = baseDaily + allowDaily;
              const accumulated = totalDaily * operationalDaysWithSales;

              return (
                <div
                  key={staff.id}
                  className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground truncate">{staff.full_name}</span>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {staff.role === "manager" ? "Manager" : "Kru / Kasir"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {staff.job_title || "Staf Outlet"} • {staff.outlet_name || "Cabang"}
                    </span>

                    <div className="mt-3 space-y-1 text-[11px] bg-card/60 p-2.5 rounded-xl border border-border/60">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Gaji Pokok:</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatRupiah(staff.base_salary || 2000000)} / bln
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Alokasi Harian (GP/30):</span>
                        <span className="font-mono text-foreground">
                          {formatRupiah(baseDaily)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tunjangan Harian:</span>
                        <span className="font-mono text-foreground">
                          {formatRupiah(allowDaily)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border/50 pt-1 font-bold text-purple-700 dark:text-purple-300">
                        <span>Total Cadangan / Hari:</span>
                        <span className="font-mono">{formatRupiah(totalDaily)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-purple-500/20 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Akumulasi ({operationalDaysWithSales} hari):
                    </span>
                    <span className="font-mono font-black text-purple-700 dark:text-purple-300">
                      {formatRupiah(accumulated)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ringkasan Gaji Cabang */}
        <div className="rounded-2xl bg-muted/40 p-3.5 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-foreground">
              Total Alokasi Gaji Tim Cabang: {formatRupiah(dailyStaffSalaryTotal)} / hari
            </span>
            <p className="text-[11px] text-muted-foreground">
              Total dicadangkan: {formatRupiah(dailyStaffSalaryTotal * operationalDaysWithSales)} • Telah dicairkan: {formatRupiah(currentSalaryPaid)}
            </p>
          </div>
          <div className="font-mono font-black text-sm text-purple-700 dark:text-purple-400">
            Sisa Belum Dicairkan: {formatRupiah(totalSalarySavings)}
          </div>
        </div>
      </div>

      {/* 6. Section 4: Kas Keluar Laci Kasir Cabang (Pengeluaran Langsung di Outlet) */}
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="size-4 text-rose-500" />
              <h2 className="text-base font-black text-foreground">
                🧾 Kas Keluar Laci Kasir Cabang (Pengeluaran Langsung di Outlet)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tercatat langsung oleh kasir dari laci kasir POS saat shift berjalan (petty cash, beli es batu, gas darurat, iuran, dll).
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-bold font-mono">
            Total Kas Keluar: {formatRupiah(totalCashOut)}
          </Badge>
        </div>

        {outletCashOutMovements.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Belum ada pengeluaran kas kecil / kas keluar laci kasir yang dicatat pada cabang ini.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Waktu Transaksi</th>
                  <th className="px-4 py-3">Shift / Kasir</th>
                  <th className="px-4 py-3">Keperluan / Keterangan</th>
                  <th className="px-4 py-3">Cabang Outlet</th>
                  <th className="px-4 py-3 font-mono text-right">Nominal Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {outletCashOutMovements.slice(0, 15).map((cm) => (
                  <tr key={cm.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(cm.timestamp).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {cm.shiftId ? `Shift #${cm.shiftId.slice(-6)}` : "Kasir POS"}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {cm.notes || "Pengeluaran Operasional Kasir"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cm.outlet_name || (outletsList.find((o) => o.id === cm.outlet_id)?.name) || "Cabang Kasir"}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-rose-600 dark:text-rose-400 text-right whitespace-nowrap">
                      - {formatRupiah(cm.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Riwayat Belanja & Pembayaran Celengan */}
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <h2 className="text-base font-black text-foreground">
              Riwayat Transaksi Belanja &amp; Pengeluaran Celengan
            </h2>
          </div>
          <Badge variant="outline" className="text-xs font-bold">
            {history.length} Catatan Transaksi
          </Badge>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Belum ada transaksi belanja bahan baku atau pembayaran operasional dari celengan.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Tipe Celengan</th>
                  <th className="px-4 py-3">Rincian Transaksi</th>
                  <th className="px-4 py-3">Cabang Outlet</th>
                  <th className="px-4 py-3 font-mono text-right">Nominal Dipotong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.slice(0, 15).map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === "belanja_bahan" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-bold uppercase text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Boxes className="size-3" /> Belanja Bahan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 font-bold uppercase text-xs text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <Zap className="size-3" /> Operasional
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-foreground block">{item.title}</span>
                      {item.note && (
                        <span className="text-xs text-muted-foreground">{item.note}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-muted-foreground">
                      {item.outlet_name}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-foreground">
                      -{formatRupiah(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Tambah Bahan Baku Baru */}
      {isAddingItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <PackagePlus className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Tambah Bahan Baku &amp; Setting Kemasan</h3>
                <p className="text-xs text-muted-foreground">
                  Otomatis tersimpan ke Inventory Management HQ dan Resep Menu BOM
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateNewItem} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Nama Bahan Baku *
                </label>
                <Input
                  required
                  placeholder="Misal: Kulit Tortilla, Daging Sapi, Mayo, Makaroni"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Kategori</label>
                  <Input
                    placeholder="Bahan Baku Kebab"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Satuan Pemakaian *
                  </label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="pcs">pcs (Lembar / Biji)</option>
                    <option value="gram">gram (gr)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="ml">ml (Mililiter)</option>
                    <option value="liter">liter</option>
                    <option value="pack">pack</option>
                    <option value="pouch">pouch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Stok Awal Saat Ini
                  </label>
                  <Input
                    type="number"
                    value={newItemInitialStock}
                    onChange={(e) => setNewItemInitialStock(Number(e.target.value))}
                    className="rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Isi per 1 Kemasan Pak *
                  </label>
                  <Input
                    type="number"
                    value={newItemPackSize}
                    onChange={(e) => setNewItemPackSize(Number(e.target.value))}
                    className="rounded-xl text-xs font-mono"
                    placeholder="cth: 20 pcs atau 2000 gram"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Harga 1 Pak Beli (Rp) *
                  </label>
                  <Input
                    type="number"
                    value={newItemPackPrice}
                    onChange={(e) => setNewItemPackPrice(Number(e.target.value))}
                    className="rounded-xl text-xs font-mono font-bold"
                    placeholder="cth: 20000"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold block text-foreground">Kalkulasi Modal Otomatis:</span>
                <p>
                  1 {newItemUnit} ={" "}
                  <strong>
                    {formatRupiah(
                      newItemPackPrice > 0 && newItemPackSize > 0
                        ? Math.round(newItemPackPrice / newItemPackSize)
                        : 0,
                    )}
                  </strong>{" "}
                  disisihkan ke celengan setiap kali porsi terjual.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-xs"
                  onClick={() => setIsAddingItemModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={savingNewItem}
                  className="rounded-xl font-bold shadow-brand text-xs"
                >
                  {savingNewItem ? "Menyimpan..." : "Simpan ke Inventory & Celengan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Atur Ukuran Pak & Harga Beli */}
      {editingPackItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Settings className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Atur Kemasan Beli Bahan Baku</h3>
                <p className="text-xs text-muted-foreground">{editingPackItem.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Isi per 1 Kemasan Pak ({editingPackItem.unit}):
                </label>
                <Input
                  type="number"
                  value={editPackSize}
                  onChange={(e) => setEditPackSize(Number(e.target.value))}
                  className="rounded-xl font-mono text-sm"
                  placeholder="Misal: 20 pcs atau 2000 gram"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Harga Beli per 1 Kemasan Pak (Rp):
                </label>
                <Input
                  type="number"
                  value={editPackPrice}
                  onChange={(e) => setEditPackPrice(Number(e.target.value))}
                  className="rounded-xl font-mono text-sm font-bold"
                  placeholder="Misal: Rp 20.000 atau Rp 100.000"
                />
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                Nilai sisihan per 1 {editingPackItem.unit}:{" "}
                <strong>
                  {formatRupiah(
                    editPackPrice > 0 && editPackSize > 0
                      ? Math.round(editPackPrice / editPackSize)
                      : 0,
                  )}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setEditingPackItem(null)}
              >
                Batal
              </Button>
              <Button
                className="rounded-xl font-bold text-xs shadow-brand bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleSavePackConfig}
              >
                Simpan Pengaturan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Belanja / Potong Saldo Bahan Baku */}
      {spendingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ShoppingCart className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Belanja Bahan Baku (Restock)</h3>
                <p className="text-xs text-muted-foreground">{spendingItem.item.name}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Celengan Terkumpul:</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                  {formatRupiah(spendingItem.accumulated_balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga 1 Kemasan Pak:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatRupiah(spendingItem.pack_price)} ({spendingItem.pack_size} {spendingItem.item.unit})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stok Inventory Saat Ini:</span>
                <span className="font-mono font-bold text-foreground">
                  {spendingItem.item.stock} {spendingItem.item.unit}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Jumlah Pak yang Dibelanjakan:
              </label>
              <Input
                type="number"
                min={1}
                max={Math.max(1, spendingItem.canBuyPacks)}
                value={spendPacks}
                onChange={(e) => setSpendPacks(Number(e.target.value))}
                className="rounded-xl font-mono text-base font-bold"
              />
              <span className="text-xs text-muted-foreground mt-1 block">
                Otomatis menambah <strong>+{spendPacks * spendingItem.pack_size} {spendingItem.item.unit}</strong> ke Inventory Management.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Catatan Pembelian (Opsional):
              </label>
              <Input
                value={spendNote}
                onChange={(e) => setSpendNote(e.target.value)}
                placeholder="Misal: Beli di Agen Pasar Jumat"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex justify-between items-center text-xs">
              <span className="font-bold text-destructive">Total Potong Saldo:</span>
              <span className="font-mono font-black text-destructive text-sm">
                {formatRupiah(spendingItem.pack_price * spendPacks)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setSpendingItem(null)}
              >
                Batal
              </Button>
              <Button
                disabled={spendingLoading}
                className="rounded-xl font-bold shadow-brand bg-amber-600 hover:bg-amber-700 text-white text-xs"
                onClick={handleExecuteSpend}
              >
                {spendingLoading ? "Memproses..." : "Konfirmasi Potong Saldo & Tambah Stok"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Bayar Operasional */}
      {payOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Pembayaran Biaya Operasional</h3>
                <p className="text-xs text-muted-foreground">{payOpModal.name}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Celengan Terkumpul:</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                  {formatRupiah(payOpModal.accumulated_balance)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Nominal yang Dibayarkan (Rp):
              </label>
              <Input
                type="number"
                value={payOpAmount}
                onChange={(e) => setPayOpAmount(Number(e.target.value))}
                className="rounded-xl font-mono text-base font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Keterangan / Nomor Bukti Bayar:
              </label>
              <Input
                value={payOpNote}
                onChange={(e) => setPayOpNote(e.target.value)}
                placeholder="Misal: Tagihan Listrik PLN Bulan Ini"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setPayOpModal(null)}
              >
                Batal
              </Button>
              <Button
                className="rounded-xl font-bold shadow-brand bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={handleExecutePayOp}
              >
                Konfirmasi Potong Saldo Operasional
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Pencairan Gaji & Tunjangan Tim Cabang */}
      {paySalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Banknote className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Pencairan Gaji &amp; Tunjangan Tim</h3>
                <p className="text-xs text-muted-foreground">
                  {outletsList.find((o) => o.id === selectedOutletId)?.name || "Semua Cabang (HQ)"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Celengan Gaji Siap Cair:</span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400">
                  {formatRupiah(totalSalarySavings)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Total Staf di Cabang Ini:</span>
                <span className="font-bold text-foreground">{branchStaffProfiles.length} Karyawan</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Nominal yang Dicairkan (Rp):
              </label>
              <Input
                type="number"
                value={paySalaryAmount}
                onChange={(e) => setPaySalaryAmount(Number(e.target.value))}
                className="rounded-xl font-mono text-base font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Keterangan / Catatan Payroll:
              </label>
              <Input
                value={paySalaryNote}
                onChange={(e) => setPaySalaryNote(e.target.value)}
                placeholder="Misal: Pembayaran Gaji & Tunjangan Periode Minggu Ini"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setPaySalaryModal(false)}
              >
                Batal
              </Button>
              <Button
                disabled={payingSalaryLoading}
                className="rounded-xl font-bold shadow-brand bg-purple-600 hover:bg-purple-700 text-white text-xs"
                onClick={handleDisburseSalary}
              >
                {payingSalaryLoading ? "Memproses..." : "Konfirmasi Pencairan Gaji Tim"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Tambah / Suntik Saldo Bahan Baku (Top-Up Modal) */}
      {topUpModalOpen && topUpItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Suntik / Tambah Saldo Bahan Baku</h3>
                <p className="text-xs text-muted-foreground">{topUpItem.item.name}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo Saat Ini:</span>
                <span className="font-mono font-bold">
                  {formatRupiah(topUpItem.accumulated_balance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga 1 Pack ({topUpItem.item.unit}):</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatRupiah(topUpItem.pack_price)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Sumber Dana:
              </label>
              <select
                value={topUpSource}
                onChange={(e) => setTopUpSource(e.target.value as any)}
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="owner_capital">Uang Pribadi / Suntikan Modal Owner (Injeksi Baru)</option>
                <option value="branch_profit">Ambil dari Kantong Profit Owner Cabang Ini (Tersedia: {formatRupiah(labaBersihMurni)})</option>
                <option value="owner_profit">Ambil dari Saldo Profit Pemilik (Tersedia: {formatRupiah(labaBersihMurni)})</option>
                <option value="emergency_fund">Ambil dari Dana Darurat Cabang Ini (Tersedia: {formatRupiah(totalOpSavings)})</option>
              </select>
              {(topUpSource === "branch_profit" || topUpSource === "owner_profit") && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ Pengalihan internal: Saldo Profit Owner akan otomatis berkurang {formatRupiah(topUpAmount)}.
                </p>
              )}
              {topUpSource === "emergency_fund" && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ⚠️ Pengalihan internal: Saldo Celengan Operasional akan otomatis berkurang {formatRupiah(topUpAmount)}.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Nominal Suntikan Saldo (Rp):
              </label>
              <Input
                type="number"
                min="1000"
                step="10000"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="rounded-xl font-mono text-base font-bold"
              />
              <div className="flex gap-1.5 mt-1.5">
                {[50000, 100000, 200000, 500000].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs rounded-lg px-2 font-mono"
                    onClick={() => setTopUpAmount(v)}
                  >
                    +{formatRupiah(v)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Catatan / Keterangan (Opsional):
              </label>
              <Input
                value={topUpNote}
                onChange={(e) => setTopUpNote(e.target.value)}
                placeholder="Misal: Tambahan modal restock awal bulan"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => {
                  setTopUpModalOpen(false);
                  setTopUpItem(null);
                }}
              >
                Batal
              </Button>
              <Button
                disabled={topUpLoading || topUpAmount <= 0}
                className="rounded-xl font-bold shadow-brand bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                onClick={handleExecuteTopUp}
              >
                {topUpLoading ? "Memproses..." : "Konfirmasi Suntik Saldo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
