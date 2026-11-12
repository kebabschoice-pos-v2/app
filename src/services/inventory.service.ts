import { supabase } from "@/integrations/supabase/client";
import { resolveActiveBusinessId, resolveAllUserBusinessIds } from "./menu.service";
import { resolveInventoryIngredientParams } from "@/lib/bom-analytics";

async function insertStockMovementClientDb(mov: Record<string, any>) {
  const { id: _ignoreMovId, ...payloadWithoutId } = mov;
  try {
    const res = await supabase.from("stock_movements" as any).insert(payloadWithoutId);
    if (!res?.error) return;
  } catch {}

  try {
    await supabase.from("stock_movements" as any).insert({
      business_id: mov.business_id,
      inventory_item_id: mov.inventory_item_id,
      outlet_id: mov.outlet_id || null,
      type: mov.movement_type || "stock_out",
      movement_type: mov.movement_type || "stock_out",
      quantity: mov.quantity,
      notes: mov.notes || "",
      created_at: mov.created_at || new Date().toISOString(),
    });
  } catch {}
}

export interface InventoryItemDetail {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  outlet_name?: string | null;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  cost_price: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  health_score: number;
  ai_alert?: string | null;
  updated_at?: string;
  status: "aman" | "menipis" | "habis";
  yield_per_unit?: number | null;
  yield_unit?: string | null;
}

export interface StockMovementRecord {
  id: string;
  business_id: string;
  inventory_item_id: string;
  item_name?: string;
  outlet_id?: string | null;
  order_id?: string | null;
  movement_type:
    | "pos_sale"
    | "stock_in"
    | "stock_out"
    | "adjustment"
    | "opname"
    | "waste"
    | "transfer_in"
    | "transfer_out";
  quantity: number;
  unit: string;
  remaining_stock: number;
  notes?: string | null;
  created_at: string;
}

export interface StockAdjustmentRecord {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  inventory_item_id: string;
  item_name: string;
  adjustment_type: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  unit: string;
  reason: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface SupplierItem {
  id: string;
  business_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  product_category?: string | null;
  notes?: string | null;
  purchase_count?: number;
  total_purchased?: number;
  created_at: string;
}

export interface PurchaseOrderItem {
  id?: string;
  inventory_item_id?: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  subtotal: number;
  received_quantity?: number;
}

export interface PurchaseOrderRecord {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  outlet_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string | null;
  status: "draft" | "pending" | "approved" | "received" | "cancelled";
  total_amount: number;
  notes?: string | null;
  items: PurchaseOrderItem[];
  approved_by?: string | null;
  received_at?: string | null;
  created_at: string;
}

export interface StockOpnameItemDetail {
  id?: string;
  inventory_item_id: string;
  item_name: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  unit: string;
  notes?: string | null;
}

export interface StockOpnameRecord {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  outlet_name?: string | null;
  opname_number: string;
  date: string;
  status: "draft" | "completed" | "approved";
  notes?: string | null;
  conducted_by?: string | null;
  items: StockOpnameItemDetail[];
  created_at: string;
}

export interface WasteRecordDetail {
  id: string;
  business_id: string;
  outlet_id?: string | null;
  outlet_name?: string | null;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  cost_loss: number;
  reason: "Expired" | "Rusak" | "Salah produksi" | "Tumpah" | "Lainnya" | string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface StockTransferItemDetail {
  id?: string;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

export interface StockTransferRecord {
  id: string;
  business_id: string;
  transfer_number: string;
  origin_outlet_id?: string | null;
  origin_outlet_name?: string | null;
  destination_outlet_id?: string | null;
  destination_outlet_name?: string | null;
  status: "requested" | "approved" | "sent" | "received" | "cancelled";
  notes?: string | null;
  items: StockTransferItemDetail[];
  sent_at?: string | null;
  received_at?: string | null;
  created_at: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper: load stored procurement data from outlets.settings & localStorage fallback
async function loadProcurementStore(businessId: string): Promise<Record<string, any>> {
  let localData: Record<string, any> = {};
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`procurement_store_${businessId}`);
      if (stored) localData = JSON.parse(stored);
    } catch (_) {}
  }

  try {
    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, settings")
      .eq("business_id", businessId)
      .limit(1);

    if (outlets && outlets.length > 0 && outlets[0]) {
      const s = (outlets[0].settings as any) || {};
      const serverProc = s.procurement || {};
      const merged = { ...localData, ...serverProc };
      return merged;
    }
  } catch (err) {
    console.warn("[inventory.service] Error reading procurement settings:", err);
  }
  return localData;
}

// Helper: save procurement store to outlets.settings & localStorage
async function saveProcurementStore(businessId: string, store: Record<string, any>): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(`procurement_store_${businessId}`, JSON.stringify(store));
    } catch (_) {}
  }

  try {
    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, settings")
      .eq("business_id", businessId);

    for (const o of outlets || []) {
      const current = (o.settings as any) || {};
      const updated = { ...current, procurement: store };
      await supabase
        .from("outlets")
        .update({ settings: updated, updated_at: new Date().toISOString() })
        .eq("id", o.id);
    }
  } catch (err) {
    console.warn("[inventory.service] Error saving procurement settings:", err);
  }
}

export interface BranchMoneyLedgerData {
  spent_amounts: Record<string, number>;
  manual_added: Record<string, number>;
  history?: any[];
  topup_history?: any[];
  operational_items?: any[];
  opPockets?: any[];
  pack_configs?: Record<string, any>;
  salary_paid?: Record<string, number>;
}

/**
 * Load authoritative Branch Money Ledger from Supabase outlets.settings.money_allocation_ledger
 * with localStorage fallback
 */
export async function loadBranchMoneyLedger(outletId?: string | null): Promise<BranchMoneyLedgerData> {
  const defaultLedger: BranchMoneyLedgerData = {
    spent_amounts: {},
    manual_added: {},
    history: [],
    topup_history: [],
    operational_items: [],
  };

  const localKey = outletId && outletId !== "all"
    ? `kebabschoicepos_money_allocation_${outletId}`
    : "kebabschoicepos_money_allocation";

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const local = window.localStorage.getItem(localKey);
      if (local) {
        Object.assign(defaultLedger, JSON.parse(local));
      }
    } catch (_) {}
  }

  if (!outletId || outletId === "all" || outletId === "default") {
    return defaultLedger;
  }

  try {
    const { data: outletRow } = await supabase
      .from("outlets")
      .select("id, settings")
      .eq("id", outletId)
      .maybeSingle();

    if (outletRow && outletRow.settings) {
      const s = outletRow.settings as any;
      const ledger = s.money_allocation_ledger || s.money_allocation;
      if (ledger) {
        return {
          spent_amounts: { ...(defaultLedger.spent_amounts || {}), ...(ledger.spent_amounts || {}) },
          manual_added: { ...(defaultLedger.manual_added || {}), ...(ledger.manual_added || {}) },
          history: Array.isArray(ledger.history) ? ledger.history : defaultLedger.history || [],
          topup_history: Array.isArray(ledger.topup_history) ? ledger.topup_history : defaultLedger.topup_history || [],
          operational_items: Array.isArray(ledger.operational_items) ? ledger.operational_items : defaultLedger.operational_items || [],
          opPockets: ledger.opPockets || defaultLedger.opPockets,
          pack_configs: ledger.pack_configs || defaultLedger.pack_configs,
          salary_paid: ledger.salary_paid || defaultLedger.salary_paid,
        };
      }
    }
  } catch (err) {
    console.warn("[inventory.service] loadBranchMoneyLedger DB warning:", err);
  }

  return defaultLedger;
}

/**
 * Save authoritative Branch Money Ledger directly to Supabase outlets.settings.money_allocation_ledger
 * and sync to localStorage
 */
export async function saveBranchMoneyLedger(
  outletId: string | null | undefined,
  ledgerData: Partial<BranchMoneyLedgerData>,
): Promise<void> {
  const localKey = outletId && outletId !== "all"
    ? `kebabschoicepos_money_allocation_${outletId}`
    : "kebabschoicepos_money_allocation";

  // 1. Sync localStorage immediately
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(localKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const merged = { ...parsed, ...ledgerData };
      window.localStorage.setItem(localKey, JSON.stringify(merged));
      // Also sync global key for backward compatibility
      window.localStorage.setItem("kebabschoicepos_money_allocation", JSON.stringify(merged));
    } catch (_) {}
  }

  // 2. Persist to Supabase outlets table
  try {
    if (outletId && outletId !== "all" && outletId !== "default") {
      const { data: outRow } = await supabase
        .from("outlets")
        .select("id, settings")
        .eq("id", outletId)
        .maybeSingle();

      if (outRow) {
        const currSettings = (outRow.settings as any) || {};
        const currLedger = currSettings.money_allocation_ledger || currSettings.money_allocation || {};
        const updatedLedger = {
          ...currLedger,
          ...ledgerData,
          spent_amounts: { ...(currLedger.spent_amounts || {}), ...(ledgerData.spent_amounts || {}) },
          manual_added: { ...(currLedger.manual_added || {}), ...(ledgerData.manual_added || {}) },
          history: ledgerData.history ?? currLedger.history ?? [],
          topup_history: ledgerData.topup_history ?? currLedger.topup_history ?? [],
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("outlets")
          .update({
            settings: {
              ...currSettings,
              money_allocation_ledger: updatedLedger,
              money_allocation: updatedLedger,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", outletId);
      }
    } else {
      // If outletId is all/null, sync to all business outlets
      const { data: allOutlets } = await supabase.from("outlets").select("id, settings");
      for (const o of allOutlets || []) {
        const currSettings = (o.settings as any) || {};
        const currLedger = currSettings.money_allocation_ledger || currSettings.money_allocation || {};
        const updatedLedger = {
          ...currLedger,
          ...ledgerData,
          spent_amounts: { ...(currLedger.spent_amounts || {}), ...(ledgerData.spent_amounts || {}) },
          manual_added: { ...(currLedger.manual_added || {}), ...(ledgerData.manual_added || {}) },
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("outlets")
          .update({
            settings: {
              ...currSettings,
              money_allocation_ledger: updatedLedger,
              money_allocation: updatedLedger,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", o.id);
      }
    }
  } catch (err) {
    console.warn("[inventory.service] saveBranchMoneyLedger DB warning:", err);
  }
}


/**
 * 1. INVENTORY DASHBOARD METRICS
 */
export async function getInventoryDashboardMetrics(businessId?: string): Promise<{
  totalItems: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}> {
  const items = await getInventoryItems(businessId);
  let totalStockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    const cost = item.cost_price || 0;
    totalStockValue += item.stock * cost;
    if (item.stock <= 0) {
      outOfStockCount++;
    } else if (item.stock <= item.minimum_stock) {
      lowStockCount++;
    }
  }

  return {
    totalItems: items.length,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
  };
}

/**
 * 2. GET INVENTORY ITEMS (WITH SUPPLIER & STATUS)
 * Queries real table inventory_items (never 404s)
 */
export async function getInventoryItems(businessId?: string): Promise<InventoryItemDetail[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const allBusinessIds = await resolveAllUserBusinessIds();
  const effectiveBusinessIds = Array.from(new Set([bid, ...allBusinessIds].filter(Boolean)));

  // 1. Try serverless endpoint first (runs via supabaseAdmin, bypasses RLS)
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`/api/inventory?type=items&businessId=${encodeURIComponent(bid)}`, {
      headers: { ...authHeader },
    });
    if (res.ok) {
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : null;
      if (list) {
        return list.map((item: any) => {
          const stockVal = Number(item.stock) || 0;
          const minVal = Number(item.minimum_stock) || 0;
          let status: "aman" | "menipis" | "habis" = item.status || "aman";
          if (stockVal <= 0) {
            status = "habis";
          } else if (stockVal <= minVal) {
            status = "menipis";
          }
          return {
            ...item,
            stock: stockVal,
            minimum_stock: minVal,
            cost_price: Number(item.cost_price ?? 0),
            yield_per_unit: Number(item.yield_per_unit) || null,
            yield_unit: item.yield_unit || null,
            status,
          };
        });
      }
    }
  } catch (apiErr) {
    console.warn("[inventory.service] /api/inventory?type=items fetch failed, falling back to client:", apiErr);
  }

  // 2. Client fallback with allBusinessIds
  const store = await loadProcurementStore(bid);
  const suppliers: SupplierItem[] = store.suppliers || [];

  let dbItems: any[] | null = null;
  if (effectiveBusinessIds.length > 0) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .in("business_id", effectiveBusinessIds)
      .order("name", { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) {
      dbItems = data;
    }
  }

  if (!dbItems || dbItems.length === 0) {
    // Fallback without business_id filter
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true });
    dbItems = data || [];
  }

  const extraMeta = store.item_meta || {};

  const mappedItems: InventoryItemDetail[] = (dbItems || []).map((row) => {
    const meta = extraMeta[row.id] || {};
    const stockVal = Number(row.stock) || 0;
    const minVal = Number(row.minimum_stock) || 0;
    const costPrice = Number(row.cost_price ?? meta.cost_price ?? 0);
    const supplierId = meta.supplier_id || null;
    const matchedSup = suppliers.find((s) => s.id === supplierId);
    const outletId = (row as any).outlet_id || meta.outlet_id || null;
    const outletName = meta.outlet_name || null;
    const yieldPerUnit =
      Number((row as any).yield_per_unit ?? meta.yield_per_unit ?? meta.pack_size ?? 0) || null;
    const yieldUnit =
      (row as any).yield_unit ||
      meta.yield_unit ||
      (row.unit === "pcs" || row.unit === "pack" || row.unit === "tiang" ? "gram" : null);

    let status: "aman" | "menipis" | "habis" = "aman";
    if (stockVal <= 0) {
      status = "habis";
    } else if (stockVal <= minVal) {
      status = "menipis";
    }

    return {
      id: row.id,
      business_id: row.business_id,
      outlet_id: outletId,
      outlet_name: outletName,
      name: row.name,
      category: row.category || "Bahan Baku",
      unit: row.unit || "pcs",
      stock: stockVal,
      minimum_stock: minVal,
      cost_price: costPrice,
      supplier_id: supplierId,
      supplier_name: matchedSup ? matchedSup.name : meta.supplier_name || null,
      health_score: Number(row.health_score) || 100,
      ai_alert: row.ai_alert,
      updated_at: row.updated_at,
      yield_per_unit: yieldPerUnit,
      yield_unit: yieldUnit,
      status,
    };
  });

  // Deduplicate items in the same outlet with the same name:
  // If duplicates exist, pick the one with valid/higher cost_price or valid yield_per_unit,
  // avoiding invalid legacy duplicates (e.g. cost Rp 1.000 vs Rp 120.000).
  const seenMap = new Map<string, InventoryItemDetail>();
  for (const item of mappedItems) {
    const key = `${(item.outlet_id || "hq").toLowerCase()}___${item.name.trim().toLowerCase()}`;
    const keyName = item.name.toLowerCase().trim();

    // Default fallbacks only if uninitialized (cost_price <= 0). Never overwrite user customizations!
    if (keyName.includes("daging") && item.cost_price <= 0) {
      item.cost_price = 120000;
      if (!item.yield_per_unit || item.yield_per_unit <= 1) {
        item.yield_per_unit = 2000;
        item.yield_unit = "gram";
      }
    } else if (keyName.includes("tortilla") && item.cost_price <= 0) {
      item.cost_price = 25000;
      if (!item.yield_per_unit || item.yield_per_unit <= 1) {
        item.yield_per_unit = 20;
        item.yield_unit = "pcs";
      }
    }

    if (!seenMap.has(key)) {
      seenMap.set(key, item);
    } else {
      const existing = seenMap.get(key)!;
      const existingCost = existing.cost_price || 0;
      const currentCost = item.cost_price || 0;
      if (currentCost > existingCost) {
        seenMap.set(key, item);
      } else if (currentCost === existingCost) {
        const itemTime = item.updated_at ? new Date(item.updated_at).getTime() : 0;
        const existTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        if (itemTime > existTime) {
          seenMap.set(key, item);
        }
      }
    }
  }
  return Array.from(seenMap.values());
}

/**
 * Helper: Computes portion HPP cost for a given recipe usage
 * If inventory item is 1 tiang = 2200 gram @ Rp 110.000, 20 gram = (20/2200) * 110.000 = Rp 1.000
 */
export function calculateIngredientPortionCost(
  item: InventoryItemDetail,
  recipeQuantity: number,
  recipeUnit: string,
): number {
  const cost = item.cost_price || 0;
  if (cost <= 0) return 0;

  const yieldCap = Number(item.yield_per_unit) > 0 ? Number(item.yield_per_unit) : 0;
  if (yieldCap > 0) {
    let normalizedQty = recipeQuantity;
    const rUnit = (recipeUnit || "").toLowerCase().trim();
    const yUnit = (item.yield_unit || "gram").toLowerCase().trim();
    if ((rUnit === "kg" || rUnit === "kilogram") && (yUnit === "gram" || yUnit === "g")) {
      normalizedQty = recipeQuantity * 1000;
    }
    return (normalizedQty / yieldCap) * cost;
  }

  const rUnit = (recipeUnit || "").toLowerCase().trim();
  const iUnit = (item.unit || "").toLowerCase().trim();
  if ((rUnit === "gram" || rUnit === "g") && (iUnit === "kg" || iUnit === "kilogram")) {
    return (recipeQuantity / 1000) * cost;
  }
  if ((rUnit === "ml" || rUnit === "mililiter") && (iUnit === "liter" || iUnit === "l")) {
    return (recipeQuantity / 1000) * cost;
  }

  return recipeQuantity * cost;
}

/**
 * 3. CREATE INVENTORY ITEM
 */
export async function createInventoryItem(
  data: {
    name: string;
    category: string;
    unit: string;
    stock: number;
    minimum_stock: number;
    cost_price: number;
    supplier_id?: string | null;
    outlet_id?: string | null;
    outlet_name?: string | null;
    yield_per_unit?: number | null;
    yield_unit?: string | null;
  },
  businessId?: string,
): Promise<InventoryItemDetail> {
  const bid = await resolveActiveBusinessId(businessId);

  // Check if item with same name in same outlet already exists to prevent duplicate insertion
  try {
    const existingItems = await getInventoryItems(bid);
    const existingDup = existingItems.find(
      (i) =>
        i.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
        (i.outlet_id || null) === (data.outlet_id || null),
    );
    if (existingDup) {
      await updateInventoryItem(existingDup.id, data, bid);
      return {
        ...existingDup,
        ...data,
      };
    }
  } catch {}

  // 1. Try serverless endpoint first (supabaseAdmin)
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "create-item",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const raw = await res.json();
      const created = raw?.data || raw;
      if (created && created.id) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("inventory:updated"));
          window.dispatchEvent(new CustomEvent("pos:menu-updated"));
        }
        return created;
      }
    }
  } catch (apiErr) {
    console.warn("[inventory.service] POST /api/inventory create-item failed, fallback to client:", apiErr);
  }

  // 2. Client fallback
  let inserted: any = null;
  const insertPayload: Record<string, any> = {
    business_id: bid,
    name: data.name.trim(),
    category: data.category.trim(),
    unit: data.unit.trim(),
    stock: Number(data.stock) || 0,
    minimum_stock: Number(data.minimum_stock) || 0,
    health_score: 100,
  };
  if (data.outlet_id) {
    insertPayload.outlet_id = data.outlet_id;
  }
  if (data.yield_per_unit !== undefined && data.yield_per_unit !== null) {
    insertPayload.yield_per_unit = Number(data.yield_per_unit);
  }
  if (data.yield_unit) {
    insertPayload.yield_unit = data.yield_unit;
  }

  const { data: resWithOutlet, error: errWithOutlet } = await supabase
    .from("inventory_items")
    .insert(insertPayload)
    .select()
    .single();

  if (resWithOutlet) {
    inserted = resWithOutlet;
  } else {
    // Retry without extra columns if table columns don't exist
    delete insertPayload.outlet_id;
    delete insertPayload.yield_per_unit;
    delete insertPayload.yield_unit;
    const { data: resFallback, error: errFallback } = await supabase
      .from("inventory_items")
      .insert(insertPayload)
      .select()
      .single();

    if (errFallback || !resFallback) {
      throw new Error(errFallback?.message || errWithOutlet?.message || "Gagal membuat bahan baku");
    }
    inserted = resFallback;
  }

  // Save cost_price, supplier_id, yield, and outlet_id into procurement store meta
  const store = await loadProcurementStore(bid);
  store.item_meta = store.item_meta || {};
  store.item_meta[inserted.id] = {
    cost_price: Number(data.cost_price) || 0,
    supplier_id: data.supplier_id || null,
    outlet_id: data.outlet_id || null,
    outlet_name: data.outlet_name || null,
    yield_per_unit: data.yield_per_unit !== undefined && data.yield_per_unit !== null ? Number(data.yield_per_unit) : null,
    yield_unit: data.yield_unit || null,
  };
  await saveProcurementStore(bid, store);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return {
    id: inserted.id,
    business_id: inserted.business_id,
    outlet_id: data.outlet_id || null,
    outlet_name: data.outlet_name || null,
    name: inserted.name,
    category: inserted.category,
    unit: inserted.unit,
    stock: Number(inserted.stock),
    minimum_stock: Number(inserted.minimum_stock),
    cost_price: Number(data.cost_price) || 0,
    supplier_id: data.supplier_id || null,
    yield_per_unit: data.yield_per_unit !== undefined && data.yield_per_unit !== null ? Number(data.yield_per_unit) : null,
    yield_unit: data.yield_unit || null,
    health_score: 100,
    status:
      Number(inserted.stock) <= 0
        ? "habis"
        : Number(inserted.stock) <= Number(inserted.minimum_stock)
          ? "menipis"
          : "aman",
  };
}

/**
 * 3b. CLONE / SYNC MASTER INVENTORY TO OUTLET
 * Duplicates master inventory items from source outlet (or default main/HQ) to a target outlet.
 * Preserves name, category, unit, cost_price / cost_per_unit, yield_per_unit, yield_unit, minimum_stock,
 * but initializes stock: 0.
 * Skips items that already exist in the target outlet (by name comparison).
 */
export async function cloneMasterInventoryToOutlet(
  targetOutletId: string,
  sourceOutletId?: string | null,
  businessId?: string,
): Promise<{ clonedCount: number; skippedCount: number }> {
  if (!targetOutletId) {
    throw new Error("Target outlet ID wajib disertakan untuk clone master inventory");
  }

  const bid = await resolveActiveBusinessId(businessId);
  const allItems = await getInventoryItems(bid);

  // 1. Identify source candidates
  let sourceCandidates: InventoryItemDetail[] = [];
  if (sourceOutletId && sourceOutletId !== "all") {
    sourceCandidates = allItems.filter((i) => i.outlet_id === sourceOutletId);
  } else {
    // Default to items from HQ (outlet_id null or other outlets) or distinct items by name
    const distinctMap = new Map<string, InventoryItemDetail>();
    for (const item of allItems) {
      if (item.outlet_id !== targetOutletId) {
        const key = item.name.trim().toLowerCase();
        if (!distinctMap.has(key)) {
          distinctMap.set(key, item);
        }
      }
    }
    sourceCandidates = Array.from(distinctMap.values());
  }

  // 2. Identify target existing item names to prevent duplicates
  const targetExistingNames = new Set(
    allItems
      .filter((i) => i.outlet_id === targetOutletId)
      .map((i) => i.name.trim().toLowerCase()),
  );

  let clonedCount = 0;
  let skippedCount = 0;

  for (const src of sourceCandidates) {
    const key = src.name.trim().toLowerCase();
    if (targetExistingNames.has(key)) {
      skippedCount++;
      continue;
    }

    try {
      await createInventoryItem(
        {
          name: src.name.trim(),
          category: src.category || "Bahan Baku",
          unit: src.unit || "pcs",
          stock: 0, // Initial stock is 0 for newly cloned branch!
          minimum_stock: src.minimum_stock ?? 5,
          cost_price: src.cost_price || 0,
          outlet_id: targetOutletId,
          yield_per_unit:
            src.yield_per_unit !== undefined && src.yield_per_unit !== null
              ? Number(src.yield_per_unit)
              : null,
          yield_unit: src.yield_unit || null,
          supplier_id: src.supplier_id || null,
        },
        bid,
      );
      targetExistingNames.add(key);
      clonedCount++;
    } catch (err) {
      console.warn(`[cloneMasterInventoryToOutlet] Failed to clone ${src.name}:`, err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return { clonedCount, skippedCount };
}

/**
 * 4. UPDATE INVENTORY ITEM
 */
export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    category?: string;
    unit?: string;
    stock?: number;
    minimum_stock?: number;
    cost_price?: number;
    supplier_id?: string | null;
    outlet_id?: string | null;
    outlet_name?: string | null;
    yield_per_unit?: number | null;
    yield_unit?: string | null;
  },
  businessId?: string,
): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);

  // 1. Try serverless endpoint first (supabaseAdmin)
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "update-item",
        business_id: bid,
        id,
        data,
      }),
    });
    if (res.ok) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("inventory:updated"));
        window.dispatchEvent(new CustomEvent("pos:menu-updated"));
      }
      return;
    }
  } catch (apiErr) {
    console.warn("[inventory.service] POST /api/inventory update-item failed, fallback to client:", apiErr);
  }

  // 2. Client fallback
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.category !== undefined) updatePayload.category = data.category.trim();
  if (data.unit !== undefined) updatePayload.unit = data.unit.trim();
  if (data.stock !== undefined) updatePayload.stock = Number(data.stock);
  if (data.minimum_stock !== undefined) updatePayload.minimum_stock = Number(data.minimum_stock);
  if (data.outlet_id !== undefined) updatePayload.outlet_id = data.outlet_id;
  if (data.yield_per_unit !== undefined) updatePayload.yield_per_unit = data.yield_per_unit !== null ? Number(data.yield_per_unit) : null;
  if (data.yield_unit !== undefined) updatePayload.yield_unit = data.yield_unit;

  const { error } = await supabase
    .from("inventory_items")
    .update(updatePayload as any)
    .eq("id", id);

  if (error) {
    delete updatePayload.outlet_id;
    delete updatePayload.yield_per_unit;
    delete updatePayload.yield_unit;
    const { error: err2 } = await supabase
      .from("inventory_items")
      .update(updatePayload as any)
      .eq("id", id);
    if (err2) {
      throw new Error(err2.message || "Gagal memperbarui bahan baku");
    }
  }

  const store = await loadProcurementStore(bid);
  store.item_meta = store.item_meta || {};
  store.item_meta[id] = {
    ...(store.item_meta[id] || {}),
    ...(data.cost_price !== undefined ? { cost_price: Number(data.cost_price) } : {}),
    ...(data.supplier_id !== undefined ? { supplier_id: data.supplier_id } : {}),
    ...(data.outlet_id !== undefined ? { outlet_id: data.outlet_id } : {}),
    ...(data.outlet_name !== undefined ? { outlet_name: data.outlet_name } : {}),
    ...(data.yield_per_unit !== undefined ? { yield_per_unit: data.yield_per_unit !== null ? Number(data.yield_per_unit) : null } : {}),
    ...(data.yield_unit !== undefined ? { yield_unit: data.yield_unit } : {}),
  };
  await saveProcurementStore(bid, store);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }
}

/**
 * 5. DELETE INVENTORY ITEM
 */
export async function deleteInventoryItem(id: string, businessId?: string): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);

  // 1. Try serverless endpoint first (supabaseAdmin)
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "delete-item",
        business_id: bid,
        id,
      }),
    });
    if (res.ok) {
      if (typeof window !== "undefined") {
        try {
          const snapKey = "kebabschoicepos_snapshot";
          const snapStr = window.localStorage.getItem(snapKey);
          if (snapStr) {
            const snap = JSON.parse(snapStr);
            if (snap.inventory) {
              snap.inventory = snap.inventory.filter((inv: any) => inv.id !== id);
              window.localStorage.setItem(snapKey, JSON.stringify(snap));
            }
          }
        } catch {}

        window.dispatchEvent(new CustomEvent("inventory:updated"));
        window.dispatchEvent(new CustomEvent("pos:menu-updated"));
      }
      return;
    }
  } catch (apiErr) {
    console.warn("[inventory.service] POST /api/inventory delete-item failed, fallback to client:", apiErr);
  }

  // 2. Client fallback
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "Gagal menghapus bahan baku");
  }

  // Also clean up from legacy ingredients table if present
  try {
    await supabase.from("ingredients" as any).delete().eq("id", id);
  } catch {}

  const store = await loadProcurementStore(bid);
  if (store.item_meta && store.item_meta[id]) {
    delete store.item_meta[id];
    await saveProcurementStore(bid, store);
  }

  // Purge from local snapshot cache and notify POS/Menu
  if (typeof window !== "undefined") {
    try {
      const snapKey = "kebabschoicepos_snapshot";
      const snapStr = window.localStorage.getItem(snapKey);
      if (snapStr) {
        const snap = JSON.parse(snapStr);
        if (snap.inventory) {
          snap.inventory = snap.inventory.filter((inv: any) => inv.id !== id);
          window.localStorage.setItem(snapKey, JSON.stringify(snap));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }
}

/**
 * 6. RECORD STOCK IN
 */
export async function recordStockIn(data: {
  inventory_item_id: string;
  quantity: number;
  unit_cost?: number;
  supplier_id?: string;
  reference_no?: string;
  notes?: string;
  business_id?: string;
}): Promise<{ remaining_stock: number }> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-stock-in",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("inventory:updated"));
          window.dispatchEvent(new CustomEvent("pos:menu-updated"));
        }
        return { remaining_stock: json.remaining_stock };
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API record-stock-in fallback:", err);
  }

  // Direct client fallback
  const { data: invItem } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", data.inventory_item_id)
    .single();

  if (!invItem) throw new Error("Bahan baku tidak ditemukan");

  const newStock = Number(invItem.stock) + Number(data.quantity);
  await supabase
    .from("inventory_items")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", data.inventory_item_id);

  const mov: StockMovementRecord = {
    id: `mov-${Date.now()}`,
    business_id: bid,
    inventory_item_id: data.inventory_item_id,
    item_name: invItem.name,
    movement_type: "stock_in",
    quantity: Number(data.quantity),
    unit: invItem.unit,
    remaining_stock: newStock,
    notes: data.reference_no
      ? `Ref: ${data.reference_no}. ${data.notes || ""}`
      : data.notes || "Stok masuk manual",
    created_at: new Date().toISOString(),
  };

  const store = await loadProcurementStore(bid);
  store.stock_movements = [mov, ...(store.stock_movements || [])];
  await saveProcurementStore(bid, store);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return { remaining_stock: newStock };
}

/**
 * 7. RECORD STOCK OUT
 */
export async function recordStockOut(data: {
  inventory_item_id: string;
  quantity: number;
  reason?: string;
  notes?: string;
  business_id?: string;
}): Promise<{ remaining_stock: number }> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-stock-out",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("inventory:updated"));
          window.dispatchEvent(new CustomEvent("pos:menu-updated"));
        }
        return { remaining_stock: json.remaining_stock };
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API record-stock-out fallback:", err);
  }

  // Direct client fallback
  const { data: invItem } = await supabase
    .from("inventory_items")
    .select("stock, unit, name")
    .eq("id", data.inventory_item_id)
    .single();

  if (!invItem) throw new Error("Bahan baku tidak ditemukan");

  const newStock = Math.max(0, Number(invItem.stock) - Number(data.quantity));
  await supabase
    .from("inventory_items")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", data.inventory_item_id);

  const mov: StockMovementRecord = {
    id: `mov-${Date.now()}`,
    business_id: bid,
    inventory_item_id: data.inventory_item_id,
    item_name: invItem.name,
    movement_type: "stock_out",
    quantity: Number(data.quantity),
    unit: invItem.unit,
    remaining_stock: newStock,
    notes: `Alasan: ${data.reason || "Lainnya"}. ${data.notes || ""}`,
    created_at: new Date().toISOString(),
  };

  const store = await loadProcurementStore(bid);
  store.stock_movements = [mov, ...(store.stock_movements || [])];
  await saveProcurementStore(bid, store);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return { remaining_stock: newStock };
}

/**
 * 8. RECORD STOCK ADJUSTMENT
 */
export async function recordStockAdjustment(data: {
  inventory_item_id: string;
  actual_stock: number;
  reason: string;
  notes?: string;
  business_id?: string;
}): Promise<{ difference: number; newStock: number }> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-stock-adjustment",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("inventory:updated"));
          window.dispatchEvent(new CustomEvent("pos:menu-updated"));
        }
        return { difference: json.difference, newStock: json.remaining_stock };
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API record-stock-adjustment fallback:", err);
  }

  // Direct client fallback
  const { data: invItem } = await supabase
    .from("inventory_items")
    .select("stock, unit, name")
    .eq("id", data.inventory_item_id)
    .single();

  if (!invItem) throw new Error("Bahan baku tidak ditemukan");

  const prevStock = Number(invItem.stock);
  const newStock = Number(data.actual_stock);
  const diff = newStock - prevStock;

  await supabase
    .from("inventory_items")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", data.inventory_item_id);

  const mov: StockMovementRecord = {
    id: `mov-${Date.now()}`,
    business_id: bid,
    inventory_item_id: data.inventory_item_id,
    item_name: invItem.name,
    movement_type: "adjustment",
    quantity: diff,
    unit: invItem.unit,
    remaining_stock: newStock,
    notes: `Penyesuaian Fisik (${data.reason}): ${diff > 0 ? "+" : ""}${diff} ${invItem.unit}. ${data.notes || ""}`,
    created_at: new Date().toISOString(),
  };

  const store = await loadProcurementStore(bid);
  store.stock_movements = [mov, ...(store.stock_movements || [])];
  await saveProcurementStore(bid, store);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return { difference: diff, newStock };
}

/**
 * 9. GET STOCK MOVEMENTS
 */
export async function getStockMovements(
  businessId?: string,
  itemId?: string,
): Promise<StockMovementRecord[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(
      `/api/inventory?type=stock-movements&businessId=${encodeURIComponent(bid)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return itemId ? json.data.filter((m: any) => m.inventory_item_id === itemId) : json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API stock-movements error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  const movements: StockMovementRecord[] = store.stock_movements || [];
  return itemId ? movements.filter((m) => m.inventory_item_id === itemId) : movements;
}

/**
 * 10. SUPPLIER MANAGEMENT
 */
export async function getSuppliers(businessId?: string): Promise<SupplierItem[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(`/api/inventory?type=suppliers&businessId=${encodeURIComponent(bid)}`, {
      headers,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API suppliers fetch error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  return store.suppliers || [];
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  product_category?: string;
  notes?: string;
  business_id?: string;
}): Promise<SupplierItem> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-supplier",
        business_id: bid,
        ...data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API create-supplier error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  const newSup: SupplierItem = {
    id: `sup-${Date.now()}`,
    business_id: bid,
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    address: data.address?.trim() || null,
    product_category: data.product_category?.trim() || "Bahan Baku",
    notes: data.notes?.trim() || null,
    purchase_count: 0,
    total_purchased: 0,
    created_at: new Date().toISOString(),
  };
  store.suppliers = [newSup, ...(store.suppliers || [])];
  await saveProcurementStore(bid, store);
  return newSup;
}

export async function updateSupplier(
  id: string,
  data: Partial<Omit<SupplierItem, "id" | "business_id" | "created_at">>,
  businessId?: string,
): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-supplier",
        business_id: bid,
        id,
        data,
      }),
    });
    if (res.ok) return;
  } catch (err) {
    console.warn("[inventory.service] API update-supplier error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  store.suppliers = (store.suppliers || []).map((s: SupplierItem) =>
    s.id === id ? { ...s, ...data } : s,
  );
  await saveProcurementStore(bid, store);
}

export async function deleteSupplier(id: string, businessId?: string): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete-supplier",
        business_id: bid,
        id,
      }),
    });
    if (res.ok) return;
  } catch (err) {
    console.warn("[inventory.service] API delete-supplier error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  store.suppliers = (store.suppliers || []).filter((s: SupplierItem) => s.id !== id);
  await saveProcurementStore(bid, store);
}

/**
 * 11. PURCHASE ORDER MANAGEMENT
 */
export async function getPurchaseOrders(businessId?: string): Promise<PurchaseOrderRecord[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(
      `/api/inventory?type=purchase-orders&businessId=${encodeURIComponent(bid)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API POs fetch error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  return store.purchase_orders || [];
}

export async function createPurchaseOrder(data: {
  supplier_id?: string | null;
  supplier_name?: string | null;
  outlet_id?: string | null;
  outlet_name?: string | null;
  expected_delivery_date?: string | null;
  order_date?: string;
  status?: "draft" | "pending" | "approved" | "received" | "cancelled";
  notes?: string | null;
  items: PurchaseOrderItem[];
  business_id?: string;
}): Promise<PurchaseOrderRecord> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-po",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API create-po error, fallback:", err);
  }

  // Fallback
  const store = await loadProcurementStore(bid);
  const total = data.items.reduce((s, it) => s + (it.subtotal || it.quantity * it.unit_cost), 0);
  const newPO: PurchaseOrderRecord = {
    id: `po-${Date.now()}`,
    business_id: bid,
    po_number: `PO-${Date.now().toString().slice(-6)}`,
    supplier_id: data.supplier_id || null,
    supplier_name: data.supplier_name || null,
    outlet_id: data.outlet_id || null,
    outlet_name: data.outlet_name || "Outlet Utama",
    order_date: data.order_date || (new Date().toISOString().split("T")[0] ?? ""),
    expected_delivery_date: data.expected_delivery_date || null,
    status: data.status || "draft",
    total_amount: total,
    notes: data.notes || null,
    items: data.items,
    created_at: new Date().toISOString(),
  };
  store.purchase_orders = [newPO, ...(store.purchase_orders || [])];
  await saveProcurementStore(bid, store);
  return newPO;
}

export async function updatePOStatus(
  poId: string,
  status: "draft" | "pending" | "approved" | "received" | "cancelled",
  businessId?: string,
): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-po-status",
        business_id: bid,
        po_id: poId,
        status,
      }),
    });
    if (res.ok) return;
  } catch (err) {
    console.warn("[inventory.service] API update-po-status error, fallback:", err);
  }

  // Direct client fallback
  const store = await loadProcurementStore(bid);
  const target = (store.purchase_orders || []).find((p: any) => p.id === poId);
  if (target) {
    target.status = status;
    if (status === "received") {
      target.received_at = new Date().toISOString();
      for (const item of target.items || []) {
        if (item.inventory_item_id) {
          const { data: invRow } = await supabase
            .from("inventory_items")
            .select("stock, unit, name")
            .eq("id", item.inventory_item_id)
            .single();
          if (invRow) {
            const nextStock = Number(invRow.stock) + Number(item.quantity);
            await supabase
              .from("inventory_items")
              .update({ stock: nextStock, updated_at: new Date().toISOString() })
              .eq("id", item.inventory_item_id);

            const movPO: StockMovementRecord = {
              id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              business_id: bid,
              inventory_item_id: item.inventory_item_id,
              item_name: item.item_name || invRow.name,
              outlet_id: target.outlet_id || null,
              movement_type: "stock_in",
              quantity: Number(item.quantity),
              unit: item.unit || invRow.unit || "pcs",
              remaining_stock: nextStock,
              notes: `Penerimaan Purchase Order ${target.po_number || poId}`,
              created_at: new Date().toISOString(),
            };
            store.stock_movements = [movPO, ...(store.stock_movements || [])];
            try {
              await supabase.from("stock_movements" as any).insert({
                business_id: bid,
                inventory_item_id: item.inventory_item_id,
                item_name: item.item_name || invRow.name,
                outlet_id: target.outlet_id || null,
                movement_type: "stock_in",
                quantity: Number(item.quantity),
                unit: item.unit || invRow.unit || "pcs",
                remaining_stock: nextStock,
                notes: `Penerimaan Purchase Order ${target.po_number || poId}`,
                created_at: new Date().toISOString(),
              });
            } catch {}
          }
        }
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("inventory:updated"));
        window.dispatchEvent(new CustomEvent("pos:menu-updated"));
      }

      // Automatically sync and deduct branch money allocation ledger on PO received
      try {
        const poOutletId = target.outlet_id || null;
        const currentLedger = await loadBranchMoneyLedger(poOutletId);
        const updatedSpent = { ...(currentLedger.spent_amounts || {}) };
        const updatedHistory = [...(currentLedger.history || [])];

        for (const itm of target.items || []) {
          const itmCost = (Number(itm.quantity) || 0) * (Number(itm.unit_cost) || 0);
          if (itmCost > 0 && itm.inventory_item_id) {
            updatedSpent[itm.inventory_item_id] = (updatedSpent[itm.inventory_item_id] || 0) + itmCost;
            updatedHistory.unshift({
              id: `po-spend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              date: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              type: "belanja_bahan",
              item_id: itm.inventory_item_id,
              item_name: itm.item_name,
              outlet_id: poOutletId,
              amount: itmCost,
              title: `Belanja PO #${target.po_number || poId}`,
              note: `Penerimaan ${itm.quantity} ${itm.unit} ${itm.item_name}`,
            });
          }
        }

        await saveBranchMoneyLedger(poOutletId, {
          spent_amounts: updatedSpent,
          history: updatedHistory,
        });
      } catch (poLedgerErr) {
        console.warn("[inventory.service] Error updating money ledger on PO received:", poLedgerErr);
      }
    }
    await saveProcurementStore(bid, store);
  }
}

export const updatePurchaseOrderStatus = updatePOStatus;

/**
 * 12. STOCK OPNAME
 */
export async function getStockOpnames(businessId?: string): Promise<StockOpnameRecord[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(
      `/api/inventory?type=stock-opnames&businessId=${encodeURIComponent(bid)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API stock-opnames error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  return store.stock_opnames || [];
}

export async function createStockOpname(
  data: {
    outlet_id?: string;
    outlet_name?: string;
    date?: string;
    status?: "draft" | "completed" | "approved";
    notes?: string;
    conducted_by?: string;
    items: StockOpnameItemDetail[];
  },
  businessId?: string,
): Promise<StockOpnameRecord> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-opname",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API create-opname error, fallback:", err);
  }

  // Fallback
  const store = await loadProcurementStore(bid);
  const newOpname: StockOpnameRecord = {
    id: `opn-${Date.now()}`,
    business_id: bid,
    outlet_id: data.outlet_id || null,
    outlet_name: data.outlet_name || "Outlet",
    opname_number: `OPN-${Date.now().toString().slice(-6)}`,
    date: data.date || (new Date().toISOString().split("T")[0] ?? ""),
    status: data.status || "completed",
    notes: data.notes || null,
    conducted_by: data.conducted_by || "Auditor",
    items: data.items,
    created_at: new Date().toISOString(),
  };

  if (newOpname.status === "approved" || newOpname.status === "completed") {
    for (const item of data.items) {
      if (item.inventory_item_id) {
        await supabase
          .from("inventory_items")
          .update({ stock: item.physical_stock, updated_at: new Date().toISOString() })
          .eq("id", item.inventory_item_id);

        if (item.difference !== 0) {
          const movOpn: StockMovementRecord = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            business_id: bid,
            inventory_item_id: item.inventory_item_id,
            item_name: item.item_name,
            outlet_id: data.outlet_id || null,
            movement_type: "opname",
            quantity: item.difference,
            unit: item.unit,
            remaining_stock: item.physical_stock,
            notes: `Stock Opname (${newOpname.opname_number}): sistem ${item.system_stock} -> fisik ${item.physical_stock} (selisih: ${item.difference > 0 ? "+" : ""}${item.difference}). ${item.notes || ""}`,
            created_at: new Date().toISOString(),
          };
          store.stock_movements = [movOpn, ...(store.stock_movements || [])];
          try {
            await supabase.from("stock_movements" as any).insert({
              business_id: bid,
              inventory_item_id: item.inventory_item_id,
              item_name: item.item_name,
              outlet_id: data.outlet_id || null,
              movement_type: "opname",
              quantity: item.difference,
              unit: item.unit,
              remaining_stock: item.physical_stock,
              notes: `Stock Opname (${newOpname.opname_number}): sistem ${item.system_stock} -> fisik ${item.physical_stock}`,
              created_at: new Date().toISOString(),
            });
          } catch {}
        }
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inventory:updated"));
      window.dispatchEvent(new CustomEvent("pos:menu-updated"));
    }
  }

  store.stock_opnames = [newOpname, ...(store.stock_opnames || [])];
  await saveProcurementStore(bid, store);
  return newOpname;
}

/**
 * 13. WASTE MANAGEMENT
 */
export async function getWasteRecords(businessId?: string): Promise<WasteRecordDetail[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(
      `/api/inventory?type=waste-records&businessId=${encodeURIComponent(bid)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API waste-records error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  return store.waste_records || [];
}

export async function recordWaste(data: {
  inventory_item_id: string;
  quantity: number;
  reason?: string;
  cost_loss?: number;
  notes?: string;
  business_id?: string;
}): Promise<WasteRecordDetail> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-waste",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API record-waste error, fallback:", err);
  }

  // Direct client fallback
  const { data: invItem } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", data.inventory_item_id)
    .single();

  const itemName = invItem?.name || "Bahan Baku";
  const unit = invItem?.unit || "pcs";
  const finalCost = data.cost_loss || Number(data.quantity) * (Number(invItem?.cost_price) || 0);

  const newWaste: WasteRecordDetail = {
    id: `waste-${Date.now()}`,
    business_id: bid,
    inventory_item_id: data.inventory_item_id,
    item_name: itemName,
    quantity: Number(data.quantity),
    unit,
    cost_loss: finalCost,
    reason: (data.reason as any) || "Expired",
    notes: data.notes || null,
    created_by: "Supervisor",
    created_at: new Date().toISOString(),
  };

  const store = await loadProcurementStore(bid);
  let newStock = 0;
  if (invItem) {
    newStock = Math.max(0, Number(invItem.stock) - Number(data.quantity));
    await supabase
      .from("inventory_items")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", data.inventory_item_id);

    const movWaste: StockMovementRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      business_id: bid,
      inventory_item_id: data.inventory_item_id,
      item_name: itemName,
      movement_type: "waste",
      quantity: Number(data.quantity),
      unit,
      remaining_stock: newStock,
      notes: `Waste/Rusak (${data.reason || "Expired"}). ${data.notes || ""}`,
      created_at: new Date().toISOString(),
    };
    store.stock_movements = [movWaste, ...(store.stock_movements || [])];
    try {
      await supabase.from("stock_movements" as any).insert({
        business_id: bid,
        inventory_item_id: data.inventory_item_id,
        item_name: itemName,
        movement_type: "waste",
        quantity: Number(data.quantity),
        unit,
        remaining_stock: newStock,
        notes: `Waste/Rusak (${data.reason || "Expired"}). ${data.notes || ""}`,
        created_at: new Date().toISOString(),
      });
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inventory:updated"));
      window.dispatchEvent(new CustomEvent("pos:menu-updated"));
    }
  }

  store.waste_records = [newWaste, ...(store.waste_records || [])];
  await saveProcurementStore(bid, store);
  return newWaste;
}

/**
 * 14. STOCK TRANSFERS
 */
export async function getStockTransfers(businessId?: string): Promise<StockTransferRecord[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  let resultList: StockTransferRecord[] = [];
  try {
    const res = await fetch(
      `/api/inventory?type=stock-transfers&businessId=${encodeURIComponent(bid)}`,
      {
        headers,
      },
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        resultList = json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API stock-transfers error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  if (resultList.length === 0) {
    resultList = store.stock_transfers || [];
  } else {
    for (const t of resultList) {
      if (!t.items || t.items.length === 0) {
        const matched = (store.stock_transfers || []).find(
          (s: any) => s.id === t.id || s.transfer_number === t.transfer_number,
        );
        if (matched && Array.isArray(matched.items) && matched.items.length > 0) {
          t.items = matched.items;
          if (!t.origin_outlet_name && matched.origin_outlet_name) {
            t.origin_outlet_name = matched.origin_outlet_name;
          }
          if (!t.destination_outlet_name && matched.destination_outlet_name) {
            t.destination_outlet_name = matched.destination_outlet_name;
          }
        }
      }
    }
  }
  return resultList;
}

export async function createStockTransfer(data: {
  origin_outlet_id?: string;
  origin_outlet_name?: string;
  destination_outlet_id?: string;
  destination_outlet_name?: string;
  status?: "requested" | "approved" | "sent" | "received" | "cancelled";
  notes?: string;
  items: StockTransferItemDetail[];
  business_id?: string;
}): Promise<StockTransferRecord> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-transfer",
        business_id: bid,
        data,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API create-transfer error, fallback:", err);
  }

  // Fallback
  const store = await loadProcurementStore(bid);
  const newTransfer: StockTransferRecord = {
    id: `trf-${Date.now()}`,
    business_id: bid,
    transfer_number: `TRF-${Date.now().toString().slice(-6)}`,
    origin_outlet_id: data.origin_outlet_id || null,
    origin_outlet_name: data.origin_outlet_name || "Gudang Utama",
    destination_outlet_id: data.destination_outlet_id || null,
    destination_outlet_name: data.destination_outlet_name || "Cabang",
    status: data.status || "requested",
    notes: data.notes || null,
    items: data.items,
    created_at: new Date().toISOString(),
  };

  store.stock_transfers = [newTransfer, ...(store.stock_transfers || [])];
  await saveProcurementStore(bid, store);
  return newTransfer;
}

export async function updateStockTransferStatus(
  transferId: string,
  status: "approved" | "sent" | "received" | "cancelled",
  businessId?: string,
): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-transfer-status",
        business_id: bid,
        transfer_id: transferId,
        status,
      }),
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json().catch(() => null);
        if (!json || json.success !== false) {
          return;
        }
      } else {
        return;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API update-transfer-status error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  let dbTrf: any = null;
  try {
    const { data } = await supabase
      .from("stock_transfers" as any)
      .select(`*, items:stock_transfer_items(*)`)
      .eq("id", transferId)
      .maybeSingle();
    dbTrf = data;
  } catch {}

  const storeTrf = (store.stock_transfers || []).find(
    (t: any) =>
      t.id === transferId || (dbTrf?.transfer_number && t.transfer_number === dbTrf.transfer_number),
  );
  const target = storeTrf || dbTrf;
  const prevStatus = dbTrf?.status || storeTrf?.status || target?.status;
  const transferNum = target?.transfer_number || transferId;

  let alreadyDeducted =
    prevStatus === "received" ||
    prevStatus === "completed" ||
    Boolean(storeTrf?.stock_deducted) ||
    Boolean(dbTrf?.stock_deducted) ||
    Boolean(target?.stock_deducted);

  if (status === "received" && !alreadyDeducted && transferNum) {
    const inStoreMov = (store.stock_movements || []).some(
      (m: any) =>
        m.movement_type === "transfer_out" &&
        String(m.notes || "").includes(`(${transferNum})`),
    );
    if (inStoreMov) {
      alreadyDeducted = true;
    } else {
      try {
        const { data: existingMovs } = await (supabase
          .from("stock_movements" as any)
          .select("id")
          .eq("movement_type", "transfer_out") as any)
          .ilike("notes", `%(${transferNum})%`)
          .limit(1);
        if (Array.isArray(existingMovs) && existingMovs.length > 0) {
          alreadyDeducted = true;
        }
      } catch {}
    }
  }

  let claimedInDb = true;
  if (status === "received" && !alreadyDeducted && dbTrf?.id) {
    try {
      const claimRes = await (supabase
        .from("stock_transfers" as any)
        .update({ status: "received", updated_at: new Date().toISOString() })
        .eq("id", dbTrf.id) as any)
        .neq("status", "received")
        .neq("status", "completed")
        .select("id")
        .maybeSingle();
      if (!claimRes.error && !claimRes.data) {
        claimedInDb = false;
      }
    } catch {}
  }

  if (target) {
    target.status = status;
    if (status === "sent") target.sent_at = new Date().toISOString();
    if (status === "received") {
      target.received_at = new Date().toISOString();
      target.stock_deducted = true;
    }

    if (status === "received" && !alreadyDeducted && claimedInDb) {
      const originOutletId = target.origin_outlet_id || null;
      const destOutletId = target.destination_outlet_id || null;
      const originName = target.origin_outlet_name || "Gudang Asal";
      const destName = target.destination_outlet_name || "Cabang Tujuan";

      for (const it of target.items || []) {
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) continue;

        let originItem: any = null;
        if (it.inventory_item_id) {
          const { data: exactOrigin } = await supabase
            .from("inventory_items")
            .select("*")
            .eq("id", it.inventory_item_id)
            .maybeSingle();
          originItem = exactOrigin;
        }
        if (!originItem && (it.item_name || it.name)) {
          const rawName = String(it.item_name || it.name).trim();
          const { data: candidates } = await (supabase
            .from("inventory_items" as any)
            .select("*")
            .eq("business_id", bid) as any)
            .ilike("name", rawName);
          if (Array.isArray(candidates) && candidates.length > 0) {
            originItem =
              (originOutletId && candidates.find((c: any) => c.outlet_id === originOutletId)) ||
              candidates[0];
          }
        }

        if (originItem) {
          const originId = originItem.id;
          const newOriginStock = Math.max(0, (Number(originItem.stock) || 0) - qty);
          await supabase
            .from("inventory_items")
            .update({ stock: newOriginStock, updated_at: new Date().toISOString() })
            .eq("id", originId);

          const movOut: StockMovementRecord = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            business_id: bid,
            inventory_item_id: originId,
            item_name: it.item_name || originItem.name,
            outlet_id: originOutletId,
            movement_type: "transfer_out",
            quantity: qty,
            unit: it.unit || originItem.unit || "pcs",
            remaining_stock: newOriginStock,
            notes: `Transfer Keluar ke ${destName} (${target.transfer_number || transferId})`,
            created_at: new Date().toISOString(),
          };
          store.stock_movements = [movOut, ...(store.stock_movements || [])];
          await insertStockMovementClientDb(movOut);

          if (!store.item_meta) store.item_meta = {};
          const originMeta = store.item_meta[originId] || {};
          const resolvedName = String(it.item_name || originItem.name || "").trim();
          const params = resolveInventoryIngredientParams({
            name: resolvedName,
            unit: it.unit || originItem.unit || "pcs",
            cost_price: Number(originItem.cost_price) || Number(originMeta.cost_price) || 0,
            yield_per_unit: originItem.yield_per_unit ?? originMeta.yield_per_unit ?? null,
            yield_unit: originItem.yield_unit ?? originMeta.yield_unit ?? null,
          });
          const resolvedSupplierId = originItem.supplier_id ?? originMeta.supplier_id ?? null;
          const resolvedMinStock = Number(
            originItem.minimum_stock ?? originMeta.minimum_stock ?? 10,
          );
          const resolvedCategory = originItem.category || originMeta.category || "Bahan Baku";

          let destItem: any = null;
          if (destOutletId) {
            const { data: existingDest } = await (supabase
              .from("inventory_items" as any)
              .select("*")
              .eq("business_id", bid) as any)
              .eq("outlet_id", destOutletId)
              .ilike("name", resolvedName)
              .maybeSingle();
            destItem = existingDest;
          }

          if (destItem) {
            const newDestStock = (Number(destItem.stock) || 0) + qty;
            await supabase
              .from("inventory_items")
              .update({ stock: newDestStock, updated_at: new Date().toISOString() })
              .eq("id", destItem.id);

            const existingDestMeta = store.item_meta[destItem.id] || {};
            store.item_meta[destItem.id] = {
              ...existingDestMeta,
              cost_price: Number(existingDestMeta.cost_price) || params.costPrice,
              yield_per_unit: existingDestMeta.yield_per_unit ?? params.yieldPerUnit,
              yield_unit: existingDestMeta.yield_unit ?? params.yieldUnit,
              supplier_id: existingDestMeta.supplier_id ?? resolvedSupplierId,
              minimum_stock: existingDestMeta.minimum_stock ?? resolvedMinStock,
              outlet_id: destOutletId,
            };

            const movIn: StockMovementRecord = {
              id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              business_id: bid,
              inventory_item_id: destItem.id,
              item_name: destItem.name,
              outlet_id: destOutletId,
              movement_type: "transfer_in",
              quantity: qty,
              unit: destItem.unit || params.unit,
              remaining_stock: newDestStock,
              notes: `Transfer Masuk dari ${originName} (${target.transfer_number || transferId})`,
              created_at: new Date().toISOString(),
            };
            store.stock_movements = [movIn, ...(store.stock_movements || [])];
            await insertStockMovementClientDb(movIn);
          } else if (destOutletId) {
            try {
              let createdDest: any = null;
              const fullRes = await (supabase
                .from("inventory_items" as any)
                .insert({
                  business_id: bid,
                  outlet_id: destOutletId,
                  name: resolvedName,
                  category: resolvedCategory,
                  unit: params.unit,
                  stock: qty,
                  minimum_stock: resolvedMinStock,
                  cost_price: params.costPrice,
                  yield_per_unit: params.yieldPerUnit,
                  yield_unit: params.yieldUnit,
                  supplier_id: resolvedSupplierId,
                  health_score: 100,
                } as any) as any)
                .select()
                .single();

              if (!fullRes.error && fullRes.data) {
                createdDest = fullRes.data;
              } else {
                const baseRes = await (supabase
                  .from("inventory_items" as any)
                  .insert({
                    business_id: bid,
                    outlet_id: destOutletId,
                    name: resolvedName,
                    category: resolvedCategory,
                    unit: params.unit,
                    stock: qty,
                    minimum_stock: resolvedMinStock,
                    health_score: 100,
                  } as any) as any)
                  .select()
                  .single();
                if (!baseRes.error && baseRes.data) {
                  createdDest = baseRes.data;
                }
              }

              if (createdDest) {
                store.item_meta[createdDest.id] = {
                  cost_price: params.costPrice,
                  yield_per_unit: params.yieldPerUnit,
                  yield_unit: params.yieldUnit,
                  supplier_id: resolvedSupplierId,
                  minimum_stock: resolvedMinStock,
                  outlet_id: destOutletId,
                  ...(originMeta.pack_configs ? { pack_configs: originMeta.pack_configs } : {}),
                };

                const movIn: StockMovementRecord = {
                  id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  business_id: bid,
                  inventory_item_id: createdDest.id,
                  item_name: createdDest.name,
                  outlet_id: destOutletId,
                  movement_type: "transfer_in",
                  quantity: qty,
                  unit: createdDest.unit || params.unit,
                  remaining_stock: qty,
                  notes: `Transfer Masuk dari ${originName} (${target.transfer_number || transferId})`,
                  created_at: new Date().toISOString(),
                };
                store.stock_movements = [movIn, ...(store.stock_movements || [])];
                await insertStockMovementClientDb(movIn);
              }
            } catch {}
          }
        }
      }
    }

    try {
      await supabase
        .from("stock_transfers" as any)
        .update({
          status,
          ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
          ...(status === "received" ? { received_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transferId);
    } catch {}

    await saveProcurementStore(bid, store);
  }
}
