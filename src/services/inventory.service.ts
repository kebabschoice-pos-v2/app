import { supabase } from "@/integrations/supabase/client";
import { resolveActiveBusinessId, resolveAllUserBusinessIds } from "./menu.service";

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

  return (dbItems || []).map((row) => {
    const meta = extraMeta[row.id] || {};
    const stockVal = Number(row.stock) || 0;
    const minVal = Number(row.minimum_stock) || 0;
    const costPrice = Number(row.cost_price ?? meta.cost_price ?? 0);
    const supplierId = meta.supplier_id || null;
    const matchedSup = suppliers.find((s) => s.id === supplierId);
    const outletId = (row as any).outlet_id || meta.outlet_id || null;
    const outletName = meta.outlet_name || null;

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
      status,
    };
  });
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
  },
  businessId?: string,
): Promise<InventoryItemDetail> {
  const bid = await resolveActiveBusinessId(businessId);

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

  const { data: resWithOutlet, error: errWithOutlet } = await supabase
    .from("inventory_items")
    .insert(insertPayload)
    .select()
    .single();

  if (resWithOutlet) {
    inserted = resWithOutlet;
  } else {
    // Retry without outlet_id column if table column doesn't exist
    delete insertPayload.outlet_id;
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

  // Save cost_price, supplier_id, and outlet_id into procurement store meta
  const store = await loadProcurementStore(bid);
  store.item_meta = store.item_meta || {};
  store.item_meta[inserted.id] = {
    cost_price: Number(data.cost_price) || 0,
    supplier_id: data.supplier_id || null,
    outlet_id: data.outlet_id || null,
    outlet_name: data.outlet_name || null,
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

  const { error } = await supabase
    .from("inventory_items")
    .update(updatePayload as any)
    .eq("id", id);

  if (error) {
    if (data.outlet_id !== undefined) {
      delete updatePayload.outlet_id;
      const { error: err2 } = await supabase
        .from("inventory_items")
        .update(updatePayload as any)
        .eq("id", id);
      if (err2) {
        throw new Error(err2.message || "Gagal memperbarui bahan baku");
      }
    } else {
      throw new Error(error.message || "Gagal memperbarui bahan baku");
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
    }
    await saveProcurementStore(bid, store);
  }
}

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
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[inventory.service] API stock-transfers error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  return store.stock_transfers || [];
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
    if (res.ok) return;
  } catch (err) {
    console.warn("[inventory.service] API update-transfer-status error, fallback:", err);
  }

  const store = await loadProcurementStore(bid);
  const target = (store.stock_transfers || []).find((t: any) => t.id === transferId);
  const prevStatus = target?.status;
  if (target) {
    target.status = status;
    if (status === "sent") target.sent_at = new Date().toISOString();
    if (status === "received") target.received_at = new Date().toISOString();

    if (status === "received" && prevStatus !== "received") {
      const originOutletId = target.origin_outlet_id || null;
      const destOutletId = target.destination_outlet_id || null;
      const originName = target.origin_outlet_name || "Gudang Asal";
      const destName = target.destination_outlet_name || "Cabang Tujuan";

      for (const it of target.items || []) {
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) continue;

        if (it.inventory_item_id) {
          const { data: originItem } = await supabase
            .from("inventory_items")
            .select("*")
            .eq("id", it.inventory_item_id)
            .single();

          if (originItem) {
            const newOriginStock = Math.max(0, (Number(originItem.stock) || 0) - qty);
            await supabase
              .from("inventory_items")
              .update({ stock: newOriginStock })
              .eq("id", it.inventory_item_id);

            const movOut: StockMovementRecord = {
              id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              business_id: bid,
              inventory_item_id: it.inventory_item_id,
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

            let destItem: any = null;
            if (destOutletId) {
              const { data: existingDest } = await (supabase
                .from("inventory_items" as any)
                .select("*")
                .eq("business_id", bid) as any)
                .eq("outlet_id", destOutletId)
                .ilike("name", (it.item_name || originItem.name).trim())
                .maybeSingle();
              destItem = existingDest;
            }

            if (destItem) {
              const newDestStock = (Number(destItem.stock) || 0) + qty;
              await supabase
                .from("inventory_items")
                .update({ stock: newDestStock })
                .eq("id", destItem.id);

              const movIn: StockMovementRecord = {
                id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                business_id: bid,
                inventory_item_id: destItem.id,
                item_name: destItem.name,
                outlet_id: destOutletId,
                movement_type: "transfer_in",
                quantity: qty,
                unit: destItem.unit || it.unit,
                remaining_stock: newDestStock,
                notes: `Transfer Masuk dari ${originName} (${target.transfer_number || transferId})`,
                created_at: new Date().toISOString(),
              };
              store.stock_movements = [movIn, ...(store.stock_movements || [])];
            }
          }
        }
      }
    }

    await saveProcurementStore(bid, store);
  }
}
