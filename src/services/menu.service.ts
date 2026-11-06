import { supabase } from "@/integrations/supabase/client";

export interface MenuCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
  active: boolean;
  item_count?: number;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

export function ensureCategoryUuid(id?: string | null): string {
  if (isValidUuid(id)) return id!.trim();
  return crypto.randomUUID();
}

export function isSystemCategory(cat?: {
  is_system?: boolean;
  name?: string;
  id?: string;
}): boolean {
  return Boolean(cat?.is_system === true);
}

export interface MenuVariantOption {
  id?: string;
  group_id?: string;
  name: string;
  price_adjustment: number;
  additional_price?: number;
  is_default?: boolean;
  sort_order?: number;
}

export interface MenuVariantGroup {
  id?: string;
  menu_item_id?: string;
  name: string;
  selection_type: "single" | "multiple";
  is_required?: boolean;
  sort_order?: number;
  options: MenuVariantOption[];
}

export interface MenuModifierOption {
  id?: string;
  name: string;
  price_adjustment: number;
  category?: "level" | "prep" | "addon";
}

export const STANDARD_UNITS = [
  { value: "gram", label: "gram (g)", group: "Berat" },
  { value: "kg", label: "kilogram (kg)", group: "Berat" },
  { value: "ml", label: "mililiter (ml)", group: "Volume" },
  { value: "liter", label: "liter (l)", group: "Volume" },
  { value: "pcs", label: "pcs (buah/biji)", group: "Satuan / Count" },
  { value: "pack", label: "pack", group: "Satuan / Count" },
  { value: "box", label: "box", group: "Satuan / Count" },
  { value: "botol", label: "botol", group: "Satuan / Count" },
  { value: "sachet", label: "sachet", group: "Satuan / Count" },
  { value: "cup", label: "cup", group: "Kemasan / Packaging" },
  { value: "bungkus", label: "bungkus", group: "Kemasan / Packaging" },
  { value: "kardus", label: "kardus", group: "Kemasan / Packaging" },
  { value: "lembar", label: "lembar (tortilla/keju)", group: "Kemasan / Packaging" },
] as const;

export function convertRecipeToInventoryQuantity(
  recipeQty: number,
  recipeUnit: string,
  inventoryUnit: string,
): number {
  const rUnit = (recipeUnit || "").toLowerCase().trim();
  const iUnit = (inventoryUnit || "").toLowerCase().trim();

  if (!rUnit || !iUnit || rUnit === iUnit) return recipeQty;

  // Weight: gram <-> kg
  if ((rUnit === "gram" || rUnit === "g") && (iUnit === "kg" || iUnit === "kilogram")) {
    return recipeQty / 1000;
  }
  if ((rUnit === "kg" || rUnit === "kilogram") && (iUnit === "gram" || iUnit === "g")) {
    return recipeQty * 1000;
  }

  // Volume: ml <-> liter
  if ((rUnit === "ml" || rUnit === "mililiter") && (iUnit === "liter" || iUnit === "l")) {
    return recipeQty / 1000;
  }
  if ((rUnit === "liter" || rUnit === "l") && (iUnit === "ml" || iUnit === "mililiter")) {
    return recipeQty * 1000;
  }

  return recipeQty;
}

export interface MenuModifier {
  id?: string;
  menu_item_id?: string;
  name: string;
  price_adjustment: number;
  active: boolean;
}

export interface OutletMenuAssignment {
  id?: string;
  outlet_id: string;
  outlet_name?: string;
  available: boolean;
  selling_price?: number | null;
}

export interface RecipeItem {
  id?: string;
  inventory_item_id?: string | null;
  ingredient_name: string;
  quantity: number;
  unit: string;
  cost_estimate?: number;
}

export interface MenuRecipe {
  id?: string;
  menu_item_id: string;
  name: string;
  yield_portions: number;
  items: RecipeItem[];
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id?: string | null;
  category_name?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  image_crop_position?: { x: number; y: number } | null;
  crop_x?: number;
  crop_y?: number;
  image_position_x?: number;
  image_position_y?: number;
  image_zoom?: number;
  zoom?: number;
  image_rotation?: number;
  rotation?: number;
  image_aspect_ratio?: "original" | "1:1" | "16:9" | "custom" | "full" | string;
  aspect_ratio?: string;
  price: number;
  cost_price: number;
  promo_price?: number | null;
  tax_rate?: number;
  sku?: string | null;
  barcode?: string | null;
  active: boolean;
  variant_groups?: MenuVariantGroup[];
  modifiers?: MenuModifier[];
  variants?: MenuVariantOption[];
  customization_options?: MenuModifierOption[];
  addons?: MenuVariantOption[];
  outlet_assignments?: OutletMenuAssignment[];
  recipe?: MenuRecipe | null;
  recipe_items?: RecipeItem[];
  created_at?: string;
  updated_at?: string;
}

export interface MenuItemInput {
  business_id?: string;
  category_id?: string | null;
  category_name?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  image_crop_position?: { x: number; y: number } | null;
  crop_x?: number;
  crop_y?: number;
  image_position_x?: number;
  image_position_y?: number;
  image_zoom?: number;
  zoom?: number;
  image_rotation?: number;
  rotation?: number;
  image_aspect_ratio?: "original" | "1:1" | "16:9" | "custom" | "full" | string;
  aspect_ratio?: string;
  price: number;
  cost_price?: number;
  promo_price?: number | null;
  tax_rate?: number;
  sku?: string | null;
  barcode?: string | null;
  active?: boolean;
  variant_groups?: MenuVariantGroup[];
  modifiers?: MenuModifier[];
  variants?: MenuVariantOption[];
  customization_options?: MenuModifierOption[];
  addons?: MenuVariantOption[];
  outlets?: OutletMenuAssignment[];
  recipe_items?: RecipeItem[];
}

export interface MenuOutletInfo {
  id: string;
  business_id: string;
  name: string;
  code?: string;
  address?: string | null;
  active: boolean;
  status: "active" | "inactive";
}

export interface InventoryIngredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  cost_price?: number;
  selling_price?: number;
}

/**
 * Resolves all business IDs associated with the current user (owned + members)
 */
export async function resolveAllUserBusinessIds(): Promise<string[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return [];
  }

  // 1. Owned businesses
  const { data: owned } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", authData.user.id)
    .order("created_at", { ascending: true });

  const ownedIds = (owned || []).map((b) => b.id);

  // 2. Business members
  const { data: members } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", authData.user.id);

  const memberIds = (members || []).map((m) => m.business_id);

  return Array.from(new Set([...ownedIds, ...memberIds].filter(Boolean)));
}

/**
 * Resolves current active business ID
 */
export async function resolveActiveBusinessId(explicitBusinessId?: string): Promise<string> {
  if (explicitBusinessId) return explicitBusinessId;

  // a) Check saved active business ID from localStorage
  const savedBizId =
    typeof window !== "undefined"
      ? localStorage.getItem("kebabschoicepos_active_business_id")
      : null;

  // b) Get all businesses for this user
  const allBizIds = await resolveAllUserBusinessIds();

  // c) If savedBizId is in user's businesses, use it! Otherwise use first business
  if (savedBizId && allBizIds.includes(savedBizId)) {
    return savedBizId;
  }

  if (allBizIds.length > 0 && allBizIds[0]) {
    return allBizIds[0];
  }

  if (savedBizId) {
    return savedBizId;
  }

  throw new Error("Bisnis aktif tidak ditemukan untuk akun ini.");
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Upload menu item photo to storage
 * Path: business-assets/{business_id}/menu/{filename}
 */
export async function uploadMenuImage(file: File, businessId?: string): Promise<string> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("businessId", bid);
  formData.append("folder", "menu");

  const res = await fetch("/api/upload-logo", {
    method: "POST",
    headers,
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal mengunggah foto menu");
  }

  return json.publicUrl;
}

/**
 * Get Categories
 */
export async function getCategories(businessId?: string): Promise<MenuCategory[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(`/api/menu?type=categories&businessId=${encodeURIComponent(bid)}`, {
      headers,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data
          .filter((c: MenuCategory) => !c.name?.includes("6004"))
          .map((c: MenuCategory) => ({
            ...c,
            id: ensureCategoryUuid(c.id),
            is_system: false,
          }));
      }
    }
  } catch (err) {
    console.warn("[menu.service] API categories fetch error:", err);
  }

  // Fallback direct from database and outlet settings
  const fallbackCats: MenuCategory[] = [];

  try {
    const { data: dbCats } = await supabase
      .from("menu_categories" as any)
      .select("id, name, description, active")
      .eq("business_id", bid);

    if (dbCats) {
      for (const c of dbCats as any[]) {
        if (c.name && c.name.includes("6004")) continue;
        if (!fallbackCats.some((ex) => ex.name.toLowerCase() === c.name.toLowerCase())) {
          fallbackCats.push({
            id: ensureCategoryUuid(c.id),
            business_id: bid,
            name: c.name,
            description: c.description || null,
            active: c.active !== false,
            is_system: false,
          });
        }
      }
    }

    const { data: outletRecs } = await supabase.from("outlets").select("settings");

    for (const o of outletRecs || []) {
      const oCats = (o.settings as any)?.menu_categories;
      if (Array.isArray(oCats)) {
        for (const c of oCats) {
          if (c.name && c.name.includes("6004")) continue;
          if (!fallbackCats.some((ex) => ex.name.toLowerCase() === c.name.toLowerCase())) {
            fallbackCats.push({
              id: ensureCategoryUuid(c.id),
              business_id: bid,
              name: c.name,
              description: c.description || null,
              active: c.active !== false,
              is_system: false,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return fallbackCats;
}

/**
 * Create Category
 */
export async function createCategory(data: {
  name: string;
  description?: string;
  business_id?: string;
  is_system?: boolean;
}): Promise<MenuCategory> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();
  const categoryUuid = ensureCategoryUuid(null);

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create-category",
      id: categoryUuid,
      business_id: bid,
      name: data.name,
      description: data.description,
      is_system: false,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal menambahkan kategori menu");
  }

  return {
    ...json.data,
    id: ensureCategoryUuid(json.data?.id || categoryUuid),
    is_system: false,
  };
}

/**
 * Update Category
 */
export async function updateCategory(
  id: string,
  data: { name: string; description?: string },
): Promise<MenuCategory> {
  const bid = await resolveActiveBusinessId();
  const headers = await getAuthHeader();

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "update-category",
      id,
      business_id: bid,
      ...data,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal memperbarui kategori menu");
  }

  return json.data;
}

/**
 * Delete Category
 */
export async function deleteCategory(id: string, name?: string): Promise<void> {
  const bid = await resolveActiveBusinessId();
  const headers = await getAuthHeader();

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "delete-category",
      id,
      name,
      business_id: bid,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal menghapus kategori menu");
  }
}

/**
 * Get Business Outlets (BUG 2 FIX)
 */
export async function getBusinessOutlets(businessId?: string): Promise<MenuOutletInfo[]> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    const res = await fetch(`/api/menu?type=outlets&businessId=${encodeURIComponent(bid)}`, {
      headers,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[menu.service] API outlets fetch error, fallback:", err);
  }

  // Fallback client query: select * for schema resilience
  const { data } = await (supabase.from("outlets" as any) as any)
    .select("*")
    .order("created_at", { ascending: true });

  return ((data || []) as any[]).map((o) => ({
    id: o.id,
    business_id: o.business_id,
    name: o.name,
    code: o.code || "",
    address: o.address || "",
    active: o.active !== false,
    status: o.active !== false ? "active" : "inactive",
  }));
}

/**
 * Get Inventory Ingredients for Recipe BOM (100% Single Source of Truth with Inventory Management)
 */
export async function getInventoryIngredients(businessId?: string): Promise<InventoryIngredient[]> {
  try {
    const { getInventoryItems } = await import("./inventory.service");
    const items = await getInventoryItems(businessId);
    if (Array.isArray(items) && items.length > 0) {
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        stock: item.stock,
        minimum_stock: item.minimum_stock,
        cost_price: item.cost_price,
      }));
    }
  } catch (err) {
    console.warn("[getInventoryIngredients] Error calling getInventoryItems:", err);
  }

  // Fallback to /api/menu?type=ingredients
  try {
    const bid = await resolveActiveBusinessId(businessId);
    const headers = await getAuthHeader();
    const res = await fetch(`/api/menu?type=ingredients&businessId=${encodeURIComponent(bid)}`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (_) {}

  const { data } = await supabase
    .from("inventory_items")
    .select("*")
    .order("name", { ascending: true });
  return (data || []) as InventoryIngredient[];
}

/**
 * 2-Way Auto-Sync helper between Menu Recipes BOM & Inventory Items
 */
export async function syncMenuRecipesWithInventory(businessId?: string): Promise<void> {
  try {
    const { getInventoryItems, createInventoryItem } = await import("./inventory.service");
    const [invItems, menuItems] = await Promise.all([
      getInventoryItems(businessId),
      getMenuItems({ businessId }),
    ]);

    const invMapByName = new Map<string, typeof invItems[0]>();
    const invMapById = new Map<string, typeof invItems[0]>();
    for (const item of invItems) {
      invMapByName.set(item.name.toLowerCase().trim(), item);
      invMapById.set(item.id, item);
    }

    let hasCreatedAny = false;

    for (const m of menuItems) {
      const rItems = m.recipe_items || m.recipe?.items || [];
      if (!Array.isArray(rItems) || rItems.length === 0) continue;

      let modified = false;
      for (const r of rItems) {
        if (!r.ingredient_name || !r.ingredient_name.trim()) continue;
        const cleanName = r.ingredient_name.trim();
        const lowerName = cleanName.toLowerCase();

        if (!r.inventory_item_id || !invMapById.has(r.inventory_item_id)) {
          if (invMapByName.has(lowerName)) {
            r.inventory_item_id = invMapByName.get(lowerName)!.id;
            modified = true;
          } else {
            try {
              const newItem = await createInventoryItem(
                {
                  name: cleanName,
                  category: "Bahan Baku",
                  unit: r.unit || "gram",
                  stock: 0,
                  minimum_stock: 10,
                  cost_price: Number(r.cost_estimate) || 0,
                },
                businessId,
              );
              r.inventory_item_id = newItem.id;
              invMapByName.set(lowerName, newItem as any);
              invMapById.set(newItem.id, newItem as any);
              modified = true;
              hasCreatedAny = true;
            } catch (createErr) {
              console.warn(
                `[syncMenuRecipesWithInventory] Failed to auto-create inventory item for ${cleanName}:`,
                createErr,
              );
            }
          }
        }
      }

      if (modified) {
        try {
          await updateMenuItem(m.id, {
            name: m.name,
            recipe_items: rItems,
          });
        } catch (updErr) {
          console.warn(`[syncMenuRecipesWithInventory] Failed to update menu item ${m.id}:`, updErr);
        }
      }
    }

    if (hasCreatedAny && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inventory:updated"));
      window.dispatchEvent(new CustomEvent("pos:menu-updated"));
    }
  } catch (err) {
    console.warn("[syncMenuRecipesWithInventory] Error during sync:", err);
  }
}

/**
 * Get Menu Items List
 */
export async function getMenuItems(filters?: {
  businessId?: string;
  categoryId?: string;
  search?: string;
}): Promise<MenuItem[]> {
  const bid = await resolveActiveBusinessId(filters?.businessId);
  const headers = await getAuthHeader();

  const params = new URLSearchParams({
    type: "items",
    businessId: bid,
  });

  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.search) params.set("search", filters.search);

  try {
    const res = await fetch(`/api/menu?${params.toString()}`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[menu.service] API items fetch error:", err);
  }

  // Fallback direct from products (only active items)
  const { data: prods } = await supabase
    .from("products")
    .select("*")
    .neq("active", false)
    .order("created_at", { ascending: false });

  return (prods || [])
    .filter((p) => p.active !== false && !(p as any).is_deleted)
    .map((p) => ({
    id: p.id,
    business_id: p.business_id,
    category_id: null,
    category_name: p.category || "",
    name: p.name,
    description: null,
    image_url: p.image_url,
    price: Number(p.price) || 0,
    cost_price: Number((p as any).cost_price) || 0,
    promo_price: (p as any).promo_price ? Number((p as any).promo_price) : null,
    tax_rate: Number((p as any).tax_rate) || 0,
    sku: (p as any).sku || null,
    barcode: (p as any).barcode || null,
    active: p.active !== false,
    modifiers: [],
    outlet_assignments: [],
    recipe_items: [],
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

/**
 * Create Menu Item
 */
export async function createMenuItem(data: MenuItemInput): Promise<MenuItem> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  const sanitizedData: MenuItemInput = {
    ...data,
    category_id: isValidUuid(data.category_id) ? (data.category_id ?? null) : null,
  };

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create-item",
      business_id: bid,
      ...sanitizedData,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal membuat menu baru");
  }

  return json.data;
}

/**
 * Update Menu Item
 */
export async function updateMenuItem(id: string, data: Partial<MenuItemInput>): Promise<MenuItem> {
  const bid = await resolveActiveBusinessId(data.business_id);
  const headers = await getAuthHeader();

  const sanitizedData: Partial<MenuItemInput> = {
    ...data,
  };
  if (data.category_id !== undefined) {
    sanitizedData.category_id = isValidUuid(data.category_id) ? (data.category_id ?? null) : null;
  }

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "update-item",
      id,
      business_id: bid,
      ...sanitizedData,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal memperbarui menu");
  }

  return json.data;
}

/**
 * Delete Menu Item
 */
export async function deleteMenuItem(id: string, businessId?: string): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  let apiSuccess = false;
  try {
    const res = await fetch("/api/menu", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "delete-item",
        id,
        business_id: bid,
      }),
    });

    const json = await res.json();
    if (res.ok && json.success) {
      apiSuccess = true;
    }
  } catch (err) {
    console.warn("[deleteMenuItem] API error, falling back to direct db action:", err);
  }

  // Direct Supabase cascade cleanup ONLY executed as fallback if API route failed
  if (!apiSuccess) {
    try {
      // 1. Delete recipes & recipe_items
      const { data: recs } = await supabase
        .from("recipes" as any)
        .select("id")
        .eq("menu_item_id", id);
      const { data: menuRecs } = await supabase
        .from("menu_recipes" as any)
        .select("id")
        .eq("menu_item_id", id);

      const recipeIds = Array.from(
        new Set([
          ...((recs || []) as any[]).map((r) => r.id),
          ...((menuRecs || []) as any[]).map((r) => r.id),
        ]),
      );

      if (recipeIds.length > 0) {
        await supabase.from("recipe_items" as any).delete().in("recipe_id", recipeIds);
      }
      try {
        await supabase.from("recipe_items" as any).delete().eq("product_id", id);
      } catch {}
      await supabase.from("recipes" as any).delete().eq("menu_item_id", id);
      await supabase.from("menu_recipes" as any).delete().eq("menu_item_id", id);
      try {
        await supabase.from("product_recipes" as any).delete().eq("product_id", id);
      } catch {}

      // 2. Delete variant groups & options
      const { data: vGroups } = await supabase
        .from("menu_variant_groups" as any)
        .select("id")
        .eq("menu_item_id", id);
      const groupIds = ((vGroups || []) as any[]).map((g) => g.id);
      if (groupIds.length > 0) {
        await supabase.from("menu_variant_options" as any).delete().in("group_id", groupIds);
      }
      await supabase.from("menu_variant_groups" as any).delete().eq("menu_item_id", id);
      try {
        await supabase.from("product_variants" as any).delete().eq("product_id", id);
      } catch {}

      // 3. Delete outlet assignments
      await supabase.from("outlet_menu_items" as any).delete().eq("menu_item_id", id);
      await supabase.from("outlet_assignments" as any).delete().eq("menu_item_id", id);

      // 4. Delete from menu_items table
      await supabase.from("menu_items" as any).delete().eq("id", id);

      // 5. Delete or soft-delete products table
      const { error: delErr } = await supabase.from("products").delete().eq("id", id);
      if (delErr) {
        await supabase
          .from("products")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", id);

        await supabase
          .from("menu_items" as any)
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    } catch (err) {
      console.warn("[deleteMenuItem] Direct child cascade cleanup warning:", err);
    }
  }

  // 6. Purge localStorage cache if present
  if (typeof window !== "undefined") {
    try {
      const snapKey = "kebabschoicepos_snapshot";
      const snapStr = window.localStorage.getItem(snapKey);
      if (snapStr) {
        const snap = JSON.parse(snapStr);
        if (snap.products) {
          snap.products = snap.products.filter((p: any) => p.id !== id);
          window.localStorage.setItem(snapKey, JSON.stringify(snap));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
    window.dispatchEvent(new CustomEvent("menu-updated"));
  }
}

/**
 * Toggle Status Active
 */
export async function toggleMenuItemStatus(
  id: string,
  active: boolean,
  businessId?: string,
): Promise<boolean> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  try {
    await fetch("/api/menu", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "toggle-status",
        id,
        active,
        business_id: bid,
      }),
    });
  } catch {
    // continue to direct DB update
  }

  await supabase
    .from("products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  return active;
}

/**
 * Assign Menu Outlet
 */
export async function assignMenuOutlet(
  menuId: string,
  outletId: string,
  available: boolean,
  sellingPrice?: number | null,
  businessId?: string,
): Promise<void> {
  const bid = await resolveActiveBusinessId(businessId);
  const headers = await getAuthHeader();

  const res = await fetch("/api/menu", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "assign-outlet",
      business_id: bid,
      menu_item_id: menuId,
      outlet_id: outletId,
      available,
      selling_price: sellingPrice,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Gagal mengatur ketersediaan outlet");
  }
}
