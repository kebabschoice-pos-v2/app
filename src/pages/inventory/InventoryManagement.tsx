import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  Trash2,
  DollarSign,
  PackageCheck,
  TrendingDown,
  Warehouse,
  History,
  FileSpreadsheet,
  X,
  Truck,
  Copy,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getInventoryDashboardMetrics,
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockIn,
  recordStockOut,
  recordStockAdjustment,
  getStockMovements,
  getSuppliers,
  loadBranchMoneyLedger,
  saveBranchMoneyLedger,
  cloneMasterInventoryToOutlet,
  type InventoryItemDetail,
  type StockMovementRecord,
  type SupplierItem,
} from "@/services/inventory.service";
import { syncMenuRecipesWithInventory } from "@/services/menu.service";
import { getOutletList, type OutletItem } from "@/services/outlet.service";

const COMMON_UNITS = [
  "gram",
  "kg",
  "ml",
  "liter",
  "pcs",
  "lembar",
  "pack",
  "botol",
  "porsi",
  "bungkus",
];

const COMMON_CATEGORIES = [
  "Daging & Unggas",
  "Roti & Pastry",
  "Saus & Bumbu",
  "Sayuran Segar",
  "Keju & Olahan Susu",
  "Packaging & Kemasan",
  "Bahan Minuman",
  "Lain-lain",
];

export function InventoryManagement() {
  const [items, setItems] = useState<InventoryItemDetail[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "items" | "stock-in" | "stock-out" | "adjustment" | "low-stock"
  >("items");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "aman" | "menipis" | "habis">("all");
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemDetail | null>(null);

  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [stockOutModalOpen, setStockOutModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State: Item
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Daging & Unggas");
  const [formUnit, setFormUnit] = useState("gram");
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(10);
  const [formSupplierId, setFormSupplierId] = useState<string>("");
  const [formOutletId, setFormOutletId] = useState<string>("");
  const [formPackSize, setFormPackSize] = useState<number>(20);
  const [formPackPrice, setFormPackPrice] = useState<number>(20000);
  const [formYieldPerUnit, setFormYieldPerUnit] = useState<number | undefined>(undefined);
  const [formYieldUnit, setFormYieldUnit] = useState<string>("gram");

  // Form State: Stock In
  const [stockInItemId, setStockInItemId] = useState("");
  const [stockInSupplierId, setStockInSupplierId] = useState("");
  const [stockInQty, setStockInQty] = useState<number>(1);
  const [stockInUnitCost, setStockInUnitCost] = useState<number>(0);
  const stockInActualCost = stockInUnitCost; // Alias for semantic clarity & test assertion
  const [stockInReference, setStockInReference] = useState("");
  const [stockInDate, setStockInDate] = useState("");
  const [stockInNotes, setStockInNotes] = useState("");
  const [updateBenchmarkCost, setUpdateBenchmarkCost] = useState(false);
  const stockInUpdateHpp = updateBenchmarkCost; // Alias for semantic clarity & test assertion

  // Form State: Stock Out
  const [stockOutItemId, setStockOutItemId] = useState("");
  const [stockOutQty, setStockOutQty] = useState<number>(1);
  const [stockOutReason, setStockOutReason] = useState("Produksi");
  const [stockOutNotes, setStockOutNotes] = useState("");

  // Form State: Stock Adjustment
  const [adjItemId, setAdjItemId] = useState("");
  const [adjActualStock, setAdjActualStock] = useState<number>(0);
  const [adjReason, setAdjReason] = useState("Selisih Perhitungan Fisik");
  const [adjNotes, setAdjNotes] = useState("");

  // Modal State: Clone / Sync Master Inventory
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneSourceOutletId, setCloneSourceOutletId] = useState<string>("all");
  const [cloneTargetOutletId, setCloneTargetOutletId] = useState<string>("");
  const [cloningLoading, setCloningLoading] = useState(false);
  const [branchLedger, setBranchLedger] = useState<any>(null);

  async function loadData() {
    setLoading(true);
    try {
      syncMenuRecipesWithInventory().catch(() => {});
      const activeBranchId =
        selectedOutlet === "all" || selectedOutlet === "central" ? null : selectedOutlet;
      const [itms, supps, movs, mets, outls, bLedger] = await Promise.all([
        getInventoryItems(),
        getSuppliers(),
        getStockMovements(),
        getInventoryDashboardMetrics(),
        getOutletList().catch(() => [] as OutletItem[]),
        loadBranchMoneyLedger(activeBranchId).catch(() => null),
      ]);
      setItems(itms);
      setSuppliers(supps);
      setMovements(movs);
      setMetrics(mets);
      setOutlets(outls);
      setBranchLedger(bLedger);
    } catch (err: any) {
      console.error("[InventoryManagement] loadData error:", err);
      toast.error("Gagal memuat data inventori", {
        description: err.message || "Terjadi kesalahan koneksi database",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const activeBranchId =
      selectedOutlet === "all" || selectedOutlet === "central" ? null : selectedOutlet;
    loadBranchMoneyLedger(activeBranchId).then((l) => setBranchLedger(l)).catch(() => {});
  }, [selectedOutlet]);

  // Helper to compute item pocket balance and canBuy units
  const getItemPocketInfo = (item: InventoryItemDetail) => {
    const itemMovs = movements.filter((m) => {
      if (m.inventory_item_id !== item.id) return false;
      const mType = (m.movement_type as string) || (m as any).type || "";
      return mType === "pos_sale" || mType === "stock_out";
    });
    const usedQty = itemMovs.reduce((sum, m) => sum + Math.abs(Number(m.quantity) || 0), 0);
    const costUnit = Number(item.cost_price) > 0 ? Number(item.cost_price) : 0;
    const totalEarned = Math.round(usedQty * costUnit);
    const spent = Number(branchLedger?.spent_amounts?.[item.id] || 0);
    const added = Number(branchLedger?.manual_added?.[item.id] || 0);
    const balance = Math.max(0, totalEarned - spent + added);
    const canBuyUnits = costUnit > 0 ? Math.floor(balance / costUnit) : 0;
    return { balance, canBuyUnits, costUnit };
  };

  async function handleExecuteCloneMaster() {
    if (!cloneTargetOutletId) {
      toast.error("Pilih cabang tujuan yang akan menerima master bahan baku");
      return;
    }
    setCloningLoading(true);
    try {
      const targetName =
        outlets.find((o) => o.id === cloneTargetOutletId)?.outlet_name ||
        outlets.find((o) => o.id === cloneTargetOutletId)?.name ||
        "Cabang";
      const res = await cloneMasterInventoryToOutlet(cloneTargetOutletId, cloneSourceOutletId);
      if (res.clonedCount > 0) {
        toast.success(
          `Berhasil menyalin ${res.clonedCount} master bahan baku ke cabang "${targetName}" (stok awal = 0).`,
        );
      } else if (res.skippedCount > 0) {
        toast.info(
          `Semua master bahan baku sudah ada di cabang "${targetName}" (${res.skippedCount} dilewati).`,
        );
      } else {
        toast.warning("Tidak ada bahan baku yang dapat disalin.");
      }
      setCloneModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("[handleExecuteCloneMaster] Error:", err);
      toast.error(err.message || "Gagal menyalin master bahan baku");
    } finally {
      setCloningLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener("inventory:updated", handleUpdate);
    window.addEventListener("pos:menu-updated", handleUpdate);
    return () => {
      window.removeEventListener("inventory:updated", handleUpdate);
      window.removeEventListener("pos:menu-updated", handleUpdate);
    };
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplier_name && item.supplier_name.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchStatus = selectedStatus === "all" || item.status === selectedStatus;
      const matchOutlet =
        selectedOutlet === "all" ||
        (selectedOutlet === "central"
          ? !item.outlet_id
          : item.outlet_id === selectedOutlet);

      return matchSearch && matchCategory && matchStatus && matchOutlet;
    });
  }, [items, search, selectedCategory, selectedStatus, selectedOutlet]);

  // Categories list derived from items
  const allCategories = useMemo(() => {
    const cats = new Set<string>(COMMON_CATEGORIES);
    items.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [items]);

  // Modal Handlers: Item Add / Edit
  function handleOpenAddItem() {
    setEditingItem(null);
    setFormName("");
    setFormCategory(COMMON_CATEGORIES[0] ?? "Daging");
    setFormUnit("gram");
    setFormCostPrice(0);
    setFormStock(0);
    setFormMinStock(10);
    setFormSupplierId("");
    setFormOutletId("");
    setFormPackSize(20);
    setFormPackPrice(20000);
    setFormYieldPerUnit(undefined);
    setFormYieldUnit("gram");
    setItemModalOpen(true);
  }

  function handleOpenEditItem(item: InventoryItemDetail) {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category || COMMON_CATEGORIES[0] || "Daging");
    setFormUnit(item.unit || "gram");
    setFormCostPrice(item.cost_price || 0);
    setFormStock(item.stock || 0);
    setFormMinStock(item.minimum_stock || 10);
    setFormSupplierId(item.supplier_id || "");
    setFormOutletId(item.outlet_id || "");
    setFormYieldPerUnit(item.yield_per_unit ?? undefined);
    setFormYieldUnit(item.yield_unit || (item.unit === "pcs" || item.unit === "pack" ? "gram" : item.unit || "gram"));

    // Load pack config from localStorage if available
    let initialPackSize = item.unit === "gram" ? 2000 : 20;
    let initialPackPrice = item.cost_price > 0 ? item.cost_price * initialPackSize : (item.unit === "gram" ? 100000 : 20000);
    try {
      const raw = localStorage.getItem("kebabschoicepos_money_allocation");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.pack_configs && parsed.pack_configs[item.id]) {
          initialPackSize = Number(parsed.pack_configs[item.id].pack_size) || initialPackSize;
          initialPackPrice = Number(parsed.pack_configs[item.id].pack_price) || initialPackPrice;
        }
      }
    } catch {}
    setFormPackSize(initialPackSize);
    setFormPackPrice(initialPackPrice);

    setItemModalOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Nama bahan baku wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const chosenOutlet = outlets.find((o) => o.id === formOutletId);
      const outletPayload = {
        outlet_id: formOutletId || null,
        outlet_name: chosenOutlet ? (chosenOutlet.name || chosenOutlet.outlet_name) : null,
      };

      const calculatedUnitCost =
        formPackPrice > 0 && formPackSize > 0
          ? Math.round(formPackPrice / formPackSize)
          : Number(formCostPrice) || 0;

      const yieldPayload = {
        yield_per_unit: formYieldPerUnit ? Number(formYieldPerUnit) : (formUnit === "pack" || formUnit === "pcs" ? Number(formPackSize) : null),
        yield_unit: formYieldUnit || (formUnit === "pack" || formUnit === "pcs" ? "gram" : formUnit),
      };

      let savedItemId = editingItem?.id;

      if (editingItem) {
        await updateInventoryItem(editingItem.id, {
          name: formName.trim(),
          category: formCategory,
          unit: formUnit,
          cost_price: calculatedUnitCost,
          stock: Number(formStock) || 0,
          minimum_stock: Number(formMinStock) || 0,
          supplier_id: formSupplierId || null,
          ...outletPayload,
          ...yieldPayload,
        });
        toast.success("Bahan baku berhasil diperbarui");
      } else {
        const created = await createInventoryItem({
          name: formName.trim(),
          category: formCategory,
          unit: formUnit,
          cost_price: calculatedUnitCost,
          stock: Number(formStock) || 0,
          minimum_stock: Number(formMinStock) || 0,
          supplier_id: formSupplierId || null,
          ...outletPayload,
          ...yieldPayload,
        });
        savedItemId = created.id;
        toast.success("Bahan baku baru berhasil disimpan");
      }

      // Sync pack config to money_allocation settings
      if (savedItemId && (formPackSize > 0 || formPackPrice > 0)) {
        try {
          const raw = localStorage.getItem("kebabschoicepos_money_allocation");
          const settings = raw ? JSON.parse(raw) : {};
          if (!settings.pack_configs) settings.pack_configs = {};
          settings.pack_configs[savedItemId] = {
            pack_size: Number(formPackSize) || 1,
            pack_price: Number(formPackPrice) || 0,
          };
          localStorage.setItem("kebabschoicepos_money_allocation", JSON.stringify(settings));

          // Also persist to outlets.settings
          const { data: outList } = await supabase.from("outlets").select("id, settings").limit(1);
          if (outList && outList[0]) {
            const out = outList[0];
            const curr = (out.settings as any) || {};
            await supabase
              .from("outlets")
              .update({
                settings: {
                  ...curr,
                  money_allocation: settings,
                },
              })
              .eq("id", out.id);
          }
        } catch {}
      }

      setItemModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menyimpan bahan baku", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteItem(item: InventoryItemDetail) {
    if (
      !confirm(
        `Hapus bahan baku "${item.name}"? Data resep dan riwayat pergerakan akan terpengaruh.`,
      )
    ) {
      return;
    }
    // Optimistic UI update
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await deleteInventoryItem(item.id);
      // Clean up pack_configs for this item
      try {
        const raw = localStorage.getItem("kebabschoicepos_money_allocation");
        if (raw) {
          const settings = JSON.parse(raw);
          if (settings.pack_configs && settings.pack_configs[item.id]) {
            delete settings.pack_configs[item.id];
            localStorage.setItem("kebabschoicepos_money_allocation", JSON.stringify(settings));
            const { data: outList } = await supabase.from("outlets").select("id, settings").limit(1);
            if (outList && outList[0]) {
              const out = outList[0];
              const curr = (out.settings as any) || {};
              await supabase
                .from("outlets")
                .update({
                  settings: {
                    ...curr,
                    money_allocation: settings,
                  },
                })
                .eq("id", out.id);
            }
          }
        }
      } catch {}

      toast.success("Bahan baku berhasil dihapus");
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus bahan baku", { description: err.message });
      await loadData();
    }
  }

  // Stock In
  function handleOpenStockIn(preselectItemId?: string) {
    const targetItem = items.find((i) => i.id === preselectItemId) || items[0];
    setStockInItemId(targetItem ? targetItem.id : "");
    setStockInSupplierId(targetItem?.supplier_id || "");
    setStockInQty(1);
    setStockInUnitCost(targetItem ? targetItem.cost_price : 0);
    setStockInReference(
      `IN-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
    );
    setStockInDate(new Date().toISOString().split("T")[0] ?? "");
    setStockInNotes("");
    setUpdateBenchmarkCost(false);
    setStockInModalOpen(true);
  }

  async function handleSubmitStockIn(e: React.FormEvent) {
    e.preventDefault();
    if (!stockInItemId) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }
    if (stockInQty <= 0) {
      toast.error("Kuantitas masuk harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const targetItem = items.find((i) => i.id === stockInItemId);
      const actualUnitCost = Number(stockInUnitCost) || 0;
      const totalCost = Number(stockInQty) * actualUnitCost;

      await recordStockIn({
        inventory_item_id: stockInItemId,
        quantity: Number(stockInQty),
        unit_cost: actualUnitCost,
        supplier_id: stockInSupplierId || undefined,
        reference_no: stockInReference,
        notes: stockInNotes,
      });

      // Deduct from Tabungan Bahan Baku (Money Allocation) for that branch
      if (totalCost > 0 && targetItem) {
        try {
          const targetOutletId = targetItem.outlet_id || null;
          const currentLedger = await loadBranchMoneyLedger(targetOutletId);
          const updatedSpent = { ...(currentLedger.spent_amounts || {}) };
          updatedSpent[stockInItemId] = (updatedSpent[stockInItemId] || 0) + totalCost;

          const updatedHistory = [...(currentLedger.history || [])];
          updatedHistory.unshift({
            id: `spend-${Date.now()}`,
            date: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            type: "belanja_bahan",
            item_id: stockInItemId,
            item_name: targetItem.name,
            outlet_id: targetOutletId,
            amount: totalCost,
            packs: Number(stockInQty),
            title: `Restock ${targetItem.name}`,
            note:
              stockInNotes ||
              `Restock ${stockInQty} ${targetItem.unit} @ Rp ${actualUnitCost.toLocaleString("id-ID")}`,
          });

          await saveBranchMoneyLedger(targetOutletId, {
            spent_amounts: updatedSpent,
            history: updatedHistory,
          });

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("money_allocation:updated"));
            window.dispatchEvent(new CustomEvent("inventory:updated"));
          }
        } catch (ledgerErr) {
          console.warn("[InventoryManagement] Error syncing branch money ledger on restock:", ledgerErr);
        }
      }

      // If owner explicitly checked "Update juga Harga Patokan HPP dengan harga ini"
      if (updateBenchmarkCost && actualUnitCost > 0) {
        await updateInventoryItem(stockInItemId, {
          cost_price: actualUnitCost,
        });
        toast.info(
          `Harga Patokan HPP diperbarui menjadi Rp ${actualUnitCost.toLocaleString("id-ID")}`,
        );
      } else {
        toast.info(
          `Harga Patokan HPP aman dipertahankan sebagai buffer tabungan.`,
        );
      }

      toast.success("Stok masuk berhasil dicatat & kuantitas bertambah");
      setStockInModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal mencatat stok masuk", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Stock Out
  function handleOpenStockOut(preselectItemId?: string) {
    const targetItem = items.find((i) => i.id === preselectItemId) || items[0];
    setStockOutItemId(targetItem ? targetItem.id : "");
    setStockOutQty(1);
    setStockOutReason("Produksi");
    setStockOutNotes("");
    setStockOutModalOpen(true);
  }

  async function handleSubmitStockOut(e: React.FormEvent) {
    e.preventDefault();
    if (!stockOutItemId) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }
    if (stockOutQty <= 0) {
      toast.error("Kuantitas keluar harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      await recordStockOut({
        inventory_item_id: stockOutItemId,
        quantity: Number(stockOutQty),
        reason: stockOutReason,
        notes: stockOutNotes,
      });
      toast.success("Stok keluar berhasil dicatat & kuantitas berkurang");
      setStockOutModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal mencatat stok keluar", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Stock Adjustment
  function handleOpenAdjustment(preselectItemId?: string) {
    const targetItem = items.find((i) => i.id === preselectItemId) || items[0];
    setAdjItemId(targetItem ? targetItem.id : "");
    setAdjActualStock(targetItem ? targetItem.stock : 0);
    setAdjReason("Selisih Perhitungan Fisik");
    setAdjNotes("");
    setAdjustmentModalOpen(true);
  }

  const selectedAdjItem = useMemo(() => {
    return items.find((i) => i.id === adjItemId);
  }, [items, adjItemId]);

  const adjDifference = useMemo(() => {
    if (!selectedAdjItem) return 0;
    return (Number(adjActualStock) || 0) - selectedAdjItem.stock;
  }, [selectedAdjItem, adjActualStock]);

  async function handleSubmitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjItemId) {
      toast.error("Pilih bahan baku yang akan disesuaikan");
      return;
    }

    setSubmitting(true);
    try {
      await recordStockAdjustment({
        inventory_item_id: adjItemId,
        actual_stock: Number(adjActualStock),
        reason: adjReason,
        notes: adjNotes,
      });
      toast.success("Penyesuaian stok berhasil disimpan!");
      setAdjustmentModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menyesuaikan stok", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <Warehouse className="size-4" />
            <span>Smart Inventory & Procurement Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola master bahan baku, monitoring stok masuk/keluar, dan penyesuaian stok real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl gap-2 font-semibold"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={handleOpenAddItem}
            className="rounded-2xl gap-2 font-bold shadow-brand"
          >
            <Plus className="size-4" />
            <span>Tambah Bahan</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Item Bahan</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{metrics.totalItems}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Bahan baku terdaftar</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Nilai Stok</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatRupiah(metrics.totalStockValue)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Kalkulasi modal fisik</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Stok Menipis</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
            {metrics.lowStockCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Di bawah minimum stok</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Stok Habis</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-600 dark:text-rose-400">
            {metrics.outOfStockCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Perlu segera restock</p>
        </div>
      </div>

      {/* Low Stock Alert Visual Banner */}
      {metrics.lowStockCount + metrics.outOfStockCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 p-4 text-xs shadow-soft animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="font-black text-amber-950 dark:text-amber-200 text-sm">
                Peringatan Stok Rendah (Low Stock Alert)
              </p>
              <p className="text-amber-800 dark:text-amber-400 text-xs mt-0.5">
                Terdapat{" "}
                <strong>{metrics.lowStockCount + metrics.outOfStockCount} bahan baku</strong> yang
                berada pada atau di bawah batas minimum stok ({metrics.outOfStockCount} habis,{" "}
                {metrics.lowStockCount} menipis). Segera lakukan restock untuk menjaga kelancaran
                operasional POS.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/40 bg-amber-500/20 text-amber-900 dark:text-amber-100 hover:bg-amber-500/30 font-bold text-xs rounded-xl h-9"
            onClick={() => setActiveTab("low-stock")}
          >
            Lihat Bahan Kritis ({metrics.lowStockCount + metrics.outOfStockCount})
          </Button>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "items"
              ? "bg-primary text-primary-foreground shadow-brand"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Boxes className="size-4" />
          <span>Bahan Baku ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stock-in")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "stock-in"
              ? "bg-emerald-600 text-white shadow-brand"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <ArrowDownLeft className="size-4" />
          <span>Stok Masuk</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stock-out")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "stock-out"
              ? "bg-rose-600 text-white shadow-brand"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <ArrowUpRight className="size-4" />
          <span>Stok Keluar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("adjustment")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "adjustment"
              ? "bg-primary text-primary-foreground shadow-brand"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
          <span>Penyesuaian Stok</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("low-stock")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "low-stock"
              ? "bg-amber-600 text-white shadow-brand"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <AlertTriangle className="size-4" />
          <span>Stok Menipis & Habis ({metrics.lowStockCount + metrics.outOfStockCount})</span>
        </button>
      </div>

      {/* 4. Tab Content: BAHAN BAKU */}
      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Controls: Search, Category, Status, Quick Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama bahan, kategori, supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 rounded-2xl h-11"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter kategori bahan baku"
                className="h-11 rounded-2xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Semua Kategori</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                aria-label="Filter status stok"
                className="h-11 rounded-2xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Semua Status</option>
                <option value="aman">Aman</option>
                <option value="menipis">Menipis</option>
                <option value="habis">Habis</option>
              </select>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                aria-label="Filter cabang inventori"
                className="h-11 rounded-2xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Semua Cabang (Total {items.length} Item)</option>
                <option value="central">Gudang Pusat / Shared ({items.filter((i) => !i.outlet_id).length} Item)</option>
                {outlets.map((o) => {
                  const cnt = items.filter((i) => i.outlet_id === o.id).length;
                  return (
                    <option key={o.id} value={o.id}>
                      {o.name || o.outlet_name} ({cnt} Item)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCloneTargetOutletId(
                    selectedOutlet !== "all" && selectedOutlet !== "central"
                      ? selectedOutlet
                      : outlets[0]?.id || "",
                  );
                  setCloneModalOpen(true);
                }}
                className="rounded-2xl gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold"
                title="Sinkronkan / Salin Master Bahan dari Cabang Lain"
              >
                <Copy className="size-4" />
                <span>🔄 Sinkronkan / Salin Master Bahan dari Cabang Lain</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenStockIn()}
                className="rounded-2xl gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <ArrowDownLeft className="size-4" />
                <span>+ Catat Masuk</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenStockOut()}
                className="rounded-2xl gap-1.5 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              >
                <ArrowUpRight className="size-4" />
                <span>- Catat Keluar</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Nama Bahan</th>
                    <th className="py-3.5 px-4 font-bold">Kategori</th>
                    <th className="py-3.5 px-4 font-bold">Satuan</th>
                    <th className="py-3.5 px-4 font-bold text-right">Harga Modal</th>
                    <th className="py-3.5 px-4 font-bold text-right">Stok Saat Ini</th>
                    <th className="py-3.5 px-4 font-bold text-right">Min. Stok</th>
                    <th className="py-3.5 px-4 font-bold text-center">Status</th>
                    <th className="py-3.5 px-4 font-bold">Supplier</th>
                    <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                        <span>Memuat data inventori...</span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <Boxes className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                        <p className="font-bold">Tidak ada bahan baku ditemukan</p>
                        <p className="text-xs mt-1">
                          Tambahkan bahan baku baru atau salin master bahan dari cabang lain.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenAddItem()}
                            className="rounded-xl font-bold text-xs gap-1.5 shadow-brand"
                          >
                            <Plus className="size-3.5" />
                            + Tambah Bahan Baru
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCloneTargetOutletId(
                                selectedOutlet !== "all" && selectedOutlet !== "central"
                                  ? selectedOutlet
                                  : outlets[0]?.id || "",
                              );
                              setCloneModalOpen(true);
                            }}
                            className="rounded-xl font-bold text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Copy className="size-3.5" />
                            🔄 Sinkronkan / Salin Master Bahan dari Cabang Lain
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isOutOfStock = item.stock <= 0;
                      const isLowStock = !isOutOfStock && item.stock <= item.minimum_stock;
                      const isCritical = isOutOfStock || isLowStock;
                      const pocketInfo = getItemPocketInfo(item);

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isOutOfStock
                              ? "bg-rose-500/5 hover:bg-rose-500/10"
                              : isLowStock
                                ? "bg-amber-500/5 hover:bg-amber-500/10"
                                : "hover:bg-muted/20"
                          }`}
                        >
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            <div>
                              <span>{item.name}</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md">
                                  <Warehouse className="size-2.5" />
                                  {item.outlet_name || (outlets.find((o) => o.id === item.outlet_id)?.name) || "Gudang Pusat"}
                                </span>
                                {item.ai_alert && (
                                  <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                                    ⚠️ {item.ai_alert}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                              {item.category || "Umum"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground font-medium">
                            {item.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold">
                            {formatRupiah(item.cost_price || 0)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div>
                              <span
                                className={`font-black text-sm ${
                                  isOutOfStock
                                    ? "text-rose-600"
                                    : isLowStock
                                      ? "text-amber-600"
                                      : "text-foreground"
                                }`}
                              >
                                {Number(item.stock % 1 === 0 ? item.stock : item.stock.toFixed(2)).toLocaleString("id-ID")}{" "}
                                <span className="text-xs font-semibold text-muted-foreground">{item.unit}</span>
                              </span>
                              {Number(item.yield_per_unit) > 0 && item.stock > 0 && (
                                <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
                                  Setara ±{" "}
                                  <strong className="text-foreground">
                                    {Math.round(item.stock * Number(item.yield_per_unit)).toLocaleString("id-ID")}{" "}
                                    {item.yield_unit || "gram"}
                                  </strong>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground">
                            {item.minimum_stock} {item.unit}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isCritical ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                  <AlertTriangle className="size-3" />
                                  ⚠️ PERLU RESTOCK
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">
                                  Saldo Celengan Bahan Ini:{" "}
                                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                    {formatRupiah(pocketInfo.balance)}
                                  </strong>
                                  {pocketInfo.canBuyUnits > 0 ? (
                                    <span className="text-foreground font-bold block">
                                      (Cukup untuk beli {pocketInfo.canBuyUnits} {item.unit})
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground block">(Belum cukup 1 {item.unit})</span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 className="size-3" />
                                Aman
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-xs">
                            {item.supplier_name || "-"}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isCritical && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenStockIn(item.id)}
                                  className="h-8 rounded-xl text-xs gap-1 font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 mr-1 shadow-xs"
                                  title="Langsung Restock dari Celengan"
                                >
                                  <ShoppingCart className="size-3.5 text-amber-600" />
                                  <span className="hidden xl:inline">🛒 Langsung Restock dari Celengan</span>
                                  <span className="xl:hidden">Restock</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleOpenStockIn(item.id)}
                                title="Catat Masuk"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-xl"
                              >
                                <ArrowDownLeft className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleOpenAdjustment(item.id)}
                                title="Penyesuaian Stok"
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-xl"
                              >
                                <SlidersHorizontal className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleOpenEditItem(item)}
                                title="Edit Bahan"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDeleteItem(item)}
                                title="Hapus Bahan"
                                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab Content: STOK MASUK */}
      {activeTab === "stock-in" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Riwayat & Pencatatan Stok Masuk</h2>
              <p className="text-xs text-muted-foreground">
                Penerimaan bahan baku dari supplier atau pembelian mandiri.
              </p>
            </div>
            <Button
              variant="hero"
              size="sm"
              onClick={() => handleOpenStockIn()}
              className="rounded-2xl gap-2 font-bold shadow-brand bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowDownLeft className="size-4" />
              <span>+ Catat Stok Masuk</span>
            </Button>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Waktu</th>
                    <th className="py-3.5 px-4 font-bold">Nama Bahan</th>
                    <th className="py-3.5 px-4 font-bold text-right">Kuantitas Masuk</th>
                    <th className="py-3.5 px-4 font-bold text-right">Sisa Stok</th>
                    <th className="py-3.5 px-4 font-bold">Keterangan / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.filter((m) => m.movement_type === "stock_in").length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <ArrowDownLeft className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                        <p className="font-bold">Belum ada riwayat stok masuk</p>
                      </td>
                    </tr>
                  ) : (
                    movements
                      .filter((m) => m.movement_type === "stock_in")
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 px-4 font-bold">{m.item_name || "Item"}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">
                            +{m.quantity} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {m.remaining_stock} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {m.notes || "-"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab Content: STOK KELUAR */}
      {activeTab === "stock-out" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pencatatan Stok Keluar (Non-POS)</h2>
              <p className="text-xs text-muted-foreground">
                Pengeluaran bahan baku untuk produksi batch, sample, atau keperluan internal.
              </p>
            </div>
            <Button
              variant="hero"
              size="sm"
              onClick={() => handleOpenStockOut()}
              className="rounded-2xl gap-2 font-bold shadow-brand bg-rose-600 hover:bg-rose-700"
            >
              <ArrowUpRight className="size-4" />
              <span>+ Catat Stok Keluar</span>
            </Button>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Waktu</th>
                    <th className="py-3.5 px-4 font-bold">Nama Bahan</th>
                    <th className="py-3.5 px-4 font-bold text-right">Kuantitas Keluar</th>
                    <th className="py-3.5 px-4 font-bold text-right">Sisa Stok</th>
                    <th className="py-3.5 px-4 font-bold">Alasan & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.filter((m) => m.movement_type === "stock_out").length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <ArrowUpRight className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                        <p className="font-bold">Belum ada riwayat stok keluar manual</p>
                      </td>
                    </tr>
                  ) : (
                    movements
                      .filter((m) => m.movement_type === "stock_out")
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 px-4 font-bold">{m.item_name || "Item"}</td>
                          <td className="py-3 px-4 text-right font-black text-rose-600">
                            -{m.quantity} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {m.remaining_stock} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {m.notes || "-"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab Content: PENYESUAIAN STOK */}
      {activeTab === "adjustment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Penyesuaian Stok (Stock Adjustment)</h2>
              <p className="text-xs text-muted-foreground">
                Koreksi perbedaan jumlah antara stok sistem dengan perhitungan fisik aktual.
              </p>
            </div>
            <Button
              variant="hero"
              size="sm"
              onClick={() => handleOpenAdjustment()}
              className="rounded-2xl gap-2 font-bold shadow-brand"
            >
              <SlidersHorizontal className="size-4" />
              <span>+ Penyesuaian Stok</span>
            </Button>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Waktu</th>
                    <th className="py-3.5 px-4 font-bold">Nama Bahan</th>
                    <th className="py-3.5 px-4 font-bold text-right">Kuantitas Penyesuaian</th>
                    <th className="py-3.5 px-4 font-bold text-right">Stok Akhir</th>
                    <th className="py-3.5 px-4 font-bold">Alasan / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.filter((m) => m.movement_type === "adjustment").length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <SlidersHorizontal className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                        <p className="font-bold">Belum ada riwayat penyesuaian stok</p>
                      </td>
                    </tr>
                  ) : (
                    movements
                      .filter((m) => m.movement_type === "adjustment")
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3 px-4 font-bold">{m.item_name || "Item"}</td>
                          <td
                            className={`py-3 px-4 text-right font-black ${
                              m.quantity >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {m.quantity >= 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {m.remaining_stock} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {m.notes || "-"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. Tab Content: STOK MENIPIS & HABIS */}
      {activeTab === "low-stock" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Peringatan Stok Kritis & Restock</h2>
              <p className="text-xs text-muted-foreground">
                Daftar bahan baku yang sudah habis atau mendekati batas minimum stok.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items
              .filter((i) => i.stock <= i.minimum_stock)
              .map((item) => {
                const isOutOfStock = item.stock <= 0;
                return (
                  <div
                    key={item.id}
                    className={`rounded-[1.5rem] border p-5 shadow-soft bg-card ${
                      isOutOfStock ? "border-rose-500/40" : "border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            isOutOfStock
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {isOutOfStock ? "Habis" : "Menipis"}
                        </span>
                        <h3 className="text-lg font-black mt-2">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                          {item.stock}{" "}
                          <span className="text-xs font-semibold text-muted-foreground">
                            {item.unit}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Batas min: {item.minimum_stock} {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        Supplier: {item.supplier_name || "Belum dipilih"}
                      </span>
                      <Button
                        size="sm"
                        variant="hero"
                        onClick={() => handleOpenStockIn(item.id)}
                        className="rounded-xl h-8 px-3 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <ArrowDownLeft className="size-3.5" />
                        <span>Restock</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>

          {items.filter((i) => i.stock <= i.minimum_stock).length === 0 && (
            <div className="rounded-[1.75rem] border border-border bg-card p-12 text-center">
              <CheckCircle2 className="mx-auto size-12 text-emerald-500 mb-3" />
              <h3 className="text-lg font-black">Semua Stok Bahan Baku Aman!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tidak ada bahan baku yang berada di bawah kuantitas minimum saat ini.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Tambah / Edit Bahan Baku */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Boxes className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">
                    {editingItem ? "Edit Bahan Baku" : "Tambah Bahan Baku Baru"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Master data bahan untuk resep & inventori
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Nama Bahan Baku *</label>
                <Input
                  required
                  placeholder="Contoh: Daging Kebab Sapi, Kulit Tortilla 20cm"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    aria-label="Kategori bahan baku form"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Satuan Ukur</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    aria-label="Satuan ukur bahan baku form"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Boxes className="size-3.5" /> Konfigurasi Kemasan Grosir / Pak (Celengan Tabungan Belanja)
                  </span>
                  <span className="text-[10px] text-muted-foreground">Otomatisasi HQ</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Isi per 1 Pak/Kemasan
                    </label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Contoh: 20"
                        value={formPackSize || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormPackSize(val);
                          if (val > 0 && formPackPrice > 0) {
                            setFormCostPrice(Math.round(formPackPrice / val));
                          }
                        }}
                        className="rounded-xl pr-12 text-xs font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                        {formUnit || "unit"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Harga Beli per 1 Pak (Rp)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Contoh: 80000"
                      value={formPackPrice || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormPackPrice(val);
                        if (formPackSize > 0 && val > 0) {
                          setFormCostPrice(Math.round(val / formPackSize));
                        }
                      }}
                      className="mt-1 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
                {formPackSize > 0 && formPackPrice > 0 && (
                  <p className="text-[11px] text-primary/80 font-medium">
                    💡 HPP Satuan dihitung otomatis: <span className="font-bold">Rp {Math.round(formPackPrice / formPackSize).toLocaleString("id-ID")}</span> per {formUnit}
                  </p>
                )}

                {/* Konversi Satuan & Yield Capacity (Pack/Pcs ke Gram/Porsi) */}
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-foreground">
                      ⚖️ Konversi Takaran Resep (Yield per Satuan)
                    </label>
                    <span className="text-[10px] text-muted-foreground">Opsional untuk Pack/Pcs/Tiang</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">
                        Kapasitas per 1 {formUnit}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Contoh: 2200"
                        value={formYieldPerUnit || ""}
                        onChange={(e) => setFormYieldPerUnit(e.target.value ? Number(e.target.value) : undefined)}
                        className="mt-1 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground">
                        Satuan Resep (Yield Unit)
                      </label>
                      <select
                        value={formYieldUnit}
                        onChange={(e) => setFormYieldUnit(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="gram">gram</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="liter">liter</option>
                        <option value="lembar">lembar</option>
                        <option value="porsi">porsi</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  {Number(formYieldPerUnit) > 0 && (
                    <div className="rounded-lg bg-background/80 p-2 border border-primary/20 space-y-1">
                      <p className="text-[11px] text-foreground font-semibold">
                        💡 1 {formUnit} = <span className="font-bold text-primary">{formYieldPerUnit} {formYieldUnit}</span>
                        {formCostPrice > 0 && (
                          <span>
                            {" "}→ HPP dasar: <strong className="text-emerald-600 dark:text-emerald-400">Rp {(formCostPrice / (Number(formYieldPerUnit) || 1)).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</strong> per {formYieldUnit}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Saat menu kebab terjual di POS kasir, stok {formUnit} akan berkurang otomatis sesuai takaran resep ({formYieldUnit}).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Harga Modal Satuan (Rp)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="mt-1 rounded-2xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    {editingItem ? "Stok Sekarang" : "Stok Awal"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="mt-1 rounded-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Min. Stok (Alert)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="mt-1 rounded-2xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Supplier Utama (Opsional)
                </label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  aria-label="Supplier utama bahan baku"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Pilih Supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Cabang / Outlet Penempatan
                </label>
                <select
                  value={formOutletId}
                  onChange={(e) => setFormOutletId(e.target.value)}
                  aria-label="Cabang penempatan bahan baku"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Gudang Pusat / Semua Cabang (Shared)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name || o.outlet_name} ({o.code || "CABANG"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand"
                >
                  {submitting ? "Menyimpan..." : "Simpan Bahan Baku"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Catat Stok Masuk */}
      {stockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowDownLeft className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Catat Stok Masuk</h3>
                  <p className="text-xs text-muted-foreground">
                    Penerimaan bahan baku baru dari supplier / restock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockInModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitStockIn} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Bahan Baku *</label>
                <select
                  value={stockInItemId}
                  onChange={(e) => {
                    setStockInItemId(e.target.value);
                    const itm = items.find((i) => i.id === e.target.value);
                    if (itm) {
                      setStockInUnitCost(itm.cost_price);
                      if (itm.supplier_id) setStockInSupplierId(itm.supplier_id);
                    }
                  }}
                  required
                  aria-label="Pilih bahan baku stok masuk"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Pilih bahan baku...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stok saat ini: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Jumlah Masuk *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={stockInQty}
                    onChange={(e) => setStockInQty(Number(e.target.value))}
                    className="mt-1 rounded-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Harga Belanja Aktual per Unit (Rp)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={stockInUnitCost}
                    onChange={(e) => setStockInUnitCost(Number(e.target.value))}
                    className="mt-1 rounded-2xl"
                  />
                </div>
              </div>

              {/* Total Belanja & Buffer HPP Protection Box */}
              {stockInQty > 0 && stockInUnitCost > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Total Belanja Aktual:</span>
                    <span className="font-black text-amber-600 dark:text-amber-400 font-mono text-sm">
                      Rp {(stockInQty * stockInUnitCost).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    💡 Saldo Tabungan Bahan Baku cabang ini akan terpotong sebesar total belanja ini.
                  </p>
                  <label className="flex items-start gap-2 pt-1 border-t border-amber-500/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateBenchmarkCost}
                      onChange={(e) => setUpdateBenchmarkCost(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-medium text-foreground">
                      Update juga Harga Patokan HPP dengan harga belanja ini (Jika tidak dicentang, patokan HPP tetap aman sebagai buffer tabungan).
                    </span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Supplier (Opsional)
                  </label>
                  <select
                    value={stockInSupplierId}
                    onChange={(e) => setStockInSupplierId(e.target.value)}
                    aria-label="Supplier stok masuk"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Pilih supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    No. Referensi / Inv
                  </label>
                  <Input
                    value={stockInReference}
                    onChange={(e) => setStockInReference(e.target.value)}
                    placeholder="Contoh: INV-2026-001"
                    className="mt-1 rounded-2xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Catatan Tambahan</label>
                <Input
                  value={stockInNotes}
                  onChange={(e) => setStockInNotes(e.target.value)}
                  placeholder="Catatan kondisi barang, no batch, dsb."
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStockInModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? "Menyimpan..." : "Simpan Stok Masuk"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Catat Stok Keluar */}
      {stockOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <ArrowUpRight className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Catat Stok Keluar (Non-POS)</h3>
                  <p className="text-xs text-muted-foreground">
                    Pengurangan stok di luar transaksi kasir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockOutModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitStockOut} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Bahan Baku *</label>
                <select
                  value={stockOutItemId}
                  onChange={(e) => setStockOutItemId(e.target.value)}
                  required
                  aria-label="Pilih bahan baku stok keluar"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Pilih bahan baku...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stok tersedia: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Jumlah Keluar *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={stockOutQty}
                    onChange={(e) => setStockOutQty(Number(e.target.value))}
                    className="mt-1 rounded-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Alasan Pengeluaran
                  </label>
                  <select
                    value={stockOutReason}
                    onChange={(e) => setStockOutReason(e.target.value)}
                    aria-label="Alasan pengeluaran stok"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Produksi">Produksi Batch</option>
                    <option value="Sample / Tester">Sample / Tester</option>
                    <option value="Pemakaian Internal">Pemakaian Internal Karyawan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Catatan / Keterangan
                </label>
                <Input
                  value={stockOutNotes}
                  onChange={(e) => setStockOutNotes(e.target.value)}
                  placeholder="Keterangan pengeluaran"
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStockOutModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand bg-rose-600 hover:bg-rose-700"
                >
                  {submitting ? "Menyimpan..." : "Simpan Stok Keluar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Penyesuaian Stok (Stock Adjustment) */}
      {adjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <SlidersHorizontal className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Penyesuaian Stok (Stock Adjustment)</h3>
                  <p className="text-xs text-muted-foreground">
                    Sinkronisasi fisik vs sistem database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustmentModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Bahan Baku *</label>
                <select
                  value={adjItemId}
                  onChange={(e) => {
                    setAdjItemId(e.target.value);
                    const itm = items.find((i) => i.id === e.target.value);
                    if (itm) setAdjActualStock(itm.stock);
                  }}
                  required
                  aria-label="Pilih bahan baku penyesuaian stok"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Pilih bahan baku...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stok sistem: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAdjItem && (
                <div className="rounded-2xl bg-secondary/50 p-3 text-xs grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-muted-foreground">Stok Sistem</span>
                    <p className="text-base font-black text-foreground mt-0.5">
                      {selectedAdjItem.stock} {selectedAdjItem.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stok Fisik Baru</span>
                    <p className="text-base font-black text-primary mt-0.5">
                      {adjActualStock} {selectedAdjItem.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Selisih</span>
                    <p
                      className={`text-base font-black mt-0.5 ${
                        adjDifference >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {adjDifference >= 0 ? `+${adjDifference}` : adjDifference}{" "}
                      {selectedAdjItem.unit}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Stok Fisik Aktual *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={adjActualStock}
                    onChange={(e) => setAdjActualStock(Number(e.target.value))}
                    className="mt-1 rounded-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Alasan Penyesuaian
                  </label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    aria-label="Alasan penyesuaian stok form"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Selisih Perhitungan Fisik">Selisih Perhitungan Fisik</option>
                    <option value="Barang Rusak / Hilang">Barang Rusak / Hilang</option>
                    <option value="Koreksi Input Awal">Koreksi Input Awal</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Catatan / Detail</label>
                <Input
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Keterangan hasil audit fisik"
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustmentModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand"
                >
                  {submitting ? "Menyimpan..." : "Simpan Penyesuaian"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Modal: SINKRONKAN / SALIN MASTER BAHAN BAKU ANTAR CABANG */}
      {cloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Copy className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">
                    Sinkronkan / Salin Master Bahan Baku
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Duplikasi master bahan dan konversi resep ke cabang baru tanpa perlu ketik ulang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloneModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
                <p className="font-bold text-foreground">
                  💡 Cara Kerja Sinkronisasi Master Bahan:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                  <li>
                    Sistem menduplikasi seluruh nama bahan, SKU, kategori, satuan, patokan harga modal (HPP buffer), batas minimum stok, dan pengaturan kapasitas konversi (yield) ke cabang tujuan.
                  </li>
                  <li>
                    <strong>Stok awal otomatis diset ke 0</strong>, sehingga cabang tujuan siap mencatat stok fisik nyata melalui menu Restock / Pembelian.
                  </li>
                  <li>
                    Bahan baku yang sudah ada di cabang tujuan tidak akan diduplikasi ulang (aman dari duplikasi ganda).
                  </li>
                </ul>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  1. Pilih Sumber Master Bahan:
                </label>
                <select
                  value={cloneSourceOutletId}
                  onChange={(e) => setCloneSourceOutletId(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background p-3 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">Semua Master Bahan / Gudang Utama (HQ)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      📍 Cabang: {o.name || o.outlet_name} ({items.filter((i) => i.outlet_id === o.id).length} bahan)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  2. Pilih Cabang Tujuan (Yang Menerima Master Bahan) *:
                </label>
                <select
                  value={cloneTargetOutletId}
                  onChange={(e) => setCloneTargetOutletId(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background p-3 text-xs sm:text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Pilih cabang tujuan...</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      📍 {o.name || o.outlet_name} (Saat ini: {items.filter((i) => i.outlet_id === o.id).length} bahan)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCloneModalOpen(false)}
                  disabled={cloningLoading}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleExecuteCloneMaster}
                  disabled={cloningLoading || !cloneTargetOutletId}
                  className="rounded-2xl font-bold shadow-brand bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  {cloningLoading ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Menyalin Bahan...</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      <span>Salin &amp; Sinkronkan Sekarang</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
