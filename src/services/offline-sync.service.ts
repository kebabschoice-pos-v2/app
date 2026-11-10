import { supabase } from "@/integrations/supabase/client";

export interface CachedCatalogData {
  outlet_id: string;
  business_id: string;
  products: any[];
  categories: any[];
  variant_groups?: any[];
  cached_at: string;
}

export interface OfflineTransaction {
  idempotency_key: string;
  order_number: string;
  business_id: string;
  outlet_id: string;
  cashier_name: string;
  customer_id?: string | null;
  customer_name?: string | null;
  payment_method: string;
  total: number;
  created_at: string;
  items: any[];
  status: "pending" | "syncing" | "failed";
  error_message?: string;
  retry_count: number;
  raw_order_payload: any;
  raw_order_items_payload: any[];
  stock_depletions?: Array<{
    inventory_item_id: string;
    quantity: number;
    unit: string;
    product_name: string;
  }>;
  product_depletions?: Array<{
    product_id: string;
    quantity: number;
  }>;
}

export interface NetworkSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
}

const DB_NAME = "kebabschoicepos_offline_db";
const DB_VERSION = 1;
const FALLBACK_TX_STORAGE_KEY = "kebabschoicepos_pending_transactions_fallback";

// Check SSR safety
export function isClient(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return true;
}

export function isIndexedDBSupported(): boolean {
  return isClient() && typeof indexedDB !== "undefined";
}

export function isOnline(): boolean {
  if (!isClient()) return true;
  return navigator.onLine !== false;
}

// In-memory status state
let currentNetworkStatus: NetworkSyncStatus = {
  isOnline: isOnline(),
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
};

const statusSubscribers = new Set<(status: NetworkSyncStatus) => void>();

function notifyStatusSubscribers() {
  const snapshot: NetworkSyncStatus = { ...currentNetworkStatus };
  statusSubscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (e) {
      console.warn("[OfflineSync] Subscriber error:", e);
    }
  });
}

/**
 * Open or create IndexedDB instance for offline storage
 */
export function openOfflineDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBSupported()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("cached_catalog")) {
          db.createObjectStore("cached_catalog", { keyPath: "outlet_id" });
        }
        if (!db.objectStoreNames.contains("pending_transactions")) {
          const store = db.createObjectStore("pending_transactions", {
            keyPath: "idempotency_key",
          });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("[OfflineDB] Open request error:", request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("[OfflineDB] Exception opening IndexedDB:", err);
      resolve(null);
    }
  });
}

/**
 * Cache outlet catalog (menus, categories, variants) into IndexedDB
 */
export async function cacheOutletCatalog(
  outletId: string,
  catalog: {
    businessId?: string | null;
    products: any[];
    categories?: any[];
    variantGroups?: any[];
  },
): Promise<void> {
  const db = await openOfflineDatabase();
  const effectiveId = outletId || "all";

  const entry: CachedCatalogData = {
    outlet_id: effectiveId,
    business_id: catalog.businessId || "",
    products: catalog.products || [],
    categories: catalog.categories || [],
    variant_groups: catalog.variantGroups || [],
    cached_at: new Date().toISOString(),
  };

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`kebabschoicepos_catalog_${effectiveId}`, JSON.stringify(entry));
      }
    } catch {}
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("cached_catalog", "readwrite");
      const store = tx.objectStore("cached_catalog");
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) {
      console.warn("[OfflineDB] cacheOutletCatalog error:", e);
      resolve();
    }
  });
}

/**
 * Get cached catalog for an outlet from IndexedDB
 */
export async function getCachedOutletCatalog(outletId: string): Promise<CachedCatalogData | null> {
  const effectiveId = outletId || "all";
  const db = await openOfflineDatabase();

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(`kebabschoicepos_catalog_${effectiveId}`);
        return raw ? JSON.parse(raw) : null;
      }
    } catch {}
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("cached_catalog", "readonly");
      const store = tx.objectStore("cached_catalog");
      const request = store.get(effectiveId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Queue a new transaction in IndexedDB pending_transactions store
 */
export async function queueOfflineTransaction(transaction: OfflineTransaction): Promise<void> {
  const db = await openOfflineDatabase();

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        const existing = JSON.parse(localStorage.getItem(FALLBACK_TX_STORAGE_KEY) || "[]");
        existing.push(transaction);
        localStorage.setItem(FALLBACK_TX_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch {}
    await refreshPendingCount();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("pending_transactions", "readwrite");
      const store = tx.objectStore("pending_transactions");
      store.put(transaction);
      tx.oncomplete = async () => {
        await refreshPendingCount();
        resolve();
      };
      tx.onerror = async () => {
        await refreshPendingCount();
        resolve();
      };
    } catch (e) {
      resolve();
    }
  });
}

/**
 * Get all pending transactions waiting to be synced
 */
export async function getPendingTransactions(): Promise<OfflineTransaction[]> {
  const db = await openOfflineDatabase();

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        return JSON.parse(localStorage.getItem(FALLBACK_TX_STORAGE_KEY) || "[]");
      }
    } catch {}
    return [];
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("pending_transactions", "readonly");
      const store = tx.objectStore("pending_transactions");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Remove a successfully synced transaction by its idempotency_key
 */
export async function removePendingTransaction(idempotencyKey: string): Promise<void> {
  const db = await openOfflineDatabase();

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        const existing: OfflineTransaction[] = JSON.parse(
          localStorage.getItem(FALLBACK_TX_STORAGE_KEY) || "[]",
        );
        const filtered = existing.filter((t) => t.idempotency_key !== idempotencyKey);
        localStorage.setItem(FALLBACK_TX_STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch {}
    await refreshPendingCount();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("pending_transactions", "readwrite");
      const store = tx.objectStore("pending_transactions");
      store.delete(idempotencyKey);
      tx.oncomplete = async () => {
        await refreshPendingCount();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

/**
 * Clear all pending transactions
 */
export async function clearPendingTransactions(): Promise<void> {
  const db = await openOfflineDatabase();

  if (!db) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(FALLBACK_TX_STORAGE_KEY);
      }
    } catch {}
    await refreshPendingCount();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("pending_transactions", "readwrite");
      const store = tx.objectStore("pending_transactions");
      store.clear();
      tx.oncomplete = async () => {
        await refreshPendingCount();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

/**
 * Refresh count of pending transactions and notify subscribers
 */
export async function refreshPendingCount(): Promise<number> {
  const pending = await getPendingTransactions();
  currentNetworkStatus.pendingCount = pending.length;
  currentNetworkStatus.isOnline = isOnline();
  notifyStatusSubscribers();
  return pending.length;
}

/**
 * Synchronize all pending transactions sequentially to Supabase
 * Uses idempotency_key and order_number to guarantee exactly-once processing (no duplicates)
 */
export async function syncPendingTransactions(
  onProgress?: (synced: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  if (currentNetworkStatus.isSyncing) {
    return { success: 0, failed: 0 };
  }

  currentNetworkStatus.isSyncing = true;
  notifyStatusSubscribers();

  const pending = await getPendingTransactions();
  if (pending.length === 0) {
    currentNetworkStatus.isSyncing = false;
    currentNetworkStatus.lastSyncedAt = new Date().toISOString();
    notifyStatusSubscribers();
    return { success: 0, failed: 0 };
  }

  // Sort sequentially by created_at
  pending.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const tx = pending[i];
    if (!tx) continue;

    try {
      // 1. Idempotency Check: Verify if order_number already exists in Supabase
      const { data: existingOrder } = await supabase
        .from("sales_orders")
        .select("id")
        .eq("order_number", tx.order_number)
        .maybeSingle();

      let orderId = existingOrder?.id;

      if (!orderId) {
        // 2. Insert sales_orders record
        const orderPayload = { ...tx.raw_order_payload };
        let { data: newOrder, error: orderErr } = await supabase
          .from("sales_orders")
          .insert(orderPayload)
          .select("id")
          .single();

        if (orderErr && (orderErr.message?.includes("outlet_id") || orderErr.code === "PGRST204")) {
          delete orderPayload.outlet_id;
          const retry = await supabase
            .from("sales_orders")
            .insert(orderPayload)
            .select("id")
            .single();
          newOrder = retry.data;
          orderErr = retry.error;
        }

        if (orderErr || !newOrder) {
          throw new Error(orderErr?.message || "Gagal insert sales_order");
        }
        orderId = newOrder.id;

        // 3. Insert sales_order_items
        if (Array.isArray(tx.raw_order_items_payload) && tx.raw_order_items_payload.length > 0) {
          const itemsToInsert = tx.raw_order_items_payload.map((item) => ({
            ...item,
            order_id: orderId,
          }));
          const { error: itemsErr } = await supabase.from("sales_order_items").insert(itemsToInsert as any);
          if (itemsErr) {
            console.warn("[offline-sync] sales_order_items insert warning, retrying with core fields:", itemsErr.message);
            const coreItems = itemsToInsert.map((it: any) => ({
              order_id: it.order_id,
              product_id: it.product_id,
              name: it.name,
              variant_name: it.variant_name || null,
              notes: it.notes || null,
              quantity: it.quantity,
              unit_price: it.unit_price,
              subtotal: it.subtotal,
            }));
            await supabase.from("sales_order_items").insert(coreItems as any);
          }
        }

        // 4. Record stock movements if available
        if (Array.isArray(tx.stock_depletions) && tx.stock_depletions.length > 0) {
          for (const dep of tx.stock_depletions) {
            try {
              const { data: currentInv } = await supabase
                .from("inventory_items")
                .select("id, stock")
                .eq("id", dep.inventory_item_id)
                .maybeSingle();

              if (currentInv) {
                const updatedStock = Math.max(0, (Number(currentInv.stock) || 0) - dep.quantity);
                await supabase
                  .from("inventory_items")
                  .update({ stock: updatedStock, updated_at: new Date().toISOString() })
                  .eq("id", dep.inventory_item_id);

                await supabase.from("stock_movements" as any).insert({
                  business_id: tx.business_id,
                  inventory_item_id: dep.inventory_item_id,
                  outlet_id: tx.outlet_id,
                  order_id: orderId,
                  reference_id: orderId,
                  reference_type: "pos_order",
                  type: "pos_sale",
                  movement_type: "pos_sale",
                  quantity: dep.quantity,
                  unit: dep.unit,
                  remaining_stock: updatedStock,
                  notes: `Offline Sync POS #${tx.order_number}: ${dep.product_name}`,
                  created_at: new Date().toISOString(),
                });
              }
            } catch (invErr) {
              console.warn("[OfflineSync] Inventory stock depletion warning:", invErr);
            }
          }
        }

        // 5. Update products stock
        if (Array.isArray(tx.product_depletions) && tx.product_depletions.length > 0) {
          for (const pDep of tx.product_depletions) {
            try {
              const { data: pRow } = await supabase
                .from("products")
                .select("id, stock")
                .eq("id", pDep.product_id)
                .maybeSingle();
              if (pRow) {
                const newPStock = Math.max(0, (Number(pRow.stock) || 0) - pDep.quantity);
                await supabase
                  .from("products")
                  .update({ stock: newPStock, updated_at: new Date().toISOString() })
                  .eq("id", pDep.product_id);
              }
            } catch {}
          }
        }
      }

      // Order successfully synced to Supabase (or already existed) -> remove from IndexedDB
      await removePendingTransaction(tx.idempotency_key);
      successCount++;
    } catch (err: any) {
      console.warn(`[OfflineSync] Transaction #${tx.order_number} sync failed:`, err);
      failedCount++;
    }

    if (onProgress) {
      onProgress(i + 1, pending.length);
    }
  }

  currentNetworkStatus.isSyncing = false;
  currentNetworkStatus.lastSyncedAt = new Date().toISOString();
  await refreshPendingCount();

  return { success: successCount, failed: failedCount };
}

/**
 * Subscribe to network and sync status changes
 */
export function subscribeNetworkStatus(callback: (status: NetworkSyncStatus) => void): () => void {
  statusSubscribers.add(callback);
  callback({ ...currentNetworkStatus });

  // Initialize browser listeners once
  if (isClient()) {
    const handleOnline = () => {
      currentNetworkStatus.isOnline = true;
      notifyStatusSubscribers();
      // Auto-sync when coming back online
      syncPendingTransactions().catch(() => {});
    };

    const handleOffline = () => {
      currentNetworkStatus.isOnline = false;
      notifyStatusSubscribers();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pending count refresh
    refreshPendingCount().catch(() => {});

    return () => {
      statusSubscribers.delete(callback);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  return () => {
    statusSubscribers.delete(callback);
  };
}

export function getNetworkStatus(): NetworkSyncStatus {
  if (isClient()) {
    currentNetworkStatus.isOnline = navigator.onLine !== false;
  }
  return { ...currentNetworkStatus };
}
