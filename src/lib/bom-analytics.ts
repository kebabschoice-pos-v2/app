import { convertRecipeToInventoryQuantity } from "@/services/menu.service";

export interface OutletLite {
  id: string;
  name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export interface InventoryItemLite {
  id: string;
  name?: string | null;
  unit?: string | null;
  cost_price?: number | null;
  yield_per_unit?: number | null;
  yield_unit?: string | null;
  outlet_id?: string | null;
}

export interface ProductLite {
  id: string;
  name?: string | null;
  price?: number | null;
  cost_price?: number | null;
  category?: string | null;
  is_active?: boolean | null;
}

export interface RecipeIngredientLite {
  inventory_item_id?: string | null;
  ingredient_id?: string | null;
  name?: string | null;
  ingredient_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export interface OrderLite {
  id: string;
  outlet_id?: string | null;
  total?: number | null;
  status?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  items?: OrderItemLite[] | null;
}

export interface OrderItemLite {
  id?: string;
  order_id?: string;
  product_id?: string | null;
  name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
}

export interface ResolvedIngredientParams {
  costPrice: number;
  unit: string;
  yieldPerUnit: number | null;
  yieldUnit: string | null;
}

export interface ProductBomEstimate {
  unitBomCost: number;
  hasRecipeBom: boolean;
}

export interface OrdersBomMetricsResult {
  totalRevenue: number;
  totalOrders: number;
  totalItemsSold: number;
  totalBomCost: number;
  grossProfit: number;
  marginPercentage: number;
  productCostMap: Record<string, number>;
  productBomCostMap: Record<string, number>;
  productSalesMap: Record<string, { soldCount: number; revenue: number }>;
}

const TEST_OUTLET_PATTERN = /\b(test|testing|uji|sandbox|demo)\b/i;

/**
 * Picks the primary operational outlet from active outlets.
 * Prioritizes non-test active outlets (e.g., "kebab pasar jumat" ahead of "Kebab's. Choice test")
 * so historical transactions without an active outlet_id are consistently attributed.
 */
export function resolvePrimaryOutletId(outlets: OutletLite[] = []): string | null {
  const active = outlets.filter((o) => Boolean(o?.id) && o?.is_active !== false);
  const pool = active.length > 0 ? active : outlets.filter((o) => Boolean(o?.id));
  if (pool.length === 0) return null;

  const primaryNonTest = pool.find((o) => !TEST_OUTLET_PATTERN.test(String(o.name || "")));
  return (primaryNonTest || pool[0])?.id ?? null;
}

/**
 * Normalizes an order's outlet_id against active outlets.
 * Orphaned UUIDs (deleted/test outlets) and null/empty outlet_ids are attributed to the primary outlet.
 */
export function normalizeOrderOutletId(
  rawOutletId: string | null | undefined,
  activeOutlets: OutletLite[] = [],
  metadataOutletId?: string | null,
): string | null {
  const activeIds = new Set(
    activeOutlets.filter((o) => Boolean(o?.id) && o?.is_active !== false).map((o) => String(o.id)),
  );
  const fallbackIds =
    activeIds.size > 0
      ? activeIds
      : new Set(activeOutlets.filter((o) => Boolean(o?.id)).map((o) => String(o.id)));

  if (rawOutletId && fallbackIds.has(String(rawOutletId))) {
    return String(rawOutletId);
  }
  if (metadataOutletId && fallbackIds.has(String(metadataOutletId))) {
    return String(metadataOutletId);
  }
  return resolvePrimaryOutletId(activeOutlets);
}

/**
 * Resolves cost_price, unit, yield_per_unit, and yield_unit for an inventory ingredient.
 * Never overwrites valid non-zero DB costs; applies smart fallbacks only when DB fields are <= 0/missing.
 */
export function resolveInventoryIngredientParams(
  inv: Partial<InventoryItemLite> | null | undefined,
): ResolvedIngredientParams {
  const nameLower = String(inv?.name || "").toLowerCase();
  let unit = String(inv?.unit || "pcs").trim() || "pcs";
  let costPrice = Number(inv?.cost_price) || 0;
  let yieldPerUnit =
    inv?.yield_per_unit != null && Number(inv.yield_per_unit) > 0
      ? Number(inv.yield_per_unit)
      : null;
  let yieldUnit = inv?.yield_unit ? String(inv.yield_unit).trim() : null;

  if (nameLower.includes("tortilla")) {
    if (costPrice <= 0) costPrice = 25000;
    if (!yieldPerUnit) yieldPerUnit = 20;
    if (!yieldUnit) yieldUnit = "pcs";
    if (!inv?.unit) unit = "pack";
  } else if (nameLower.includes("daging")) {
    if (costPrice <= 0) costPrice = 120000;
    if (!yieldPerUnit) yieldPerUnit = 2000;
    if (!yieldUnit) yieldUnit = "gram";
  }

  return { costPrice, unit, yieldPerUnit, yieldUnit };
}

function findMatchingInventoryItem(
  ingredient: RecipeIngredientLite,
  inventoryItems: InventoryItemLite[],
): InventoryItemLite | undefined {
  const targetId = ingredient.inventory_item_id || ingredient.ingredient_id;
  if (targetId) {
    const exactIdMatch = inventoryItems.find((i) => i.id === targetId);
    if (exactIdMatch) {
      // If exact ID item lacks cost_price, check same-named item with cost_price > 0
      if ((Number(exactIdMatch.cost_price) || 0) > 0) return exactIdMatch;
      const targetName = String(exactIdMatch.name || "").trim().toLowerCase();
      const pricedSibling = targetName
        ? inventoryItems.find(
            (i) =>
              String(i.name || "").trim().toLowerCase() === targetName &&
              (Number(i.cost_price) || 0) > 0,
          )
        : undefined;
      return pricedSibling || exactIdMatch;
    }
  }

  const rawName = String(ingredient.name || ingredient.ingredient_name || "")
    .trim()
    .toLowerCase();
  if (!rawName) return undefined;

  const exactName = inventoryItems.filter(
    (i) => String(i.name || "").trim().toLowerCase() === rawName,
  );
  if (exactName.length > 0) {
    return exactName.find((i) => (Number(i.cost_price) || 0) > 0) || exactName[0];
  }

  const partialMatches = inventoryItems.filter((i) => {
    const invName = String(i.name || "").trim().toLowerCase();
    return invName && (invName.includes(rawName) || rawName.includes(invName));
  });
  return partialMatches.find((i) => (Number(i.cost_price) || 0) > 0) || partialMatches[0];
}

function extractRecipeItems(recipeEntry: unknown): RecipeIngredientLite[] {
  if (!recipeEntry) return [];
  if (Array.isArray(recipeEntry)) return recipeEntry as RecipeIngredientLite[];
  if (
    typeof recipeEntry === "object" &&
    Array.isArray((recipeEntry as { items?: unknown }).items)
  ) {
    return (recipeEntry as { items: RecipeIngredientLite[] }).items;
  }
  return [];
}

/**
 * Computes exact single-portion BOM cost from recipe ingredients and inventory master data.
 */
export function computeRecipeUnitBomCost(
  recipeEntry: unknown,
  inventoryItems: InventoryItemLite[],
): number {
  const items = extractRecipeItems(recipeEntry);
  if (items.length === 0) return 0;

  let totalCost = 0;
  for (const ing of items) {
    const qty = Number(ing.quantity) || 0;
    if (qty <= 0) continue;

    const inv = findMatchingInventoryItem(ing, inventoryItems);
    const params = resolveInventoryIngredientParams(
      inv || { name: ing.name || ing.ingredient_name || "", unit: ing.unit || "pcs" },
    );
    const recipeUnit = String(ing.unit || params.yieldUnit || params.unit || "pcs");
    const usedInvQty = convertRecipeToInventoryQuantity(
      qty,
      recipeUnit,
      params.unit,
      params.yieldPerUnit,
      params.yieldUnit,
    );
    totalCost += usedInvQty * params.costPrice;
  }

  return Math.round(totalCost);
}

/**
 * Single Source of Truth BOM analytics across /dashboard, /analytics, /performance-menu,
 * /performance-outlet, and /money-allocation.
 */
export function estimateOrdersBomMetrics(params: {
  orders: OrderLite[];
  orderItems?: OrderItemLite[];
  products: ProductLite[];
  menuRecipes?: Record<string, unknown>;
  inventoryItems?: InventoryItemLite[];
}): OrdersBomMetricsResult {
  const {
    orders = [],
    orderItems = [],
    products = [],
    menuRecipes = {},
    inventoryItems = [],
  } = params;

  const productById = new Map<string, ProductLite>();
  const productByName = new Map<string, ProductLite>();
  for (const p of products) {
    if (!p?.id) continue;
    productById.set(p.id, p);
    const normName = String(p.name || "").trim().toLowerCase();
    if (normName && !productByName.has(normName)) {
      productByName.set(normName, p);
    }
  }

  // Normalize recipe lookup by product id and lowercase product name
  const recipeByKey = new Map<string, RecipeIngredientLite[]>();
  for (const [key, entry] of Object.entries(menuRecipes || {})) {
    const list = extractRecipeItems(entry);
    if (list.length === 0) continue;
    recipeByKey.set(key, list);
    recipeByKey.set(key.toLowerCase(), list);
    const matchedProd = productById.get(key) || productByName.get(key.toLowerCase());
    if (matchedProd?.name) {
      recipeByKey.set(String(matchedProd.name).trim().toLowerCase(), list);
    }
  }

  const productCostMap: Record<string, number> = {};
  const productBomCostMap: Record<string, number> = {};
  let hasAnyRecipeBom = false;

  for (const p of products) {
    if (!p?.id) continue;
    const normName = String(p.name || "").trim().toLowerCase();
    const recipe = recipeByKey.get(p.id) || (normName ? recipeByKey.get(normName) : undefined);
    const bomCost = recipe ? computeRecipeUnitBomCost(recipe, inventoryItems) : 0;
    const price = Number(p.price) || 0;
    const productCost = Number(p.cost_price) || 0;

    if (bomCost > 0) {
      hasAnyRecipeBom = true;
      productCostMap[p.id] = bomCost;
      productBomCostMap[p.id] = bomCost;
    } else if (productCost > 0) {
      productCostMap[p.id] = productCost;
    } else {
      productCostMap[p.id] = price > 0 ? Math.round(price * 0.4) : 0;
    }
  }

  // Anchor product for historical orders without itemized rows (prefers "Original", else first BOM recipe product)
  const originalNamedProduct = products.find((p) =>
    /original/i.test(String(p.name || "")),
  );
  const firstRecipeProduct = products.find((p) => (productBomCostMap[p.id] || 0) > 0);
  const firstPricedProduct = products.find((p) => (Number(p.price) || 0) > 0);
  const anchorProduct =
    (originalNamedProduct && (productBomCostMap[originalNamedProduct.id] || 0) > 0
      ? originalNamedProduct
      : firstRecipeProduct) ||
    originalNamedProduct ||
    firstPricedProduct;

  const anchorPrice = (anchorProduct && Number(anchorProduct.price)) || 9000;
  let anchorUnitBomCost = anchorProduct ? productBomCostMap[anchorProduct.id] || 0 : 0;
  if (anchorUnitBomCost <= 0 && !hasAnyRecipeBom) {
    // When no recipes exist yet, preserve unit-test average product cost ratio or 40% fallback
    let sumProdPrice = 0;
    let sumProdCost = 0;
    for (const p of products) {
      const pr = Number(p.price) || 0;
      const co = Number(p.cost_price) || 0;
      if (pr > 0) {
        sumProdPrice += pr;
        sumProdCost += co;
      }
    }
    if (sumProdPrice > 0 && sumProdCost > 0) {
      anchorUnitBomCost = Math.round(anchorPrice * (sumProdCost / sumProdPrice));
    } else if (anchorProduct && (Number(anchorProduct.cost_price) || 0) > 0) {
      anchorUnitBomCost = Number(anchorProduct.cost_price);
    } else {
      anchorUnitBomCost = Math.round(anchorPrice * 0.4);
    }
  }

  // Group sales_order_items by order_id
  const itemsByOrderId = new Map<string, OrderItemLite[]>();
  for (const item of orderItems) {
    if (!item?.order_id) continue;
    const list = itemsByOrderId.get(item.order_id) || [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  }

  let totalRevenue = 0;
  let totalItemsSold = 0;
  let totalBomCost = 0;
  const productSalesMap: Record<string, { soldCount: number; revenue: number }> = {};
  const recordProductSale = (salesKey: string, soldQty: number, rev: number) => {
    if (!salesKey) return;
    let entry = productSalesMap[salesKey];
    if (!entry) {
      entry = { soldCount: 0, revenue: 0 };
      productSalesMap[salesKey] = entry;
    }
    entry.soldCount += soldQty;
    entry.revenue += rev;
  };

  for (const ord of orders) {
    const ordTotal = Number(ord.total) || 0;
    totalRevenue += ordTotal;

    const directItems = itemsByOrderId.get(ord.id);
    const attachedItems =
      Array.isArray(ord.items) && ord.items.length > 0 ? ord.items : undefined;
    const itemsForOrder = directItems && directItems.length > 0 ? directItems : attachedItems;

    if (itemsForOrder && itemsForOrder.length > 0) {
      for (const item of itemsForOrder) {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const lineRevenue = Number(item.subtotal) || unitPrice * qty;
        const itemNameLower = String(item.name || "").trim().toLowerCase();
        const prod =
          (item.product_id ? productById.get(item.product_id) : undefined) ||
          (itemNameLower ? productByName.get(itemNameLower) : undefined);

        let unitCost = prod ? productBomCostMap[prod.id] || 0 : 0;
        if (unitCost <= 0) {
          const matchedRecipe =
            (item.product_id ? recipeByKey.get(item.product_id) : undefined) ||
            (itemNameLower ? recipeByKey.get(itemNameLower) : undefined);
          if (matchedRecipe) {
            unitCost = computeRecipeUnitBomCost(matchedRecipe, inventoryItems);
          }
        }
        if (unitCost <= 0 && prod) {
          unitCost = productCostMap[prod.id] || 0;
        }
        if (unitCost <= 0) {
          const fallbackUnitPrice = unitPrice || anchorPrice;
          unitCost = Math.round(fallbackUnitPrice * 0.4);
        }

        totalItemsSold += qty;
        totalBomCost += Math.round(unitCost * qty);

        const salesKey = prod?.id || item.product_id || String(item.name || "");
        recordProductSale(salesKey, qty, lineRevenue);
      }
    } else if (ordTotal > 0) {
      // Engine 2 Smart Fallback for historical orders without itemized rows
      const estPortions = Math.max(1, Math.round(ordTotal / anchorPrice));
      totalItemsSold += estPortions;
      totalBomCost += Math.round(estPortions * anchorUnitBomCost);

      if (anchorProduct?.id) {
        recordProductSale(anchorProduct.id, estPortions, ordTotal);
      }
    }
  }

  const grossProfit = Math.max(0, totalRevenue - totalBomCost);
  let marginPercentage = 0;
  if (totalRevenue > 0) {
    marginPercentage = Math.round((grossProfit / totalRevenue) * 100);
  } else if (anchorProduct && (Number(anchorProduct.price) || 0) > 0) {
    const apPrice = Number(anchorProduct.price) || 0;
    const apCost = productCostMap[anchorProduct.id] || 0;
    marginPercentage = Math.round(((apPrice - apCost) / apPrice) * 100);
  }

  return {
    totalRevenue,
    totalOrders: orders.length,
    totalItemsSold,
    totalBomCost,
    grossProfit,
    marginPercentage,
    productCostMap,
    productBomCostMap,
    productSalesMap,
  };
}
