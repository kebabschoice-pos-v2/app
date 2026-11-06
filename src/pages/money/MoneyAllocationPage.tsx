import { useState, useEffect, useMemo, useCallback } from "react";
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
import { getComprehensiveAnalytics, type BusinessAnalyticsSummary } from "@/services/reports.service";
import {
  getInventoryItems,
  getStockMovements,
  createInventoryItem,
  recordStockIn,
  type InventoryItemDetail,
  type StockMovementRecord,
} from "@/services/inventory.service";
import { getHRStaffProfiles, type StaffProfile } from "@/services/hr.service";

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
  type: "belanja_bahan" | "bayar_operasional" | "bayar_gaji";
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
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<BusinessAnalyticsSummary | null>(null);

  // Real Inventory & Movement Data
  const [inventoryList, setInventoryList] = useState<InventoryItemDetail[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([]);

  // Dual-Engine: Sales orders & Menu Recipes
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const bId =
        snapshot?.businessId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
          : "");

      // 1. Fetch Real Analytics
      if (bId) {
        const res = await getComprehensiveAnalytics(bId, {
          outletId: selectedOutletId,
          dateRange: "this_month",
        }).catch(() => null);
        if (res) setAnalytics(res);
      }

      // 2. Fetch Real Inventory Items & Movements
      const [invItems, movements, hrProfiles] = await Promise.all([
        getInventoryItems(bId || undefined).catch(() => [] as InventoryItemDetail[]),
        getStockMovements(bId || undefined).catch(() => [] as StockMovementRecord[]),
        getHRStaffProfiles().catch(() => [] as StaffProfile[]),
      ]);

      const filteredInv =
        selectedOutletId === "all"
          ? invItems
          : invItems.filter((i) => !i.outlet_id || i.outlet_id === selectedOutletId);

      setInventoryList(filteredInv);
      setStockMovements(movements);
      setStaffProfiles(hrProfiles);

      // 3. Fetch Real Cash Movements (Type "out" / Petty cash)
      let cmList: CashMovementRecord[] = [];
      try {
        const { data: dbCm } = await supabase
          .from("cash_movements" as any)
          .select("*");
        if (dbCm && Array.isArray(dbCm)) {
          cmList = dbCm.map((m: any) => ({
            id: m.id,
            shiftId: m.shift_id,
            type: (m.type === "in" || m.movement_type === "in") ? "in" : "out",
            amount: Number(m.amount || 0),
            notes: m.notes || m.description || m.reason || "",
            timestamp: m.created_at || m.timestamp || new Date().toISOString(),
            outlet_id: m.outlet_id,
            outlet_name: m.outlet_name,
          }));
        }
      } catch {}

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
      setCashMovements(cmList);

      // 4. Fetch Sales Orders and Items for Dual-Engine BOM Calculation
      let validOrders: any[] = [];
      try {
        const { data: dbOrders } = await supabase
          .from("sales_orders")
          .select("id, outlet_id, status, total, created_at")
          .order("created_at", { ascending: false });

        let dbItems: any[] = [];
        try {
          const { data: itms } = await supabase
            .from("sales_order_items")
            .select("order_id, product_id, name, quantity");
          if (itms) dbItems = itms;
        } catch {}

        const itemsByOrder = new Map<string, any[]>();
        for (const it of dbItems) {
          if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
          itemsByOrder.get(it.order_id)!.push(it);
        }

        for (const ord of dbOrders || []) {
          validOrders.push({
            ...ord,
            items: itemsByOrder.get(ord.id) || [],
          });
        }
      } catch {}

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

      // Filter out void / refunded / cancelled orders
      const cleanOrders = validOrders.filter(
        (o) =>
          o.status !== "void" &&
          o.status !== "void_reversal" &&
          o.status !== "refund" &&
          o.status !== "refunded" &&
          o.status !== "cancelled",
      );
      setSalesOrders(cleanOrders);

      // Fetch recipes
      const recipes: Record<string, any> = {};
      try {
        const { data: outletData } = await supabase.from("outlets").select("settings");
        if (outletData) {
          for (const o of outletData) {
            const s = (o.settings as any) || {};
            if (s.menu_recipes) Object.assign(recipes, s.menu_recipes);
          }
        }
      } catch {}
      setMenuRecipes(recipes);

      // 5. Load persistent configurations (pack configs, expenses, history)
      let loadedConfigs: MoneyAllocationSettings | null = null;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) loadedConfigs = JSON.parse(raw);
        } catch {}
      }

      if (!loadedConfigs && bId) {
        try {
          const { data: outData } = await supabase
            .from("outlets")
            .select("settings")
            .eq("business_id", bId)
            .limit(1)
            .maybeSingle();
          const setObj = (outData?.settings as any) || {};
          if (setObj.money_allocation) loadedConfigs = setObj.money_allocation;
        } catch {}
      }

      if (loadedConfigs) {
        if (loadedConfigs.pack_configs) setPackConfigs(loadedConfigs.pack_configs);
        if (loadedConfigs.spent_amounts) setSpentAmounts(loadedConfigs.spent_amounts);
        if (loadedConfigs.manual_added) setManualAdded(loadedConfigs.manual_added);
        if (loadedConfigs.salary_paid) setSalaryPaid(loadedConfigs.salary_paid);
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
    } catch (err) {
      console.error("[MoneyAllocationPage] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [snapshot?.businessId, selectedOutletId]);

  useEffect(() => {
    loadData();
    const handleInvUpdate = () => loadData();
    window.addEventListener("inventory:updated", handleInvUpdate);
    return () => window.removeEventListener("inventory:updated", handleInvUpdate);
  }, [loadData]);

  // Persist Helper
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
      const bId =
        snapshot?.businessId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_business_id")
          : null);
      if (bId) {
        const { data: outletsData } = await supabase
          .from("outlets")
          .select("id, settings")
          .eq("business_id", bId)
          .limit(1);

        if (outletsData && outletsData[0]) {
          const out = outletsData[0];
          const curr = (out.settings as any) || {};
          await supabase
            .from("outlets")
            .update({
              settings: {
                ...curr,
                money_allocation: payload,
              },
            })
            .eq("id", out.id);
        }
      }
    } catch (e) {
      console.warn("[persistSettings] Supabase save warning:", e);
    }
  }

  // 1. Compute Real Sales Days for Operational Allocation (Strict Non-Void)
  const operationalDaysWithSales = useMemo(() => {
    const salesDates = new Set<string>();
    for (const ord of salesOrders) {
      if (ord.created_at && (!selectedOutletId || selectedOutletId === "all" || ord.outlet_id === selectedOutletId)) {
        salesDates.add(ord.created_at.slice(0, 10));
      }
    }
    return salesDates.size;
  }, [salesOrders, selectedOutletId]);

  // 2. Computed BOM Pockets from Real Inventory Items (DUAL-ENGINE CALCULATION)
  const computedBomPockets = useMemo(() => {
    return inventoryList.map((item) => {
      // Pack Config fallback
      const config = packConfigs[item.id] || {
        pack_size: item.unit === "gram" ? 2000 : item.unit === "ml" ? 1000 : 20,
        pack_price:
          item.cost_price > 0
            ? item.unit === "gram"
              ? item.cost_price * 2000
              : item.cost_price * 20
            : item.unit === "gram"
              ? 100000
              : 20000,
      };

      const pack_size = Number(config.pack_size) > 0 ? Number(config.pack_size) : 1;
      const pack_price =
        Number(config.pack_price) > 0 ? Number(config.pack_price) : item.cost_price * pack_size;
      const unit_cost =
        pack_price > 0 && pack_size > 0 ? pack_price / pack_size : item.cost_price || 0;

      // Engine 1: Real movements of type pos_sale or stock_out for this item
      const itemMovements = stockMovements.filter(
        (m) =>
          m.inventory_item_id === item.id &&
          (m.movement_type === "pos_sale" || m.movement_type === "stock_out") &&
          (selectedOutletId === "all" || !m.outlet_id || m.outlet_id === selectedOutletId),
      );
      const movementUsedQty = itemMovements.reduce(
        (sum, m) => sum + Math.abs(Number(m.quantity) || 0),
        0,
      );

      // Engine 2: Fallback from valid non-void sales orders * menu_recipes
      let recipeBomUsedQty = 0;
      for (const ord of salesOrders) {
        if (selectedOutletId !== "all" && ord.outlet_id && ord.outlet_id !== selectedOutletId) {
          continue;
        }
        if (Array.isArray(ord.items)) {
          for (const line of ord.items) {
            const lineQty = Number(line.quantity) || 1;
            const recipe =
              line.recipe ||
              menuRecipes[line.id] ||
              menuRecipes[line.product_id] ||
              menuRecipes[line.name];
            if (recipe && Array.isArray(recipe.items)) {
              for (const ing of recipe.items) {
                if (
                  ing.inventory_item_id === item.id ||
                  ing.id === item.id ||
                  (ing.name && ing.name.toLowerCase() === item.name.toLowerCase())
                ) {
                  recipeBomUsedQty += (Number(ing.quantity) || 1) * lineQty;
                }
              }
            }
          }
        }
      }

      // Dual-Engine: Maximum of physical recorded movements or formula recipe calculation
      const usedQty = Math.max(movementUsedQty, recipeBomUsedQty);
      const totalEarned = Math.round(usedQty * unit_cost);
      const spent = spentAmounts[item.id] || 0;
      const added = manualAdded[item.id] || 0;
      const accumulated_balance = Math.max(0, totalEarned - spent + added);

      return {
        item,
        pack_size,
        pack_price,
        unit_cost,
        usedQty,
        accumulated_balance,
        canBuyPacks: pack_price > 0 ? Math.floor(accumulated_balance / pack_price) : 0,
      };
    });
  }, [
    inventoryList,
    packConfigs,
    stockMovements,
    selectedOutletId,
    spentAmounts,
    manualAdded,
    salesOrders,
    menuRecipes,
  ]);

  // 3. Computed Operational Pockets (Auto synced with actual operating days with sales)
  const computedOpPockets = useMemo(() => {
    return opPockets.map((op) => {
      const days = Math.max(op.days_collected ?? 0, operationalDaysWithSales);
      const autoEarned = days * (op.daily_allocation || 0);
      const manual = op.manual_stash || 0;
      const balance = Math.max(0, autoEarned + manual - (op.total_paid || 0));

      return {
        ...op,
        effective_days: days,
        accumulated_balance: balance,
      };
    });
  }, [opPockets, operationalDaysWithSales]);

  // 4. Celengan Gaji & Tunjangan Tim Cabang
  const branchStaffProfiles = useMemo(() => {
    return staffProfiles.filter((p) => {
      if (selectedOutletId === "all") return true;
      return !p.outlet_id || p.outlet_id === selectedOutletId;
    });
  }, [staffProfiles, selectedOutletId]);

  const dailyStaffSalaryTotal = useMemo(() => {
    return branchStaffProfiles.reduce((sum, p) => {
      const baseDaily = Math.round((p.base_salary || 2000000) / 30);
      const allowDaily = p.daily_allowance || 25000;
      return sum + baseDaily + allowDaily;
    }, 0);
  }, [branchStaffProfiles]);

  const currentSalaryPaid = useMemo(() => {
    if (selectedOutletId === "all") {
      return Object.values(salaryPaid).reduce((s, a) => s + a, 0);
    }
    return salaryPaid[selectedOutletId] || 0;
  }, [salaryPaid, selectedOutletId]);

  const totalSalarySavings = useMemo(() => {
    const totalAccumulated = dailyStaffSalaryTotal * operationalDaysWithSales;
    return Math.max(0, totalAccumulated - currentSalaryPaid);
  }, [dailyStaffSalaryTotal, operationalDaysWithSales, currentSalaryPaid]);

  // 5. Kas Keluar Laci Kasir Cabang (Petty Cash)
  const outletCashOutMovements = useMemo(() => {
    return cashMovements.filter((m) => {
      if (m.type !== "out") return false;
      if (selectedOutletId === "all") return true;
      return !m.outlet_id || m.outlet_id === selectedOutletId;
    });
  }, [cashMovements, selectedOutletId]);

  const totalCashOut = useMemo(() => {
    return outletCashOutMovements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  }, [outletCashOutMovements]);

  // 6. Financial KPI Totals (Truthful, Zero-Safe & Multi-Pillar)
  const totalOmzet = analytics?.totalRevenue ?? 0;
  const totalBomSavings = computedBomPockets.reduce((sum, b) => sum + b.accumulated_balance, 0);
  const totalOpSavings = computedOpPockets.reduce((sum, op) => sum + op.accumulated_balance, 0);
  const labaBersihMurni = Math.max(
    0,
    totalOmzet - totalBomSavings - totalOpSavings - totalSalarySavings - totalCashOut,
  );

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
              <span>HQ Smart Financial Vault & Discipline System</span>
            </div>
            <h1 className="text-3xl font-black tracking-normal text-foreground">
              Alokasi & Celengan Operasional
            </h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Sinkron 100% dengan stok keluar Inventory dan omzet transaksi POS nyata. Pisahkan dana belanja
              bahan baku (BOM) dan cadangan operasional harian secara otomatis tanpa data dummy.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* 2. Top Summary KPI Cards: Omzet -> (-) BOM -> (-) OP -> (-) Gaji/Kas -> (=) Laba Bersih */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 border-t border-border/60 pt-5">
          {/* Omzet Masuk */}
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">1. Total Omzet Masuk</span>
              <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Receipt className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-foreground">
              {formatRupiah(totalOmzet)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {totalOmzet === 0 ? "Belum ada transaksi di cabang ini" : "Total omzet bersih dari penjualan POS (Non-Void)"}
            </p>
          </div>

          {/* Tabungan BOM */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                2. Celengan Bahan (BOM)
              </span>
              <div className="size-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
                <Boxes className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {formatRupiah(totalBomSavings)}
            </p>
            <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-400/80">
              {totalBomSavings === 0 ? "Otomatis terkumpul dari stok menu terjual" : "Dana siap untuk belanja restock"}
            </p>
          </div>

          {/* Tabungan Operasional Harian */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                3. Celengan Operasional
              </span>
              <div className="size-7 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                <Zap className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {formatRupiah(totalOpSavings)}
            </p>
            <p className="mt-1 text-[10px] text-blue-700/80 dark:text-blue-400/80">
              {operationalDaysWithSales > 0
                ? `${operationalDaysWithSales} hari penjualan aktif (Kios/Listrik/Parkir)`
                : "Rp 0 jika belum ada hari penjualan aktif"}
            </p>
          </div>

          {/* Celengan Gaji & Kas Keluar Kasir */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                4. Gaji &amp; Kas Keluar
              </span>
              <div className="size-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                <Users className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
              {formatRupiah(totalSalarySavings + totalCashOut)}
            </p>
            <p className="mt-1 text-[10px] text-purple-700/80 dark:text-purple-400/80">
              Gaji: {formatRupiah(totalSalarySavings)} | Kasir: {formatRupiah(totalCashOut)}
            </p>
          </div>

          {/* Laba Bersih Murni Owner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                5. Sisa Laba Murni Owner
              </span>
              <div className="size-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatRupiah(labaBersihMurni)}
            </p>
            <p className="mt-1 text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
              Bersih setelah BOM, OP, Gaji &amp; Kas Keluar Kasir
            </p>
          </div>
        </div>
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
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              size="sm"
              className="rounded-xl font-bold text-xs gap-1.5 shadow-brand bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setIsAddingItemModal(true)}
            >
              <PackagePlus className="size-3.5" />
              + Tambah Bahan Baku & Setting Kemasan
            </Button>
            <Badge variant="outline" className="text-xs font-bold font-mono">
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
              + Tambah Bahan Baku Sekarang
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {computedBomPockets.map((pocket) => (
              <div
                key={pocket.item.id}
                className="rounded-2xl border border-border bg-card/60 hover:bg-card/90 transition-all p-4.5 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-black text-sm text-foreground truncate">
                        {pocket.item.name}
                      </h3>
                      <span className="text-[10px] font-bold text-muted-foreground block">
                        Kemasan {pocket.pack_size} {pocket.item.unit} / Pack · {formatRupiah(pocket.pack_price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        Stok: {pocket.item.stock} {pocket.item.unit}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPackItem(pocket.item);
                          setEditPackSize(pocket.pack_size);
                          setEditPackPrice(pocket.pack_price);
                        }}
                        className="text-muted-foreground hover:text-primary p-1 rounded-md"
                        title="Atur Ukuran Kemasan & Harga Beli"
                      >
                        <Settings className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block">
                        Saldo Celengan Terkumpul:
                      </span>
                      {pocket.canBuyPacks >= 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          🟢 Siap Belanja {pocket.canBuyPacks} Pak
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                      {formatRupiah(pocket.accumulated_balance)}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>
                        Keluar: <strong>{pocket.usedQty} {pocket.item.unit}</strong>
                      </span>
                      <span>
                        Modal: <strong>{formatRupiah(pocket.unit_cost)} / {pocket.item.unit}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Cukup {pocket.canBuyPacks} pak
                  </span>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold text-xs gap-1.5 shadow-brand bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={pocket.accumulated_balance < pocket.pack_price}
                    onClick={() => {
                      setSpendingItem(pocket);
                      setSpendPacks(Math.max(1, Math.min(pocket.canBuyPacks, 1)));
                    }}
                  >
                    <ShoppingCart className="size-3.5" />
                    Belanja / Potong Saldo
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
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">
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
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">
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
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">
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
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">
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
                    <span className="text-[10px] font-bold text-muted-foreground">
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
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block">
                      Saldo Celengan Terkumpul:
                    </span>
                    {op.target_monthly && op.accumulated_balance >= op.target_monthly && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
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
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
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
                    <span className="text-[10px] text-muted-foreground">
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
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Sisihkan Jatah Hari Ini
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
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
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {staff.role === "manager" ? "Manager" : "Kru / Kasir"}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
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
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-bold uppercase text-[10px] text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Boxes className="size-3" /> Belanja Bahan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 font-bold uppercase text-[10px] text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <Zap className="size-3" /> Operasional
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-foreground block">{item.title}</span>
                      {item.note && (
                        <span className="text-[10px] text-muted-foreground">{item.note}</span>
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
              <span className="text-[10px] text-muted-foreground mt-1 block">
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
    </div>
  );
}
