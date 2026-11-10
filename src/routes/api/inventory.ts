import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

  let primaryId =
    requestedBusinessId && combined.includes(requestedBusinessId)
      ? requestedBusinessId
      : combined[0];
  if (!primaryId && requestedBusinessId) primaryId = requestedBusinessId;

  return {
    primaryId: primaryId || "",
    allIds: combined.length > 0 ? combined : primaryId ? [primaryId] : [],
  };
}

// Helper: load stored procurement data from outlets.settings
async function loadProcurementStore(businessIds: string[] | string): Promise<Record<string, any>> {
  const ids = Array.isArray(businessIds) ? businessIds : [businessIds];
  try {
    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("id, settings")
      .in("business_id", ids);

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

// Helper: save procurement store to outlets.settings
async function saveProcurementStore(businessIds: string[] | string, store: Record<string, any>): Promise<void> {
  const ids = Array.isArray(businessIds) ? businessIds : [businessIds];
  try {
    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("id, settings")
      .in("business_id", ids);

    for (const o of outlets || []) {
      const current = (o.settings as any) || {};
      const updated = { ...current, procurement: store };
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

          // 0. INVENTORY ITEMS (Single Source of Truth)
          if (type === "items") {
            let dbItems: any[] = [];
            try {
              const { data, error } = await supabaseAdmin
                .from("inventory_items")
                .select("*")
                .in("business_id", allIds)
                .order("name", { ascending: true });

              if (!error && data && data.length > 0) {
                dbItems = data;
              } else {
                const { data: allData } = await supabaseAdmin
                  .from("inventory_items")
                  .select("*")
                  .order("name", { ascending: true });
                dbItems = allData || [];
              }
            } catch (err) {
              console.error("[api/inventory] Error querying inventory_items:", err);
              dbItems = [];
            }

            const suppliers = store.suppliers || [];
            const extraMeta = store.item_meta || {};

            const mappedItems = dbItems.map((row: any) => {
              const meta = extraMeta[row.id] || {};
              const stockVal = Number(row.stock) || 0;
              const minVal = Number(row.minimum_stock) || 0;
              const costPrice =
                typeof row.cost_price === "number"
                  ? row.cost_price
                  : typeof meta.cost_price === "number"
                    ? meta.cost_price
                    : meta.cost_price
                      ? Number(meta.cost_price)
                      : 0;
              const supplierId = row.supplier_id || meta.supplier_id || null;
              const matchedSup = suppliers.find((s: any) => s.id === supplierId);
              const outletId = row.outlet_id || meta.outlet_id || null;
              const outletName = meta.outlet_name || null;
              const yieldPerUnit =
                typeof row.yield_per_unit === "number" && row.yield_per_unit > 0
                  ? row.yield_per_unit
                  : typeof meta.yield_per_unit === "number" && meta.yield_per_unit > 0
                    ? meta.yield_per_unit
                    : meta.yield_per_unit
                      ? Number(meta.yield_per_unit) || null
                      : null;
              const yieldUnit = row.yield_unit || meta.yield_unit || null;

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

            return Response.json({ success: true, data: mappedItems });
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

            // Load outlet names map to enrich transfers
            let outletNameMap = new Map<string, string>();
            try {
              const { data: outData } = await supabaseAdmin.from("outlets").select("id, name");
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
              delete insertPayload.cost_price;
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
                return Response.json(
                  { error: err2?.message || err1?.message || "Gagal membuat bahan baku" },
                  { status: 500 },
                );
              }
              inserted = res2;
            }

            const yieldPerUnitVal =
              itemData.yield_per_unit !== undefined && itemData.yield_per_unit !== null
                ? Number(itemData.yield_per_unit) || null
                : null;
            const yieldUnitVal = itemData.yield_unit ? String(itemData.yield_unit).trim() : null;

            store.item_meta = store.item_meta || {};
            store.item_meta[inserted.id] = {
              cost_price: Number(itemData.cost_price) || 0,
              supplier_id: itemData.supplier_id || null,
              outlet_id: itemData.outlet_id || null,
              outlet_name: itemData.outlet_name || null,
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
              delete updatePayload.cost_price;
              delete updatePayload.supplier_id;
              delete updatePayload.outlet_id;
              delete updatePayload.yield_per_unit;
              delete updatePayload.yield_unit;
              await supabaseAdmin
                .from("inventory_items")
                .update(updatePayload as any)
                .eq("id", body.id);
            }

            store.item_meta = store.item_meta || {};
            store.item_meta[body.id] = {
              ...(store.item_meta[body.id] || {}),
              ...(itemData.cost_price !== undefined ? { cost_price: Number(itemData.cost_price) } : {}),
              ...(itemData.supplier_id !== undefined ? { supplier_id: itemData.supplier_id } : {}),
              ...(itemData.outlet_id !== undefined ? { outlet_id: itemData.outlet_id } : {}),
              ...(itemData.outlet_name !== undefined ? { outlet_name: itemData.outlet_name } : {}),
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

          // 0c. DELETE ITEM
          if (action === "delete-item") {
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

          // 3. DELETE SUPPLIER
          if (action === "delete-supplier") {
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

          // 5. UPDATE PO STATUS (WITH AUTO STOCK RECEIVE)
          if (action === "update-po-status") {
            const { po_id, status } = body;
            const targetPO = store.purchase_orders.find((p: any) => p.id === po_id);
            if (targetPO) {
              targetPO.status = status;
              if (status === "received") {
                targetPO.received_at = new Date().toISOString();

                // Auto-increment inventory_items
                for (const it of targetPO.items || []) {
                  if (it.inventory_item_id) {
                    const { data: invRow } = await supabaseAdmin
                      .from("inventory_items")
                      .select("stock, unit")
                      .eq("id", it.inventory_item_id)
                      .single();

                    if (invRow) {
                      const newStock = Number(invRow.stock) + Number(it.quantity);
                      await supabaseAdmin
                        .from("inventory_items")
                        .update({ stock: newStock, updated_at: new Date().toISOString() })
                        .eq("id", it.inventory_item_id);

                      // Log stock movement
                      const movRecord = {
                        id: `mov-${Date.now()}-${Math.random()}`,
                        business_id: businessId,
                        inventory_item_id: it.inventory_item_id,
                        item_name: it.item_name,
                        movement_type: "stock_in",
                        quantity: Number(it.quantity),
                        unit: it.unit,
                        remaining_stock: newStock,
                        notes: `Penerimaan Purchase Order ${targetPO.po_number}`,
                        created_at: new Date().toISOString(),
                      };
                      store.stock_movements = [movRecord, ...store.stock_movements];
                    }
                  }
                }
              }
            }

            try {
              await supabaseAdmin
                .from("purchase_orders" as any)
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", po_id);
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

          // 7. UPDATE TRANSFER STATUS (WITH REAL STOCK MUTATION ON RECEIVE)
          if (action === "update-transfer-status") {
            const { transfer_id, status } = body;
            let targetTransfer = store.stock_transfers.find((t: any) => t.id === transfer_id);
            if (!targetTransfer) {
              try {
                const { data: dbTrf } = await supabaseAdmin
                  .from("stock_transfers" as any)
                  .select(`*, items:stock_transfer_items(*)`)
                  .eq("id", transfer_id)
                  .single();
                if (dbTrf) targetTransfer = dbTrf;
              } catch {}
            }
            if (targetTransfer && (!targetTransfer.items || targetTransfer.items.length === 0)) {
              const matchedStore = store.stock_transfers.find(
                (t: any) => t.id === transfer_id || t.transfer_number === targetTransfer.transfer_number,
              );
              if (matchedStore && Array.isArray(matchedStore.items) && matchedStore.items.length > 0) {
                targetTransfer.items = matchedStore.items;
              }
            }
            const prevStatus = targetTransfer?.status;
            if (targetTransfer) {
              targetTransfer.status = status;
              if (status === "sent") targetTransfer.sent_at = new Date().toISOString();
              if (status === "received") targetTransfer.received_at = new Date().toISOString();
            }

            // Real stock mutation when status becomes "received" and wasn't previously "received"
            if (status === "received" && prevStatus !== "received" && targetTransfer) {
              const originOutletId = targetTransfer.origin_outlet_id || null;
              const destOutletId = targetTransfer.destination_outlet_id || null;
              const originName = targetTransfer.origin_outlet_name || "Gudang Asal";
              const destName = targetTransfer.destination_outlet_name || "Cabang Tujuan";

              for (const it of targetTransfer.items || []) {
                const qty = Number(it.quantity) || 0;
                if (qty <= 0) continue;

                // 1. Deduct stock from origin item
                if (it.inventory_item_id) {
                  const { data: originItem } = await supabaseAdmin
                    .from("inventory_items")
                    .select("*")
                    .eq("id", it.inventory_item_id)
                    .single();

                  if (originItem) {
                    const newOriginStock = Math.max(0, (Number(originItem.stock) || 0) - qty);
                    await supabaseAdmin
                      .from("inventory_items")
                      .update({ stock: newOriginStock, updated_at: new Date().toISOString() })
                      .eq("id", it.inventory_item_id);

                    // Log stock movement transfer_out
                    const movOut = {
                      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                      business_id: businessId,
                      inventory_item_id: it.inventory_item_id,
                      item_name: it.item_name || originItem.name,
                      outlet_id: originOutletId,
                      movement_type: "transfer_out",
                      quantity: qty,
                      unit: it.unit || originItem.unit || "pcs",
                      remaining_stock: newOriginStock,
                      notes: `Transfer Keluar ke ${destName} (${targetTransfer.transfer_number || transfer_id})`,
                      created_at: new Date().toISOString(),
                    };
                    store.stock_movements = [movOut, ...(store.stock_movements || [])];
                    try {
                      await supabaseAdmin.from("stock_movements" as any).insert(movOut);
                    } catch {}

                    // 2. Add or insert stock in destination outlet
                    let destItem: any = null;
                    if (destOutletId) {
                      const { data: existingDest } = await (supabaseAdmin
                        .from("inventory_items" as any)
                        .select("*")
                        .eq("business_id", businessId) as any)
                        .eq("outlet_id", destOutletId)
                        .ilike("name", (it.item_name || originItem.name).trim())
                        .maybeSingle();
                      destItem = existingDest;
                    }

                    if (destItem) {
                      const newDestStock = (Number(destItem.stock) || 0) + qty;
                      await supabaseAdmin
                        .from("inventory_items")
                        .update({ stock: newDestStock, updated_at: new Date().toISOString() })
                        .eq("id", destItem.id);

                      const movIn = {
                        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        business_id: businessId,
                        inventory_item_id: destItem.id,
                        item_name: destItem.name,
                        outlet_id: destOutletId,
                        movement_type: "transfer_in",
                        quantity: qty,
                        unit: destItem.unit || it.unit,
                        remaining_stock: newDestStock,
                        notes: `Transfer Masuk dari ${originName} (${targetTransfer.transfer_number || transfer_id})`,
                        created_at: new Date().toISOString(),
                      };
                      store.stock_movements = [movIn, ...(store.stock_movements || [])];
                      try {
                        await supabaseAdmin.from("stock_movements" as any).insert(movIn);
                      } catch {}
                    } else if (destOutletId) {
                      // Insert new inventory item row for destination outlet
                      try {
                        const { data: newDestItem } = await (supabaseAdmin
                          .from("inventory_items" as any)
                          .insert({
                            business_id: businessId,
                            outlet_id: destOutletId,
                            name: (it.item_name || originItem.name).trim(),
                            category: originItem.category || "Bahan Baku",
                            unit: it.unit || originItem.unit || "pcs",
                            stock: qty,
                            minimum_stock: originItem.minimum_stock || 10,
                            health_score: 100,
                          } as any) as any)
                          .select()
                          .single();

                        if (newDestItem) {
                          const movIn = {
                            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                            business_id: businessId,
                            inventory_item_id: newDestItem.id,
                            item_name: newDestItem.name,
                            outlet_id: destOutletId,
                            movement_type: "transfer_in",
                            quantity: qty,
                            unit: newDestItem.unit,
                            remaining_stock: qty,
                            notes: `Transfer Masuk dari ${originName} (${targetTransfer.transfer_number || transfer_id})`,
                            created_at: new Date().toISOString(),
                          };
                          store.stock_movements = [movIn, ...(store.stock_movements || [])];
                          try {
                            await supabaseAdmin.from("stock_movements" as any).insert(movIn);
                          } catch {}
                        }
                      } catch {
                        // Table may not have outlet_id column or already exists
                      }
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
            const { inventory_item_id, quantity, reason, cost_loss, notes } = body.data;
            const { data: invItem } = await supabaseAdmin
              .from("inventory_items")
              .select("*")
              .eq("id", inventory_item_id)
              .single();

            const itemName = invItem?.name || "Bahan Baku";
            const unit = invItem?.unit || "pcs";
            const finalCost = cost_loss || Number(quantity) * (Number(invItem?.cost_price) || 0);

            const newWaste = {
              id: `waste-${Date.now()}`,
              business_id: businessId,
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
