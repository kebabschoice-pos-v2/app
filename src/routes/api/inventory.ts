import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function insertStockMovementDb(dbClient: any, mov: Record<string, any>) {
  const { id: _ignoreMovId, ...payloadWithoutId } = mov;
  try {
    const res = await dbClient.from("stock_movements" as any).insert(payloadWithoutId);
    if (!res?.error) return;
  } catch {}

  try {
    await dbClient.from("stock_movements" as any).insert({
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

async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: "Authorization token missing", status: 401 };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { error: "Supabase configuration missing", status: 500 };
  }

  const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: "Session tidak valid", status: 401 };
  }

  return { user: authData.user };
}

async function resolveUserBusinessIds(
  userId: string,
  requestedBusinessId?: string | null,
): Promise<{ primaryId: string; allIds: string[] }> {
  // Check owned businesses
  const { data: owned } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const ownedIds = (owned || []).map((b) => b.id);

  // Check business_members
  const { data: members } = await supabaseAdmin
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId);

  const memberIds = (members || []).map((m) => m.business_id);

  const combined = Array.from(new Set([...ownedIds, ...memberIds].filter(Boolean)));

  // Security: NEVER trust a requestedBusinessId that does not belong to the authenticated user!
  const primaryId =
    requestedBusinessId && combined.includes(requestedBusinessId)
      ? requestedBusinessId
      : combined[0] || "";

  return {
    primaryId,
    allIds: combined,
  };
}

/**
 * Slices a combined business procurement store down to the subset that belongs to a single outlet
 * (or HQ / unassigned when outletId is null) so saving per-outlet never duplicates records across branches.
 */
function sliceProcurementStoreForOutlet(
  store: Record<string, any>,
  outletId: string | null,
  isPrimaryOutlet: boolean,
): Record<string, any> {
  const belongsToOutlet = (recOutletId: string | null | undefined) => {
    if (outletId && recOutletId === outletId) return true;
    if (!recOutletId && isPrimaryOutlet) return true;
    return false;
  };

  const rawMeta = store.item_meta && typeof store.item_meta === "object" ? store.item_meta : {};
  const item_meta: Record<string, any> = {};
  for (const [itemId, metaVal] of Object.entries(rawMeta)) {
    const m = (metaVal as any) || {};
    if (belongsToOutlet(m.outlet_id)) {
      item_meta[itemId] = m;
    }
  }

  return {
    // Suppliers are business-wide master records; store them only on the primary outlet to avoid cross-branch duplication
    suppliers: isPrimaryOutlet ? store.suppliers || [] : [],
    item_meta,
    purchase_orders: (store.purchase_orders || []).filter((p: any) => belongsToOutlet(p?.outlet_id)),
    stock_transfers: (store.stock_transfers || []).filter(
      (t: any) =>
        belongsToOutlet(t?.origin_outlet_id) ||
        (outletId && t?.destination_outlet_id === outletId),
    ),
    stock_opnames: (store.stock_opnames || []).filter((o: any) => belongsToOutlet(o?.outlet_id)),
    waste_records: (store.waste_records || []).filter((w: any) => belongsToOutlet(w?.outlet_id)),
    stock_movements: (store.stock_movements || []).filter((m: any) => belongsToOutlet(m?.outlet_id)),
  };
}

// Helper: load stored procurement data from outlets.settings (partitioned per outlet_id)
async function loadProcurementStore(businessIds: string[] | string): Promise<Record<string, any>> {
  const ids = (Array.isArray(businessIds) ? businessIds : [businessIds]).filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("id, settings")
      .in("business_id", ids)
      .order("created_at", { ascending: true });

    let mergedStore: Record<string, any> = {};
    for (const o of outlets || []) {
      const s = (o.settings as any) || {};
      const proc = s.procurement || {};
      mergedStore = {
        ...mergedStore,
        ...proc,
        item_meta: { ...(mergedStore.item_meta || {}), ...(proc.item_meta || {}) },
        suppliers: [...(mergedStore.suppliers || []), ...(proc.suppliers || [])],
        purchase_orders: [...(mergedStore.purchase_orders || []), ...(proc.purchase_orders || [])],
        stock_transfers: [...(mergedStore.stock_transfers || []), ...(proc.stock_transfers || [])],
        stock_opnames: [...(mergedStore.stock_opnames || []), ...(proc.stock_opnames || [])],
        waste_records: [...(mergedStore.waste_records || []), ...(proc.waste_records || [])],
        stock_movements: [...(mergedStore.stock_movements || []), ...(proc.stock_movements || [])],
      };
    }

    const dedup = (arr: any[]) => {
      const seen = new Set();
      return arr.filter((item) => {
        if (!item || !item.id) return true;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };
    if (mergedStore.suppliers) mergedStore.suppliers = dedup(mergedStore.suppliers);
    if (mergedStore.purchase_orders) mergedStore.purchase_orders = dedup(mergedStore.purchase_orders);
    if (mergedStore.stock_transfers) mergedStore.stock_transfers = dedup(mergedStore.stock_transfers);
    if (mergedStore.stock_opnames) mergedStore.stock_opnames = dedup(mergedStore.stock_opnames);
    if (mergedStore.waste_records) mergedStore.waste_records = dedup(mergedStore.waste_records);
    if (mergedStore.stock_movements) mergedStore.stock_movements = dedup(mergedStore.stock_movements);

    return mergedStore;
  } catch (err) {
    console.warn("[api/inventory] Error reading procurement settings:", err);
  }
  return {};
}

// Helper: save procurement store partitioned per outlet_id (never dumping the combined store into every outlet)
async function saveProcurementStore(businessIds: string[] | string, store: Record<string, any>): Promise<void> {
  const ids = (Array.isArray(businessIds) ? businessIds : [businessIds]).filter(Boolean);
  if (ids.length === 0) return;
  try {
    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("id, settings")
      .in("business_id", ids)
      .order("created_at", { ascending: true });

    const outletList = outlets || [];
    for (let idx = 0; idx < outletList.length; idx++) {
      const o = outletList[idx]!;
      const current = (o.settings as any) || {};
      const outletSlice = sliceProcurementStoreForOutlet(store, o.id, idx === 0);
      const updated = { ...current, procurement: outletSlice };
      await supabaseAdmin
        .from("outlets")
        .update({ settings: updated, updated_at: new Date().toISOString() })
        .eq("id", o.id);
    }
  } catch (err) {
    console.warn("[api/inventory] Error saving procurement settings:", err);
  }
}

function mergeAndDeduplicate(listA: any[] = [], listB: any[] = [], sortField = "created_at", ascending = false): any[] {
  const map = new Map<string, any>();
  for (const item of listA || []) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of listB || []) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const result = Array.from(map.values());
  result.sort((a, b) => {
    const valA = a[sortField] || "";
    const valB = b[sortField] || "";
    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });
  return result;
}

export const Route = createFileRoute("/api/inventory")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          if ("error" in auth) {
            return Response.json({ error: auth.error }, { status: auth.status });
          }

          const url = new URL(request.url);
          const type = url.searchParams.get("type") || "all";
          const requestedBusinessId = url.searchParams.get("businessId");
          const { primaryId, allIds } = await resolveUserBusinessIds(auth.user.id, requestedBusinessId);

          if (!primaryId && allIds.length === 0) {
            return Response.json({ error: "business_id tidak ditemukan" }, { status: 400 });
          }

          const businessId = primaryId;
          const store = await loadProcurementStore(allIds);

          // 0. INVENTORY ITEMS (Single Source of Truth — strictly scoped to authenticated businessIds)
          if (type === "items") {
            let dbItems: any[] = [];
            try {
              const { data, error } = await supabaseAdmin
                .from("inventory_items")
                .select("*")
                .in("business_id", allIds)
                .order("name", { ascending: true });

              if (!error && Array.isArray(data)) {
                dbItems = data;
              }
            } catch (err) {
              console.error("[api/inventory] Error querying inventory_items:", err);
              dbItems = [];
            }

            const suppliers = store.suppliers || [];
            const extraMeta = store.item_meta || {};

            // Resolve active outlet names directly from outlets table (strictly scoped to business_id)
            // and exclude archived/deleted outlets so shadow branches (e.g. Kebab's.Choice test) never pollute HQ stock
            const outletNameMap = new Map<string, string>();
            const archivedOutletIds = new Set<string>();
            const archivedOutletNames = new Set<string>();
            try {
              const { data: outletRows } = await supabaseAdmin
                .from("outlets")
                .select("id, name, settings")
                .in("business_id", allIds);
              for (const o of (outletRows || []) as any[]) {
                const s = (o?.settings && typeof o.settings === "object" ? o.settings : {}) as Record<string, any>;
                const isArchived = Boolean(s.archived === true || s.deleted_at || o?.deleted_at || o?.is_deleted === true);
                if (isArchived) {
                  if (o?.id) archivedOutletIds.add(o.id);
                  if (o?.name) archivedOutletNames.add(String(o.name).trim().toLowerCase());
                } else if (o?.id && o?.name) {
                  outletNameMap.set(o.id, o.name);
                }
              }
            } catch {}

            const activeDbItems = dbItems.filter((row: any) => {
              const meta = extraMeta[row.id] || {};
              const oid = row.outlet_id || meta.outlet_id || null;
              if (oid && archivedOutletIds.has(oid)) return false;
              const oNameLower = String(meta.outlet_name || "").trim().toLowerCase();
              if (!oid && oNameLower && archivedOutletNames.has(oNameLower)) return false;
              return true;
            });

            const mappedItems = activeDbItems.map((row: any) => {
              const meta = extraMeta[row.id] || {};
              const stockVal = Number(row.stock) || 0;
              const minVal = Number(row.minimum_stock) || 0;
              const dbCostVal = Number(row.cost_price) || 0;
              const metaCostVal = Number(meta.cost_price) || 0;
              let costPrice =
                metaCostVal > 0 && (dbCostVal <= 0 || (dbCostVal === 1000 && metaCostVal !== 1000))
                  ? metaCostVal
                  : dbCostVal > 0
                    ? dbCostVal
                    : metaCostVal;
              const supplierId = row.supplier_id || meta.supplier_id || null;
              const matchedSup = suppliers.find((s: any) => s.id === supplierId);
              const outletId = row.outlet_id || meta.outlet_id || null;
              const outletName = (outletId ? outletNameMap.get(outletId) : null) || meta.outlet_name || null;
              let yieldPerUnit =
                typeof row.yield_per_unit === "number" && row.yield_per_unit > 0
                  ? row.yield_per_unit
                  : typeof meta.yield_per_unit === "number" && meta.yield_per_unit > 0
                    ? meta.yield_per_unit
                    : meta.yield_per_unit
                      ? Number(meta.yield_per_unit) || null
                      : null;
              let yieldUnit = row.yield_unit || meta.yield_unit || null;

              // Only provide intelligent fallbacks if values are uninitialized (<= 0). Never overwrite valid user updates!
              const rowNameLower = (row.name || "").toLowerCase();
              if (rowNameLower.includes("tortilla")) {
                if (costPrice <= 0 || costPrice === 1000) costPrice = 25000;
                if (!yieldPerUnit || yieldPerUnit <= 1) yieldPerUnit = 20;
                if (!yieldUnit) yieldUnit = "pcs";
              } else if (rowNameLower.includes("daging")) {
                if (costPrice <= 0 || costPrice === 1000) costPrice = 120000;
                if (!yieldPerUnit || yieldPerUnit <= 1) yieldPerUnit = 2000;
                if (!yieldUnit) yieldUnit = "gram";
              }

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
                ai_alert: row.ai_alert || null,
                updated_at: row.updated_at,
                yield_per_unit: yieldPerUnit,
                yield_unit: yieldUnit,
                status,
              };
            });

            // Read-only in-memory deduplication: if multiple items share the same outlet and name,
            // pick the most valid item (highest cost / most recent update) without mutating database in GET
            const dedupMap = new Map<string, any>();
            for (const item of mappedItems) {
              const k = `${(item.outlet_id || "hq").toLowerCase()}___${item.name.trim().toLowerCase()}`;
              if (!dedupMap.has(k)) {
                dedupMap.set(k, item);
              } else {
                const existing = dedupMap.get(k);
                const itemCost = item.cost_price || 0;
                const existingCost = existing.cost_price || 0;
                if (itemCost > existingCost) {
                  dedupMap.set(k, item);
                } else if (itemCost === existingCost) {
                  const itemTime = item.updated_at ? new Date(item.updated_at).getTime() : 0;
                  const existTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
                  if (itemTime > existTime) {
                    dedupMap.set(k, item);
                  }
                }
              }
            }

            return Response.json({ success: true, data: Array.from(dedupMap.values()) });
          }

          // 1. SUPPLIERS
          if (type === "suppliers") {
            let dbSuppliers: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("suppliers" as any)
                .select("*")
                .in("business_id", allIds)
                .order("name", { ascending: true });
              if (data) dbSuppliers = data;
            } catch {}

            const merged = mergeAndDeduplicate(dbSuppliers, store.suppliers || [], "name", true);
            return Response.json({ success: true, data: merged });
          }

          // 2. PURCHASE ORDERS
          if (type === "purchase-orders") {
            let dbOrders: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("purchase_orders" as any)
                .select(`*, items:purchase_order_items(*)`)
                .in("business_id", allIds)
                .order("created_at", { ascending: false });
              if (data) dbOrders = data;
            } catch {}

            const merged = mergeAndDeduplicate(dbOrders, store.purchase_orders || [], "created_at", false);
            return Response.json({ success: true, data: merged });
          }

          // 3. STOCK TRANSFERS
          if (type === "stock-transfers") {
            let dbTransfers: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("stock_transfers" as any)
                .select(`*, items:stock_transfer_items(*)`)
                .in("business_id", allIds)
                .order("created_at", { ascending: false });
              if (data) dbTransfers = data;
            } catch {}

            // Load outlet names map to enrich transfers (strictly scoped to business_id)
            let outletNameMap = new Map<string, string>();
            try {
              const { data: outData } = await supabaseAdmin
                .from("outlets")
                .select("id, name")
                .in("business_id", allIds);
              if (outData && Array.isArray(outData)) {
                for (const o of outData as any[]) {
                  outletNameMap.set(o.id, o.name || "Cabang");
                }
              }
            } catch {}

            // Enrich transfers with outlet names and items
            for (const t of dbTransfers) {
              if (t.origin_outlet_id && (!t.origin_outlet_name || t.origin_outlet_name === "Pusat")) {
                t.origin_outlet_name = outletNameMap.get(t.origin_outlet_id) || t.origin_outlet_name || "Gudang Utama";
              }
              if (t.destination_outlet_id && (!t.destination_outlet_name || t.destination_outlet_name === "Cabang")) {
                t.destination_outlet_name = outletNameMap.get(t.destination_outlet_id) || t.destination_outlet_name || "Outlet Cabang";
              }
              // If items is empty in DB row, fall back to stored transfer items
              if (!t.items || t.items.length === 0) {
                const matchedStoreTrf = (store.stock_transfers || []).find(
                  (st: any) => st.id === t.id || st.transfer_number === t.transfer_number,
                );
                if (matchedStoreTrf && Array.isArray(matchedStoreTrf.items) && matchedStoreTrf.items.length > 0) {
                  t.items = matchedStoreTrf.items;
                  if (!t.origin_outlet_name && matchedStoreTrf.origin_outlet_name) {
                    t.origin_outlet_name = matchedStoreTrf.origin_outlet_name;
                  }
                  if (!t.destination_outlet_name && matchedStoreTrf.destination_outlet_name) {
                    t.destination_outlet_name = matchedStoreTrf.destination_outlet_name;
                  }
                }
              }
            }

            const merged = mergeAndDeduplicate(dbTransfers, store.stock_transfers || [], "created_at", false);
            // Ensure all merged items have names resolved
            for (const t of merged) {
              if (t.origin_outlet_id && (!t.origin_outlet_name || t.origin_outlet_name === "Pusat" || t.origin_outlet_name === "Gudang Pusat")) {
                const name = outletNameMap.get(t.origin_outlet_id);
                if (name) t.origin_outlet_name = name;
              }
              if (t.destination_outlet_id && (!t.destination_outlet_name || t.destination_outlet_name === "Cabang")) {
                const name = outletNameMap.get(t.destination_outlet_id);
                if (name) t.destination_outlet_name = name;
              }
            }
            return Response.json({ success: true, data: merged });
          }

          // 4. STOCK OPNAMES
          if (type === "stock-opnames") {
            let dbOpnames: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("stock_opnames" as any)
                .select(`*, items:stock_opname_items(*)`)
                .in("business_id", allIds)
                .order("created_at", { ascending: false });
              if (data) dbOpnames = data;
            } catch {}

            const merged = mergeAndDeduplicate(dbOpnames, store.stock_opnames || [], "created_at", false);
            return Response.json({ success: true, data: merged });
          }

          // 5. WASTE RECORDS
          if (type === "waste-records") {
            let dbWaste: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("waste_records" as any)
                .select("*")
                .in("business_id", allIds)
                .order("created_at", { ascending: false });
              if (data) dbWaste = data;
            } catch {}

            const merged = mergeAndDeduplicate(dbWaste, store.waste_records || [], "created_at", false);
            return Response.json({ success: true, data: merged });
          }

          // 6. STOCK MOVEMENTS
          if (type === "stock-movements") {
            let dbMovements: any[] = [];
            try {
              const { data } = await supabaseAdmin
                .from("stock_movements" as any)
                .select("*")
                .in("business_id", allIds)
                .order("created_at", { ascending: false })
                .limit(100);
              if (data) dbMovements = data;
            } catch {}

            const merged = mergeAndDeduplicate(dbMovements, store.stock_movements || [], "created_at", false).slice(0, 100);
            return Response.json({ success: true, data: merged });
          }

          // Default: Return full store
          return Response.json({ success: true, data: store });
        } catch (err: any) {
          console.error("[api/inventory] GET handler error:", err);
          return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          if ("error" in auth) {
            return Response.json({ error: auth.error }, { status: auth.status });
          }

          const body = await request.json();
          const action = body.action;
          const { primaryId, allIds } = await resolveUserBusinessIds(auth.user.id, body.business_id);

          if (!primaryId && allIds.length === 0) {
            return Response.json({ error: "business_id tidak valid" }, { status: 400 });
          }

          const businessId = primaryId;
          const store = await loadProcurementStore(allIds);
          if (!store.suppliers) store.suppliers = [];
          if (!store.purchase_orders) store.purchase_orders = [];
          if (!store.stock_transfers) store.stock_transfers = [];
          if (!store.stock_opnames) store.stock_opnames = [];
          if (!store.waste_records) store.waste_records = [];
          if (!store.stock_movements) store.stock_movements = [];

          // 0a. CREATE ITEM (Single Source of Truth)
          if (action === "create-item") {
            const itemData = body.data || body;
            const insertPayload: Record<string, any> = {
              business_id: primaryId,
              name: (itemData.name || "").trim(),
              category: (itemData.category || "Bahan Baku").trim(),
              unit: (itemData.unit || "pcs").trim(),
              stock: Number(itemData.stock) || 0,
              minimum_stock: Number(itemData.minimum_stock) || 0,
              health_score: 100,
            };
            if (itemData.cost_price !== undefined) insertPayload.cost_price = Number(itemData.cost_price) || 0;
            if (itemData.supplier_id) insertPayload.supplier_id = itemData.supplier_id;
            if (itemData.outlet_id) insertPayload.outlet_id = itemData.outlet_id;
            if (itemData.yield_per_unit !== undefined && itemData.yield_per_unit !== null) {
              insertPayload.yield_per_unit = Number(itemData.yield_per_unit) || null;
            }
            if (itemData.yield_unit !== undefined && itemData.yield_unit !== null) {
              insertPayload.yield_unit = String(itemData.yield_unit).trim() || null;
            }

            let inserted: any = null;
            const { data: res1, error: err1 } = await supabaseAdmin
              .from("inventory_items")
              .insert(insertPayload as any)
              .select()
              .single();

            if (res1) {
              inserted = res1;
            } else {
              // Keep cost_price intact (real DB column) while stripping optional extension columns
              delete insertPayload.supplier_id;
              delete insertPayload.outlet_id;
              delete insertPayload.yield_per_unit;
              delete insertPayload.yield_unit;
              const { data: res2, error: err2 } = await supabaseAdmin
                .from("inventory_items")
                .insert(insertPayload as any)
                .select()
                .single();

              if (err2 || !res2) {
                delete insertPayload.cost_price;
                const { data: res3, error: err3 } = await supabaseAdmin
                  .from("inventory_items")
                  .insert(insertPayload as any)
                  .select()
                  .single();
                if (err3 || !res3) {
                  return Response.json(
                    { error: err3?.message || err2?.message || err1?.message || "Gagal membuat bahan baku" },
                    { status: 500 },
                  );
                }
                inserted = res3;
              } else {
                inserted = res2;
              }
            }

            const yieldPerUnitVal =
              itemData.yield_per_unit !== undefined && itemData.yield_per_unit !== null
                ? Number(itemData.yield_per_unit) || null
                : null;
            const yieldUnitVal = itemData.yield_unit ? String(itemData.yield_unit).trim() : null;

            let resolvedOutletName = itemData.outlet_name || null;
            if (!resolvedOutletName && itemData.outlet_id) {
              try {
                const { data: oRow } = await supabaseAdmin
                  .from("outlets")
                  .select("name")
                  .eq("id", itemData.outlet_id)
                  .maybeSingle();
                if (oRow?.name) resolvedOutletName = oRow.name;
              } catch {}
            }

            store.item_meta = store.item_meta || {};
            store.item_meta[inserted.id] = {
              cost_price: Number(itemData.cost_price) || 0,
              supplier_id: itemData.supplier_id || null,
              outlet_id: itemData.outlet_id || null,
              outlet_name: resolvedOutletName,
              yield_per_unit: yieldPerUnitVal,
              yield_unit: yieldUnitVal,
            };
            await saveProcurementStore(allIds, store);

            inserted.yield_per_unit = yieldPerUnitVal ?? inserted.yield_per_unit ?? null;
            inserted.yield_unit = yieldUnitVal ?? inserted.yield_unit ?? null;

            return Response.json({ success: true, data: inserted });
          }

          // 0b. UPDATE ITEM
          if (action === "update-item") {
            const itemData = body.data || body;
            const updatePayload: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };
            if (itemData.name !== undefined) updatePayload.name = itemData.name.trim();
            if (itemData.category !== undefined) updatePayload.category = itemData.category.trim();
            if (itemData.unit !== undefined) updatePayload.unit = itemData.unit.trim();
            if (itemData.stock !== undefined) updatePayload.stock = Number(itemData.stock);
            if (itemData.minimum_stock !== undefined) updatePayload.minimum_stock = Number(itemData.minimum_stock);
            if (itemData.cost_price !== undefined) updatePayload.cost_price = Number(itemData.cost_price);
            if (itemData.supplier_id !== undefined) updatePayload.supplier_id = itemData.supplier_id;
            if (itemData.outlet_id !== undefined) updatePayload.outlet_id = itemData.outlet_id;
            if (itemData.yield_per_unit !== undefined) {
              updatePayload.yield_per_unit = itemData.yield_per_unit !== null ? Number(itemData.yield_per_unit) : null;
            }
            if (itemData.yield_unit !== undefined) {
              updatePayload.yield_unit = itemData.yield_unit ? String(itemData.yield_unit).trim() : null;
            }

            const { error: updErr } = await supabaseAdmin
              .from("inventory_items")
              .update(updatePayload as any)
              .eq("id", body.id);

            if (updErr) {
              // Keep cost_price intact on retry so DB cost_price stays synced with real unit cost
              delete updatePayload.supplier_id;
              delete updatePayload.outlet_id;
              delete updatePayload.yield_per_unit;
              delete updatePayload.yield_unit;
              const { error: updErr2 } = await supabaseAdmin
                .from("inventory_items")
                .update(updatePayload as any)
                .eq("id", body.id);
              if (updErr2) {
                delete updatePayload.cost_price;
                await supabaseAdmin
                  .from("inventory_items")
                  .update(updatePayload as any)
                  .eq("id", body.id);
              }
            }

            let resolvedUpdateOutletName = itemData.outlet_name;
            if (resolvedUpdateOutletName === undefined && itemData.outlet_id !== undefined) {
              if (itemData.outlet_id) {
                try {
                  const { data: oRow } = await supabaseAdmin
                    .from("outlets")
                    .select("name")
                    .eq("id", itemData.outlet_id)
                    .maybeSingle();
                  resolvedUpdateOutletName = oRow?.name || null;
                } catch {}
              } else {
                resolvedUpdateOutletName = null;
              }
            }

            store.item_meta = store.item_meta || {};
            store.item_meta[body.id] = {
              ...(store.item_meta[body.id] || {}),
              ...(itemData.cost_price !== undefined ? { cost_price: Number(itemData.cost_price) } : {}),
              ...(itemData.supplier_id !== undefined ? { supplier_id: itemData.supplier_id } : {}),
              ...(itemData.outlet_id !== undefined ? { outlet_id: itemData.outlet_id } : {}),
              ...(resolvedUpdateOutletName !== undefined ? { outlet_name: resolvedUpdateOutletName } : {}),
              ...(itemData.yield_per_unit !== undefined
                ? { yield_per_unit: itemData.yield_per_unit !== null ? Number(itemData.yield_per_unit) : null }
                : {}),
              ...(itemData.yield_unit !== undefined
                ? { yield_unit: itemData.yield_unit ? String(itemData.yield_unit).trim() : null }
                : {}),
            };
            await saveProcurementStore(allIds, store);

            return Response.json({ success: true });
          }

          // 0c. DELETE ITEM (CASCADE SAFETY)
          if (action === "delete-item") {
            try {
              await supabaseAdmin.from("recipe_items" as any).delete().eq("inventory_item_id", body.id);
            } catch {}
            try {
              await supabaseAdmin.from("recipe_items" as any).delete().eq("ingredient_id", body.id);
            } catch {}
            try {
              await supabaseAdmin.from("recipes" as any).delete().eq("ingredient_id", body.id);
            } catch {}
            try {
              await supabaseAdmin.from("stock_movements" as any).delete().eq("inventory_item_id", body.id);
            } catch {}
            try {
              await supabaseAdmin.from("stock_transfer_items" as any).delete().eq("inventory_item_id", body.id);
            } catch {}
            try {
              await supabaseAdmin.from("waste_records" as any).delete().eq("inventory_item_id", body.id);
            } catch {}

            await supabaseAdmin.from("inventory_items").delete().eq("id", body.id);
            try {
              await supabaseAdmin.from("ingredients" as any).delete().eq("id", body.id);
            } catch {}

            if (store.item_meta && store.item_meta[body.id]) {
              delete store.item_meta[body.id];
              await saveProcurementStore(allIds, store);
            }

            return Response.json({ success: true });
          }

          // 1. CREATE SUPPLIER
          if (action === "create-supplier") {
            const newSupp = {
              id: `sup-${Date.now()}`,
              business_id: businessId,
              name: body.name?.trim(),
              phone: body.phone?.trim() || null,
              email: body.email?.trim() || null,
              address: body.address?.trim() || null,
              product_category: body.product_category?.trim() || "Bahan Baku",
              notes: body.notes?.trim() || null,
              purchase_count: 0,
              total_purchased: 0,
              created_at: new Date().toISOString(),
            };

            try {
              const { data: dbData } = await supabaseAdmin
                .from("suppliers" as any)
                .insert({
                  business_id: businessId,
                  name: newSupp.name,
                  phone: newSupp.phone,
                  email: newSupp.email,
                  address: newSupp.address,
                  product_category: newSupp.product_category,
                  notes: newSupp.notes,
                })
                .select()
                .single();
              if (dbData) newSupp.id = (dbData as any).id;
            } catch {}

            store.suppliers = [newSupp, ...store.suppliers.filter((s: any) => s.id !== newSupp.id)];
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: newSupp });
          }

          // 2. UPDATE SUPPLIER
          if (action === "update-supplier") {
            const idx = store.suppliers.findIndex((s: any) => s.id === body.id);
            if (idx >= 0) {
              store.suppliers[idx] = { ...store.suppliers[idx], ...body.data };
            }
            try {
              await supabaseAdmin
                .from("suppliers" as any)
                .update(body.data)
                .eq("id", body.id);
            } catch {}

            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: store.suppliers[idx] || body.data });
          }

          // 3. DELETE SUPPLIER (CASCADE SAFETY)
          if (action === "delete-supplier") {
            try {
              await supabaseAdmin
                .from("inventory_items")
                .update({ supplier_id: null } as any)
                .eq("supplier_id", body.id);
            } catch {}
            try {
              await supabaseAdmin
                .from("ingredients" as any)
                .update({ supplier_id: null } as any)
                .eq("supplier_id", body.id);
            } catch {}

            store.suppliers = store.suppliers.filter((s: any) => s.id !== body.id);
            try {
              await supabaseAdmin
                .from("suppliers" as any)
                .delete()
                .eq("id", body.id);
            } catch {}

            await saveProcurementStore(allIds, store);
            return Response.json({ success: true });
          }

          // 4. CREATE PURCHASE ORDER
          if (action === "create-po") {
            const poData = body.data;
            const newPO = {
              id: `po-${Date.now()}`,
              business_id: businessId,
              outlet_id: poData.outlet_id || null,
              outlet_name: poData.outlet_name || "Outlet Utama",
              supplier_id: poData.supplier_id || null,
              supplier_name: poData.supplier_name || "Supplier",
              po_number: poData.po_number || `PO-${Date.now().toString().slice(-6)}`,
              order_date: poData.order_date || new Date().toISOString().split("T")[0],
              expected_delivery_date: poData.expected_delivery_date || null,
              status: poData.status || "draft",
              total_amount:
                poData.items?.reduce(
                  (sum: number, it: any) => sum + (it.subtotal || it.quantity * it.unit_cost),
                  0,
                ) || 0,
              notes: poData.notes || null,
              items: poData.items || [],
              created_at: new Date().toISOString(),
            };

            try {
              const { data: dbData } = await supabaseAdmin
                .from("purchase_orders" as any)
                .insert({
                  business_id: businessId,
                  outlet_id: newPO.outlet_id,
                  supplier_id: newPO.supplier_id,
                  po_number: newPO.po_number,
                  order_date: newPO.order_date,
                  expected_delivery_date: newPO.expected_delivery_date,
                  status: newPO.status,
                  total_amount: newPO.total_amount,
                  notes: newPO.notes,
                })
                .select()
                .single();

              if (dbData) {
                newPO.id = (dbData as any).id;
                const itemsPayload = newPO.items.map((it: any) => ({
                  purchase_order_id: (dbData as any).id,
                  inventory_item_id: it.inventory_item_id || null,
                  item_name: it.item_name,
                  quantity: it.quantity,
                  unit: it.unit,
                  unit_cost: it.unit_cost,
                  subtotal: it.subtotal || it.quantity * it.unit_cost,
                }));
                await supabaseAdmin.from("purchase_order_items" as any).insert(itemsPayload);
              }
            } catch {}

            store.purchase_orders = [
              newPO,
              ...store.purchase_orders.filter((p: any) => p.id !== newPO.id),
            ];
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: newPO });
          }

          // 5. UPDATE PO STATUS (WITH IDEMPOTENT AUTO STOCK RECEIVE — NEVER DOUBLE STOCK-IN)
          if (action === "update-po-status") {
            const { po_id, status } = body;
            let dbPO: any = null;
            try {
              const { data } = await supabaseAdmin
                .from("purchase_orders" as any)
                .select(`*, items:purchase_order_items(*)`)
                .eq("id", po_id)
                .in("business_id", allIds)
                .maybeSingle();
              dbPO = data;
            } catch {}

            const storePO = (store.purchase_orders || []).find(
              (p: any) => p.id === po_id || (dbPO?.po_number && p.po_number === dbPO.po_number),
            );
            const targetPO = storePO || dbPO;
            if (targetPO && (!targetPO.items || targetPO.items.length === 0)) {
              const fallbackItemsSource =
                (storePO?.items?.length ? storePO : null) ||
                (dbPO?.items?.length ? dbPO : null);
              if (fallbackItemsSource) targetPO.items = fallbackItemsSource.items;
            }

            const prevPoStatus = dbPO?.status || storePO?.status || targetPO?.status;
            const poNumber = targetPO?.po_number || po_id;

            let alreadyReceived =
              prevPoStatus === "received" ||
              Boolean(storePO?.stock_received) ||
              Boolean(dbPO?.stock_received) ||
              Boolean(targetPO?.stock_received) ||
              Boolean(storePO?.received_at) ||
              Boolean(dbPO?.received_at);

            if (status === "received" && !alreadyReceived && poNumber) {
              const inStoreMov = (store.stock_movements || []).some(
                (m: any) =>
                  m.movement_type === "stock_in" &&
                  String(m.notes || "").includes(`Purchase Order ${poNumber}`),
              );
              if (inStoreMov) {
                alreadyReceived = true;
              } else {
                try {
                  const { data: existingPoMovs } = await (supabaseAdmin
                    .from("stock_movements" as any)
                    .select("id")
                    .in("business_id", allIds)
                    .eq("movement_type", "stock_in") as any)
                    .ilike("notes", `%Purchase Order ${poNumber}%`)
                    .limit(1);
                  if (Array.isArray(existingPoMovs) && existingPoMovs.length > 0) {
                    alreadyReceived = true;
                  }
                } catch {}
              }
            }

            if (status === "received" && alreadyReceived) {
              // PO was already received — reject duplicate stock-in so double-clicks never inflate inventory
              return Response.json({
                success: true,
                already_received: true,
                message: `Purchase Order ${poNumber} sudah berstatus received — penambahan stok ganda ditolak.`,
                data: targetPO,
              });
            }

            // Atomic DB claim before incrementing stock
            let claimedPoInDb = true;
            if (status === "received" && dbPO?.id) {
              try {
                const claimRes = await (supabaseAdmin
                  .from("purchase_orders" as any)
                  .update({ status: "received", updated_at: new Date().toISOString() })
                  .eq("id", dbPO.id)
                  .in("business_id", allIds) as any)
                  .neq("status", "received")
                  .select("id")
                  .maybeSingle();
                if (!claimRes.error && !claimRes.data) {
                  claimedPoInDb = false;
                }
              } catch {}
            }

            if (status === "received" && !claimedPoInDb) {
              return Response.json({
                success: true,
                already_received: true,
                message: `Purchase Order ${poNumber} sudah diterima sebelumnya.`,
                data: targetPO,
              });
            }

            if (targetPO) {
              targetPO.status = status;
              if (status === "received") {
                targetPO.received_at = new Date().toISOString();
                targetPO.stock_received = true;

                // Auto-increment inventory_items strictly once
                for (const it of targetPO.items || []) {
                  if (it.inventory_item_id) {
                    const { data: invRow } = await supabaseAdmin
                      .from("inventory_items")
                      .select("*")
                      .eq("id", it.inventory_item_id)
                      .in("business_id", allIds)
                      .maybeSingle();

                    if (invRow) {
                      const newStock = Number(invRow.stock) + Number(it.quantity);
                      await supabaseAdmin
                        .from("inventory_items")
                        .update({ stock: newStock, updated_at: new Date().toISOString() })
                        .eq("id", it.inventory_item_id)
                        .in("business_id", allIds);

                      // Log stock movement
                      const movRecord = {
                        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        business_id: businessId,
                        outlet_id: targetPO.outlet_id || (invRow as any).outlet_id || null,
                        inventory_item_id: it.inventory_item_id,
                        item_name: it.item_name,
                        movement_type: "stock_in",
                        quantity: Number(it.quantity),
                        unit: it.unit || invRow.unit,
                        remaining_stock: newStock,
                        notes: `Penerimaan Purchase Order ${targetPO.po_number}`,
                        created_at: new Date().toISOString(),
                      };
                      store.stock_movements = [movRecord, ...store.stock_movements];
                      await insertStockMovementDb(supabaseAdmin, movRecord);
                    }
                  }
                }
              }
            }

            try {
              await supabaseAdmin
                .from("purchase_orders" as any)
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", po_id)
                .in("business_id", allIds);
            } catch {}

            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: targetPO });
          }

          // 6. CREATE STOCK TRANSFER
          if (action === "create-transfer") {
            const tData = body.data;
            const newTransfer = {
              id: `trf-${Date.now()}`,
              business_id: businessId,
              transfer_number: `TRF-${Date.now().toString().slice(-6)}`,
              origin_outlet_id: tData.origin_outlet_id || null,
              origin_outlet_name: tData.origin_outlet_name || "Gudang Pusat",
              destination_outlet_id: tData.destination_outlet_id || null,
              destination_outlet_name: tData.destination_outlet_name || "Cabang",
              status: tData.status || "requested",
              notes: tData.notes || null,
              items: tData.items || [],
              created_at: new Date().toISOString(),
            };

            try {
              const { data: dbData } = await supabaseAdmin
                .from("stock_transfers" as any)
                .insert({
                  business_id: businessId,
                  transfer_number: newTransfer.transfer_number,
                  origin_outlet_id: newTransfer.origin_outlet_id,
                  destination_outlet_id: newTransfer.destination_outlet_id,
                  status: newTransfer.status,
                  notes: newTransfer.notes,
                })
                .select()
                .single();
              if (dbData) {
                newTransfer.id = (dbData as any).id;
                // Also insert line items into relational stock_transfer_items table
                if (Array.isArray(newTransfer.items) && newTransfer.items.length > 0) {
                  try {
                    await supabaseAdmin.from("stock_transfer_items" as any).insert(
                      newTransfer.items.map((it: any) => ({
                        transfer_id: (dbData as any).id,
                        inventory_item_id: it.inventory_item_id,
                        item_name: it.item_name,
                        quantity: Number(it.quantity) || 0,
                        unit: it.unit,
                      })),
                    );
                  } catch {}
                }
              }
            } catch {}

            store.stock_transfers = [
              newTransfer,
              ...store.stock_transfers.filter((t: any) => t.id !== newTransfer.id),
            ];
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: newTransfer });
          }

          // 7. UPDATE TRANSFER STATUS (WITH IDEMPOTENT REAL STOCK MUTATION ON RECEIVE)
          if (action === "update-transfer-status") {
            const { transfer_id, status } = body;
            let dbTrf: any = null;
            try {
              const { data } = await supabaseAdmin
                .from("stock_transfers" as any)
                .select(`*, items:stock_transfer_items(*)`)
                .eq("id", transfer_id)
                .maybeSingle();
              dbTrf = data;
            } catch {}

            const storeTrf = (store.stock_transfers || []).find(
              (t: any) =>
                t.id === transfer_id ||
                (dbTrf?.transfer_number && t.transfer_number === dbTrf.transfer_number),
            );
            let targetTransfer = storeTrf || dbTrf;
            if (targetTransfer && (!targetTransfer.items || targetTransfer.items.length === 0)) {
              const fallbackSource =
                (storeTrf?.items?.length ? storeTrf : null) ||
                (dbTrf?.items?.length ? dbTrf : null);
              if (fallbackSource) targetTransfer.items = fallbackSource.items;
            }

            const prevStatus = dbTrf?.status || storeTrf?.status || targetTransfer?.status;
            const transferNum = targetTransfer?.transfer_number || transfer_id;
            let alreadyDeducted =
              prevStatus === "received" ||
              prevStatus === "completed" ||
              Boolean(storeTrf?.stock_deducted) ||
              Boolean(dbTrf?.stock_deducted) ||
              Boolean(targetTransfer?.stock_deducted);

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
                  const { data: existingMovs } = await (supabaseAdmin
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

            // Atomic DB claim before mutating stock so concurrent or fallback retries cannot deduct twice
            let claimedInDb = true;
            if (status === "received" && !alreadyDeducted && dbTrf?.id) {
              try {
                const claimRes = await (supabaseAdmin
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

            if (targetTransfer) {
              targetTransfer.status = status;
              if (status === "sent") targetTransfer.sent_at = new Date().toISOString();
              if (status === "received") {
                targetTransfer.received_at = new Date().toISOString();
                targetTransfer.stock_deducted = true;
              }
            }

            // Real stock mutation ONLY when claiming transition to "received" for the first time
            if (status === "received" && !alreadyDeducted && claimedInDb && targetTransfer) {
              const originOutletId = targetTransfer.origin_outlet_id || null;
              const destOutletId = targetTransfer.destination_outlet_id || null;
              const originName = targetTransfer.origin_outlet_name || "Gudang Asal";
              const destName = targetTransfer.destination_outlet_name || "Cabang Tujuan";

              for (const it of targetTransfer.items || []) {
                const qty = Number(it.quantity) || 0;
                if (qty <= 0) continue;

                // 1. Find & deduct stock from origin item
                let originItem: any = null;
                if (it.inventory_item_id) {
                  const { data: exactOrigin } = await supabaseAdmin
                    .from("inventory_items")
                    .select("*")
                    .eq("id", it.inventory_item_id)
                    .maybeSingle();
                  originItem = exactOrigin;
                }
                if (!originItem && (it.item_name || it.name)) {
                  const rawName = String(it.item_name || it.name).trim();
                  const { data: candidates } = await (supabaseAdmin
                    .from("inventory_items" as any)
                    .select("*")
                    .eq("business_id", businessId) as any)
                    .ilike("name", rawName);
                  if (Array.isArray(candidates) && candidates.length > 0) {
                    originItem =
                      (originOutletId && candidates.find((c: any) => c.outlet_id === originOutletId)) ||
                      candidates[0];
                  }
                }

                if (originItem) {
                  const originId = originItem.id;
                  const availableOriginStock = Math.max(0, Number(originItem.stock) || 0);
                  // NEVER transfer more than the actual stock available in the origin branch
                  // (prevents creating phantom/fictitious stock in the destination branch)
                  const actualTransferQty = Math.min(qty, availableOriginStock);
                  if (actualTransferQty <= 0) {
                    continue;
                  }
                  it.transferred_quantity = actualTransferQty;
                  const newOriginStock = Math.max(0, availableOriginStock - actualTransferQty);
                  await supabaseAdmin
                    .from("inventory_items")
                    .update({ stock: newOriginStock, updated_at: new Date().toISOString() })
                    .eq("id", originId)
                    .in("business_id", allIds);

                  // Log stock movement transfer_out (store keeps string ID; DB auto-generates UUID)
                  const movOut = {
                    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    business_id: businessId,
                    inventory_item_id: originId,
                    item_name: it.item_name || originItem.name,
                    outlet_id: originOutletId,
                    movement_type: "transfer_out",
                    quantity: actualTransferQty,
                    unit: it.unit || originItem.unit || "pcs",
                    remaining_stock: newOriginStock,
                    notes: `Transfer Keluar ke ${destName} (${targetTransfer.transfer_number || transfer_id})`,
                    created_at: new Date().toISOString(),
                  };
                  store.stock_movements = [movOut, ...(store.stock_movements || [])];
                  await insertStockMovementDb(supabaseAdmin, movOut);

                  // Resolve master BOM & pricing attributes from origin row + item_meta
                  if (!store.item_meta) store.item_meta = {};
                  const originMeta = store.item_meta[originId] || {};
                  const resolvedName = String(it.item_name || originItem.name || "").trim();
                  const nameLower = resolvedName.toLowerCase();
                  const resolvedCostPrice =
                    Number(originItem.cost_price) > 0
                      ? Number(originItem.cost_price)
                      : Number(originMeta.cost_price) ||
                        (nameLower.includes("daging")
                          ? 120000
                          : nameLower.includes("tortilla")
                            ? 25000
                            : 0);
                  const resolvedYieldPerUnit =
                    originItem.yield_per_unit ??
                    originMeta.yield_per_unit ??
                    (nameLower.includes("daging") ? 2000 : nameLower.includes("tortilla") ? 20 : null);
                  const resolvedYieldUnit =
                    originItem.yield_unit ??
                    originMeta.yield_unit ??
                    (nameLower.includes("daging")
                      ? "gram"
                      : nameLower.includes("tortilla")
                        ? "pcs"
                        : null);
                  const resolvedSupplierId =
                    originItem.supplier_id ?? originMeta.supplier_id ?? null;
                  const resolvedMinStock = Number(
                    originItem.minimum_stock ?? originMeta.minimum_stock ?? 10,
                  );
                  const resolvedCategory =
                    originItem.category || originMeta.category || "Bahan Baku";
                  const resolvedUnit = it.unit || originItem.unit || "pcs";

                  // 2. Add or insert stock in destination outlet (strictly capped to actualTransferQty)
                  let destItem: any = null;
                  if (destOutletId) {
                    const { data: existingDest } = await (supabaseAdmin
                      .from("inventory_items" as any)
                      .select("*")
                      .eq("business_id", businessId) as any)
                      .eq("outlet_id", destOutletId)
                      .ilike("name", resolvedName)
                      .maybeSingle();
                    destItem = existingDest;
                  }

                  if (destItem) {
                    const newDestStock = (Number(destItem.stock) || 0) + actualTransferQty;
                    await supabaseAdmin
                      .from("inventory_items")
                      .update({ stock: newDestStock, updated_at: new Date().toISOString() })
                      .eq("id", destItem.id)
                      .in("business_id", allIds);

                    const existingDestMeta = store.item_meta[destItem.id] || {};
                    store.item_meta[destItem.id] = {
                      ...existingDestMeta,
                      cost_price: Number(existingDestMeta.cost_price) || resolvedCostPrice,
                      yield_per_unit: existingDestMeta.yield_per_unit ?? resolvedYieldPerUnit,
                      yield_unit: existingDestMeta.yield_unit ?? resolvedYieldUnit,
                      supplier_id: existingDestMeta.supplier_id ?? resolvedSupplierId,
                      minimum_stock: existingDestMeta.minimum_stock ?? resolvedMinStock,
                      outlet_id: destOutletId,
                      outlet_name: destName || existingDestMeta.outlet_name || null,
                    };

                    const movIn = {
                      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                      business_id: businessId,
                      inventory_item_id: destItem.id,
                      item_name: destItem.name,
                      outlet_id: destOutletId,
                      movement_type: "transfer_in",
                      quantity: actualTransferQty,
                      unit: destItem.unit || resolvedUnit,
                      remaining_stock: newDestStock,
                      notes: `Transfer Masuk dari ${originName} (${targetTransfer.transfer_number || transfer_id})`,
                      created_at: new Date().toISOString(),
                    };
                    store.stock_movements = [movIn, ...(store.stock_movements || [])];
                    await insertStockMovementDb(supabaseAdmin, movIn);
                  } else if (destOutletId) {
                    // Auto-create destination inventory item copying cost_price, unit, yield & supplier
                    try {
                      let createdDest: any = null;
                      const fullDestPayload: any = {
                        business_id: businessId,
                        outlet_id: destOutletId,
                        name: resolvedName,
                        category: resolvedCategory,
                        unit: resolvedUnit,
                        stock: actualTransferQty,
                        minimum_stock: resolvedMinStock,
                        cost_price: resolvedCostPrice,
                        yield_per_unit: resolvedYieldPerUnit,
                        yield_unit: resolvedYieldUnit,
                        supplier_id: resolvedSupplierId,
                        health_score: 100,
                      };

                      const fullRes = await (supabaseAdmin
                        .from("inventory_items" as any)
                        .insert(fullDestPayload) as any)
                        .select()
                        .single();

                      if (!fullRes.error && fullRes.data) {
                        createdDest = fullRes.data;
                      } else {
                        const baseRes = await (supabaseAdmin
                          .from("inventory_items" as any)
                          .insert({
                            business_id: businessId,
                            outlet_id: destOutletId,
                            name: resolvedName,
                            category: resolvedCategory,
                            unit: resolvedUnit,
                            stock: actualTransferQty,
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
                          cost_price: resolvedCostPrice,
                          yield_per_unit: resolvedYieldPerUnit,
                          yield_unit: resolvedYieldUnit,
                          supplier_id: resolvedSupplierId,
                          minimum_stock: resolvedMinStock,
                          outlet_id: destOutletId,
                          outlet_name: destName || null,
                          ...(originMeta.pack_configs ? { pack_configs: originMeta.pack_configs } : {}),
                        };

                        const movIn = {
                          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                          business_id: businessId,
                          inventory_item_id: createdDest.id,
                          item_name: createdDest.name,
                          outlet_id: destOutletId,
                          movement_type: "transfer_in",
                          quantity: actualTransferQty,
                          unit: createdDest.unit || resolvedUnit,
                          remaining_stock: actualTransferQty,
                          notes: `Transfer Masuk dari ${originName} (${targetTransfer.transfer_number || transfer_id})`,
                          created_at: new Date().toISOString(),
                        };
                        store.stock_movements = [movIn, ...(store.stock_movements || [])];
                        await insertStockMovementDb(supabaseAdmin, movIn);
                      }
                    } catch {
                      // Table may not have outlet_id column or already exists
                    }
                  }
                }
              }
            }

            try {
              await supabaseAdmin
                .from("stock_transfers" as any)
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", transfer_id);
            } catch {}

            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: targetTransfer });
          }

          // 8. RECORD WASTE
          if (action === "record-waste") {
            const { inventory_item_id, quantity, reason, cost_loss, notes, outlet_id, outlet_name } = body.data;
            const { data: invItem } = await supabaseAdmin
              .from("inventory_items")
              .select("*")
              .eq("id", inventory_item_id)
              .single();

            const itemName = invItem?.name || "Bahan Baku";
            const unit = invItem?.unit || "pcs";
            const resolvedOutletId =
              outlet_id ||
              (invItem as any)?.outlet_id ||
              store.item_meta?.[inventory_item_id]?.outlet_id ||
              null;
            let resolvedOutletName =
              outlet_name || store.item_meta?.[inventory_item_id]?.outlet_name || null;
            if (!resolvedOutletName && resolvedOutletId) {
              try {
                const { data: oRow } = await supabaseAdmin
                  .from("outlets")
                  .select("name")
                  .eq("id", resolvedOutletId)
                  .maybeSingle();
                if (oRow?.name) resolvedOutletName = oRow.name;
              } catch {}
            }
            const metaCost = Number(store.item_meta?.[inventory_item_id]?.cost_price) || 0;
            const dbCost = Number(invItem?.cost_price) || 0;
            let resolvedUnitCost =
              metaCost > 0 && (dbCost <= 0 || (dbCost === 1000 && metaCost !== 1000))
                ? metaCost
                : dbCost > 0
                  ? dbCost
                  : metaCost;
            const lowerWasteName = itemName.toLowerCase();
            if (lowerWasteName.includes("daging") && (resolvedUnitCost <= 0 || resolvedUnitCost === 1000)) {
              resolvedUnitCost = 120000;
            } else if (lowerWasteName.includes("tortilla") && (resolvedUnitCost <= 0 || resolvedUnitCost === 1000)) {
              resolvedUnitCost = 25000;
            }
            const computedLoss = Math.round(Number(quantity) * resolvedUnitCost);
            const finalCost =
              Number(cost_loss) > 0 && !(Number(cost_loss) === Math.round(Number(quantity) * 1000) && resolvedUnitCost > 1000)
                ? Number(cost_loss)
                : computedLoss;

            const newWaste = {
              id: `waste-${Date.now()}`,
              business_id: businessId,
              outlet_id: resolvedOutletId,
              outlet_name: resolvedOutletName,
              inventory_item_id,
              item_name: itemName,
              quantity: Number(quantity),
              unit,
              cost_loss: finalCost,
              reason: reason || "Expired",
              notes: notes || null,
              created_by: "Supervisor",
              created_at: new Date().toISOString(),
            };

            // Deduct stock in inventory_items
            if (invItem) {
              const newStock = Math.max(0, Number(invItem.stock) - Number(quantity));
              await supabaseAdmin
                .from("inventory_items")
                .update({ stock: newStock, updated_at: new Date().toISOString() })
                .eq("id", inventory_item_id);

              // Log stock movement
              const movRecord = {
                id: `mov-${Date.now()}-${Math.random()}`,
                business_id: businessId,
                outlet_id: resolvedOutletId,
                inventory_item_id,
                item_name: itemName,
                movement_type: "waste",
                quantity: Number(quantity),
                unit,
                remaining_stock: newStock,
                notes: `Waste: ${reason} - ${notes || ""}`,
                created_at: new Date().toISOString(),
              };
              store.stock_movements = [movRecord, ...store.stock_movements];
              try {
                await supabaseAdmin.from("stock_movements" as any).insert({
                  business_id: businessId,
                  outlet_id: resolvedOutletId,
                  inventory_item_id,
                  movement_type: "waste",
                  type: "waste",
                  quantity: Number(quantity),
                  unit,
                  remaining_stock: newStock,
                  notes: `Waste: ${reason} - ${notes || ""}`,
                  created_at: movRecord.created_at,
                });
              } catch {}
            }

            store.waste_records = [newWaste, ...store.waste_records];
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: newWaste });
          }

          // 9. CREATE STOCK OPNAME
          if (action === "create-opname") {
            const oData = body.data;
            const newOpname = {
              id: `opn-${Date.now()}`,
              business_id: businessId,
              outlet_id: oData.outlet_id || null,
              outlet_name: oData.outlet_name || "Outlet",
              opname_number: `OPN-${Date.now().toString().slice(-6)}`,
              date: oData.date || new Date().toISOString().split("T")[0],
              status: oData.status || "completed",
              notes: oData.notes || null,
              conducted_by: oData.conducted_by || "Auditor",
              items: oData.items || [],
              created_at: new Date().toISOString(),
            };

            // If approved, synchronize physical stock to inventory_items
            if (newOpname.status === "approved" || newOpname.status === "completed") {
              for (const it of newOpname.items) {
                if (it.inventory_item_id) {
                  await supabaseAdmin
                    .from("inventory_items")
                    .update({
                      stock: Number(it.physical_stock),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", it.inventory_item_id);

                  if (it.difference !== 0) {
                    const movRecord = {
                      id: `mov-${Date.now()}-${Math.random()}`,
                      business_id: businessId,
                      inventory_item_id: it.inventory_item_id,
                      item_name: it.item_name,
                      movement_type: "opname",
                      quantity: Math.abs(it.difference),
                      unit: it.unit,
                      remaining_stock: Number(it.physical_stock),
                      notes: `Stock Opname: Selisih ${it.difference > 0 ? "+" : ""}${it.difference} ${it.unit}`,
                      created_at: new Date().toISOString(),
                    };
                    store.stock_movements = [movRecord, ...store.stock_movements];
                    try {
                      await supabaseAdmin.from("stock_movements" as any).insert({
                        business_id: businessId,
                        inventory_item_id: it.inventory_item_id,
                        movement_type: "opname",
                        type: "opname",
                        quantity: Math.abs(it.difference),
                        unit: it.unit,
                        remaining_stock: Number(it.physical_stock),
                        notes: movRecord.notes,
                        created_at: movRecord.created_at,
                      });
                    } catch {}
                  }
                }
              }
            }

            store.stock_opnames = [
              newOpname,
              ...store.stock_opnames.filter((o: any) => o.id !== newOpname.id),
            ];
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, data: newOpname });
          }

          // 10. RECORD STOCK IN
          if (action === "record-stock-in") {
            const { inventory_item_id, quantity, unit_cost, reference_no, notes } = body.data;
            const { data: invItem } = await supabaseAdmin
              .from("inventory_items")
              .select("*")
              .eq("id", inventory_item_id)
              .single();

            if (!invItem) return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });

            const newStock = Number(invItem.stock) + Number(quantity);
            const updatedFields: Record<string, any> = {
              stock: newStock,
              updated_at: new Date().toISOString(),
            };
            if (unit_cost && Number(unit_cost) > 0) {
              updatedFields.cost_price = Number(unit_cost);
            }

            await (supabaseAdmin as any)
              .from("inventory_items")
              .update(updatedFields)
              .eq("id", inventory_item_id);

            const movRecord = {
              id: `mov-${Date.now()}-${Math.random()}`,
              business_id: businessId,
              inventory_item_id,
              item_name: invItem.name,
              movement_type: "stock_in",
              quantity: Number(quantity),
              unit: invItem.unit,
              remaining_stock: newStock,
              notes: reference_no
                ? `Ref: ${reference_no}. ${notes || ""}`
                : notes || "Stok masuk manual",
              created_at: new Date().toISOString(),
            };
            store.stock_movements = [movRecord, ...store.stock_movements];
            try {
              await supabaseAdmin.from("stock_movements" as any).insert({
                business_id: businessId,
                inventory_item_id,
                movement_type: "stock_in",
                type: "stock_in",
                quantity: Number(quantity),
                unit: invItem.unit,
                remaining_stock: newStock,
                notes: movRecord.notes,
                created_at: movRecord.created_at,
              });
            } catch {}
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, remaining_stock: newStock });
          }

          // 11. RECORD STOCK OUT
          if (action === "record-stock-out") {
            const { inventory_item_id, quantity, reason, notes } = body.data;
            const { data: invItem } = await supabaseAdmin
              .from("inventory_items")
              .select("id, name, stock, unit")
              .eq("id", inventory_item_id)
              .single();

            if (!invItem) return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });

            const newStock = Math.max(0, Number(invItem.stock) - Number(quantity));
            await supabaseAdmin
              .from("inventory_items")
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", inventory_item_id);

            const movRecord = {
              id: `mov-${Date.now()}-${Math.random()}`,
              business_id: businessId,
              inventory_item_id,
              item_name: invItem.name,
              movement_type: "stock_out",
              quantity: Number(quantity),
              unit: invItem.unit,
              remaining_stock: newStock,
              notes: `Alasan: ${reason || "Lainnya"}. ${notes || ""}`,
              created_at: new Date().toISOString(),
            };
            store.stock_movements = [movRecord, ...store.stock_movements];
            try {
              await supabaseAdmin.from("stock_movements" as any).insert({
                business_id: businessId,
                inventory_item_id,
                movement_type: "stock_out",
                type: "stock_out",
                quantity: Number(quantity),
                unit: invItem.unit,
                remaining_stock: newStock,
                notes: movRecord.notes,
                created_at: movRecord.created_at,
              });
            } catch {}
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, remaining_stock: newStock });
          }

          // 12. RECORD STOCK ADJUSTMENT
          if (action === "record-stock-adjustment") {
            const { inventory_item_id, actual_stock, reason, notes } = body.data;
            const { data: invItem } = await supabaseAdmin
              .from("inventory_items")
              .select("id, name, stock, unit")
              .eq("id", inventory_item_id)
              .single();

            if (!invItem) return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });

            const prevStock = Number(invItem.stock);
            const newStock = Number(actual_stock);
            const diff = newStock - prevStock;

            await supabaseAdmin
              .from("inventory_items")
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", inventory_item_id);

            const movRecord = {
              id: `mov-${Date.now()}-${Math.random()}`,
              business_id: businessId,
              inventory_item_id,
              item_name: invItem.name,
              movement_type: "adjustment",
              quantity: diff,
              unit: invItem.unit,
              remaining_stock: newStock,
              notes: `Adjustment: ${reason || ""}. ${notes || ""}`,
              created_at: new Date().toISOString(),
            };
            store.stock_movements = [movRecord, ...store.stock_movements];
            try {
              await supabaseAdmin.from("stock_movements" as any).insert({
                business_id: businessId,
                inventory_item_id,
                movement_type: "adjustment",
                type: "adjustment",
                quantity: diff,
                unit: invItem.unit,
                remaining_stock: newStock,
                notes: movRecord.notes,
                created_at: movRecord.created_at,
              });
            } catch {}
            await saveProcurementStore(allIds, store);
            return Response.json({ success: true, remaining_stock: newStock, difference: diff });
          }

          return Response.json({ error: "Action tidak dikenal" }, { status: 400 });
        } catch (err: any) {
          console.error("[api/inventory] POST handler error:", err);
          return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
