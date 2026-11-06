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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Canonical category UUID map (intentionally empty: zero hardcoded defaults)
export const SYSTEM_CATEGORY_UUIDS: Record<string, string> = {};

function isValidCategoryUuid(val: any): boolean {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

function ensureCategoryUuid(id: any, _name?: string): string {
  if (isValidCategoryUuid(id)) return id.trim();
  return crypto.randomUUID();
}

async function resolveValidCategoryId(
  inputCategoryId: any,
  categoryName?: string,
  allBusinessIds: string[] = [],
): Promise<string | null> {
  if (isValidCategoryUuid(inputCategoryId)) {
    return inputCategoryId.trim();
  }
  if (categoryName && categoryName.trim()) {
    try {
      const { data: dbCat } = await (supabaseAdmin as any)
        .from("menu_categories")
        .select("id")
        .ilike("name", categoryName.trim())
        .in("business_id", allBusinessIds)
        .maybeSingle();
      if (dbCat?.id && isValidCategoryUuid(dbCat.id)) {
        return dbCat.id;
      }
    } catch {
      // fallback
    }
  }
  return null;
}

export const Route = createFileRoute("/api/menu")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          if ("error" in auth) {
            return Response.json({ error: auth.error }, { status: auth.status });
          }

          const url = new URL(request.url);
          const type = url.searchParams.get("type") || "items";
          const requestedBusinessId = url.searchParams.get("businessId");
          const { primaryId: businessId, allIds: allBusinessIds } = await resolveUserBusinessIds(
            auth.user.id,
            requestedBusinessId,
          );

          if (!businessId && allBusinessIds.length === 0) {
            return Response.json({ error: "business_id tidak ditemukan" }, { status: 400 });
          }

          // 1. Categories
          if (type === "categories") {
            let combinedCategories: any[] = [];

            // A. Check dedicated table menu_categories
            try {
              const { data: dbCats } = await (supabaseAdmin as any)
                .from("menu_categories")
                .select("*")
                .in("business_id", allBusinessIds)
                .order("sort_order", { ascending: true });

              if (dbCats && dbCats.length > 0) {
                for (const c of dbCats as any[]) {
                  if (c.name && c.name.includes("6004")) continue;
                  combinedCategories.push({
                    ...c,
                    id: ensureCategoryUuid(c.id, c.name),
                  });
                }
              }
            } catch {
              // Table not in schema cache
            }

            // B. Check outlets.settings.menu_categories (Persistent JSON storage)
            try {
              const { data: outletsWithSettings } = await supabaseAdmin
                .from("outlets")
                .select("id, settings")
                .in("business_id", allBusinessIds);

              if (outletsWithSettings) {
                for (const o of outletsWithSettings) {
                  const oCats = (o.settings as any)?.menu_categories;
                  if (Array.isArray(oCats)) {
                    for (const c of oCats) {
                      if (c.name && c.name.includes("6004")) continue;
                      if (
                        !combinedCategories.some(
                          (ex) => ex.name.toLowerCase() === c.name.toLowerCase(),
                        )
                      ) {
                        combinedCategories.push({
                          id: ensureCategoryUuid(c.id, c.name),
                          business_id: businessId,
                          name: c.name,
                          description: c.description || null,
                          active: c.active !== false,
                        });
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Error reading outlet settings categories:", err);
            }

            combinedCategories = combinedCategories
              .filter((c) => !c.name?.includes("6004"))
              .map((c) => ({
                ...c,
                id: ensureCategoryUuid(c.id),
                is_system: false,
              }));

            console.log("MENU FETCH TABLE: categories resolved", combinedCategories.length);
            return Response.json({ success: true, data: combinedCategories });
          }

          // 2. Outlets list (BUG 2 FIX: Select active, address, code, in(allBusinessIds))
          if (type === "outlets") {
            const { data: outlets, error } = await (supabaseAdmin.from("outlets" as any) as any)
              .select("*")
              .in("business_id", allBusinessIds)
              .order("created_at", { ascending: true });

            if (error) {
              console.error("[api/menu] Outlets fetch error:", error);
              return Response.json({ error: error.message }, { status: 500 });
            }

            const mappedOutlets = ((outlets as any[]) || []).map((o: any) => ({
              id: o.id,
              business_id: o.business_id,
              name: o.name,
              code: o.code || "",
              address: o.address || "",
              active: o.active !== false,
              status: o.active !== false ? "active" : "inactive",
            }));

            console.log("MENU FETCH TABLE: outlets found", mappedOutlets.length);
            return Response.json({ success: true, data: mappedOutlets });
          }

          // 3. Inventory Ingredients for Recipe / BOM (Single Source of Truth: inventory_items)
          if (type === "ingredients") {
            let invItems: any[] = [];
            try {
              const invRes = await supabaseAdmin
                .from("inventory_items")
                .select("id, name, category, unit, stock, minimum_stock, cost_price")
                .in("business_id", allBusinessIds)
                .order("name", { ascending: true });

              if (
                invRes.error &&
                (invRes.error.message?.includes("cost_price") ||
                  (invRes.error as any).details?.includes("cost_price"))
              ) {
                const fallbackRes = await supabaseAdmin
                  .from("inventory_items")
                  .select("id, name, category, unit, stock, minimum_stock")
                  .in("business_id", allBusinessIds)
                  .order("name", { ascending: true });
                invItems = fallbackRes.data || [];
              } else if (invRes.error) {
                console.error("[api/menu] inventory_items query error:", invRes.error);
                return Response.json({ error: invRes.error.message }, { status: 500 });
              } else {
                invItems = invRes.data || [];
              }
            } catch (err: any) {
              console.error("[api/menu] ingredients fetch error:", err);
              invItems = [];
            }

            return Response.json({ success: true, data: invItems });
          }

          // 4. Recipe Detail for a Menu Item
          if (type === "recipe") {
            const itemId = url.searchParams.get("itemId");
            if (!itemId) return Response.json({ error: "itemId required" }, { status: 400 });

            // A. Check standalone recipes table (relational schema V2.0)
            try {
              const { data: recipe } = await supabaseAdmin
                .from("recipes" as any)
                .select("*, recipe_items(*)")
                .or(`product_id.eq.${itemId},menu_item_id.eq.${itemId}`)
                .maybeSingle();

              if (recipe) {
                return Response.json({ success: true, data: recipe });
              }
            } catch {
              // table not ready
            }

            // B. Check menu_recipes table
            try {
              const { data: recipe } = await supabaseAdmin
                .from("menu_recipes" as any)
                .select("*, recipe_items(*)")
                .or(`menu_item_id.eq.${itemId},product_id.eq.${itemId}`)
                .maybeSingle();

              if (recipe) {
                return Response.json({ success: true, data: recipe });
              }
            } catch {
              // table not ready
            }

            // B. Check outlets.settings.menu_recipes
            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("settings")
              .in("business_id", allBusinessIds);

            for (const o of outlets || []) {
              const recipesObj = (o.settings as any)?.menu_recipes;
              if (recipesObj && recipesObj[itemId]) {
                return Response.json({ success: true, data: recipesObj[itemId] });
              }
            }

            return Response.json({ success: true, data: null });
          }

          // 5. Menu Items List
          const categoryId = url.searchParams.get("categoryId");
          const search = url.searchParams.get("search");

          let menuItems: any[] = [];

          // Try relational table menu_items (only active, non-deleted items)
          try {
            let query = supabaseAdmin
              .from("menu_items" as any)
              .select("*, menu_categories(id, name)")
              .in("business_id", allBusinessIds)
              .neq("active", false)
              .order("created_at", { ascending: false });

            if (categoryId && isValidCategoryUuid(categoryId)) {
              query = query.eq("category_id", categoryId);
            }

            const { data: dbItems, error: dbErr } = await query;
            if (!dbErr && dbItems && dbItems.length > 0) {
              menuItems = dbItems
                .filter((i: any) => i.active !== false && !i.is_deleted)
                .map((i: any) => ({
                  ...i,
                  category_name: i.menu_categories?.name || "",
                  modifiers: [],
                  outlet_assignments: [],
                  recipe_items: [],
                }));
            }
          } catch {
            // Relational table not in schema cache
          }

          // Dual check from products table (so active items created on POS or products are included!)
          let { data: prods, error: prodErr } = await supabaseAdmin
            .from("products")
            .select("*")
            .in("business_id", allBusinessIds)
            .neq("active", false)
            .order("created_at", { ascending: false });

          if (prodErr) {
            console.warn(
              "[api/menu] products query failed on cost_price column, retrying select without cost_price:",
              prodErr.message,
            );
            const retryRes = await supabaseAdmin
              .from("products")
              .select("*")
              .in("business_id", allBusinessIds);
            prods = retryRes.data;
          }

          if (prods && prods.length > 0) {
            for (const p of prods) {
              if (p.active === false || (p as any).is_deleted) continue;
              const existingIdx = menuItems.findIndex(
                (m) => m.id === p.id || m.name.toLowerCase() === p.name.toLowerCase(),
              );
              if (existingIdx >= 0) {
                // Always sync latest photo and pricing fields from products table
                if (p.image_url) {
                  menuItems[existingIdx].image_url = p.image_url;
                }
                const cropPos =
                  (p as any).image_crop_position ||
                  ((p as any).crop_x !== undefined && (p as any).crop_y !== undefined
                    ? { x: (p as any).crop_x, y: (p as any).crop_y }
                    : null);
                const posX =
                  (p as any).image_position_x !== undefined
                    ? Number((p as any).image_position_x)
                    : (p as any).crop_x !== undefined
                      ? Number((p as any).crop_x)
                      : (cropPos?.x ?? 50);
                const posY =
                  (p as any).image_position_y !== undefined
                    ? Number((p as any).image_position_y)
                    : (p as any).crop_y !== undefined
                      ? Number((p as any).crop_y)
                      : (cropPos?.y ?? 50);
                menuItems[existingIdx].image_position_x = posX;
                menuItems[existingIdx].image_position_y = posY;
                menuItems[existingIdx].crop_x = posX;
                menuItems[existingIdx].crop_y = posY;
                menuItems[existingIdx].image_crop_position = {
                  x: posX,
                  y: posY,
                  image_position_x: posX,
                  image_position_y: posY,
                };

                if ((p as any).image_zoom !== undefined || (p as any).zoom !== undefined) {
                  const z = Number((p as any).image_zoom ?? (p as any).zoom);
                  menuItems[existingIdx].image_zoom = z;
                  menuItems[existingIdx].zoom = z;
                }
                if ((p as any).image_rotation !== undefined || (p as any).rotation !== undefined) {
                  const r = Number((p as any).image_rotation ?? (p as any).rotation);
                  menuItems[existingIdx].image_rotation = r;
                  menuItems[existingIdx].rotation = r;
                }
                const asp = "1:1";
                menuItems[existingIdx].image_aspect_ratio = asp;
                menuItems[existingIdx].aspect_ratio = asp;
                if ((p as any).promo_price !== undefined && (p as any).promo_price !== null) {
                  menuItems[existingIdx].promo_price = Number((p as any).promo_price);
                }
                if ((p as any).tax_rate !== undefined && (p as any).tax_rate !== null) {
                  menuItems[existingIdx].tax_rate = Number((p as any).tax_rate);
                }
                if (
                  (p as any).cost_price !== undefined &&
                  (p as any).cost_price !== null &&
                  !menuItems[existingIdx].cost_price
                ) {
                  menuItems[existingIdx].cost_price = Number((p as any).cost_price);
                }
              } else {
                const itemCropPos =
                  (p as any).image_crop_position ||
                  ((p as any).crop_x !== undefined && (p as any).crop_y !== undefined
                    ? { x: (p as any).crop_x, y: (p as any).crop_y }
                    : null);
                const posX =
                  (p as any).image_position_x !== undefined
                    ? Number((p as any).image_position_x)
                    : (p as any).crop_x !== undefined
                      ? Number((p as any).crop_x)
                      : (itemCropPos?.x ?? 50);
                const posY =
                  (p as any).image_position_y !== undefined
                    ? Number((p as any).image_position_y)
                    : (p as any).crop_y !== undefined
                      ? Number((p as any).crop_y)
                      : (itemCropPos?.y ?? 50);
                const itemZoom = Number((p as any).image_zoom ?? (p as any).zoom) || 1.0;
                const itemRot = Number((p as any).image_rotation ?? (p as any).rotation) || 0;
                const itemAspect = "1:1";

                menuItems.push({
                  id: p.id,
                  business_id: p.business_id,
                  name: p.name,
                  category_id: null,
                  category_name: p.category || "",
                  price: Number(p.price) || 0,
                  cost_price: Number((p as any).cost_price) || 0,
                  promo_price: (p as any).promo_price ? Number((p as any).promo_price) : null,
                  tax_rate: Number((p as any).tax_rate) || 0,
                  sku: null,
                  active: (p.active as any) !== false,
                  image_url: p.image_url || null,
                  image_crop_position: {
                    x: posX,
                    y: posY,
                    image_position_x: posX,
                    image_position_y: posY,
                  },
                  crop_x: posX,
                  crop_y: posY,
                  image_position_x: posX,
                  image_position_y: posY,
                  image_zoom: itemZoom,
                  zoom: itemZoom,
                  image_rotation: itemRot,
                  rotation: itemRot,
                  image_aspect_ratio: itemAspect,
                  aspect_ratio: itemAspect,
                  modifiers: [],
                  outlet_assignments: [],
                  recipe_items: [],
                  created_at: p.created_at,
                  updated_at: p.updated_at,
                });
              }
            }
          }

          // Enrich with stored outlet_menu_items & recipes from outlets.settings
          const { data: allOutlets } = await supabaseAdmin
            .from("outlets")
            .select("id, name, settings")
            .in("business_id", allBusinessIds);

          const storedRecipes: Record<string, any> = {};
          const storedCustomizations: Record<string, any> = {};
          const storedOutletsMap: Record<string, any[]> = {};

          for (const o of allOutlets || []) {
            const setObj = (o.settings as any) || {};
            if (setObj.menu_recipes) {
              Object.assign(storedRecipes, setObj.menu_recipes);
            }
            if (setObj.menu_customizations) {
              Object.assign(storedCustomizations, setObj.menu_customizations);
            }
            if (setObj.outlet_menu_assignments) {
              for (const [mId, assign] of Object.entries(setObj.outlet_menu_assignments)) {
                if (!storedOutletsMap[mId]) storedOutletsMap[mId] = [];
                storedOutletsMap[mId].push({
                  outlet_id: o.id,
                  outlet_name: o.name,
                  available: (assign as any).available !== false,
                  selling_price: (assign as any).selling_price || null,
                });
              }
            }
          }

          // Query relational menu_variant_groups & options
          const dbVariantGroupsMap: Record<string, any[]> = {};
          try {
            const { data: dbGroups } = await (supabaseAdmin as any)
              .from("menu_variant_groups")
              .select("*, menu_variant_options(*)")
              .in("business_id", allBusinessIds)
              .order("sort_order", { ascending: true });

            if (dbGroups && dbGroups.length > 0) {
              for (const g of dbGroups as any[]) {
                const itemId = g.menu_item_id;
                if (!dbVariantGroupsMap[itemId]) dbVariantGroupsMap[itemId] = [];
                const options = (g.menu_variant_options || [])
                  .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
                  .map((o: any) => ({
                    id: o.id,
                    group_id: o.group_id,
                    name: o.name,
                    additional_price: Number(o.additional_price) || 0,
                    price_adjustment: Number(o.additional_price) || 0,
                    is_default: o.is_default || false,
                    sort_order: o.sort_order || 0,
                  }));
                dbVariantGroupsMap[itemId].push({
                  id: g.id,
                  menu_item_id: g.menu_item_id,
                  name: g.name,
                  selection_type: g.selection_type || "single",
                  is_required: g.is_required || false,
                  options,
                });
              }
            }
          } catch {
            // Relational tables not yet created or offline
          }

          menuItems = menuItems.map((item) => {
            const itemRecipe = storedRecipes[item.id];
            const itemCustomization = storedCustomizations[item.id] || {};
            const itemOutlets =
              storedOutletsMap[item.id] ||
              (allOutlets || []).map((o) => ({
                outlet_id: o.id,
                outlet_name: o.name,
                available: true,
                selling_price: null,
              }));

            // Prioritize relational DB groups, then stored JSON variant_groups, then fallback synthesized from variants
            const vgList = dbVariantGroupsMap[item.id];
            const resolvedVariantGroups =
              vgList && vgList.length > 0
                ? vgList
                : Array.isArray(itemCustomization.variant_groups) &&
                    itemCustomization.variant_groups.length > 0
                  ? itemCustomization.variant_groups
                  : Array.isArray(itemCustomization.variants) &&
                      itemCustomization.variants.length > 0
                    ? [
                        {
                          id: `vg-${item.id}-size`,
                          name: "Ukuran",
                          selection_type: "single",
                          options: itemCustomization.variants.map((v: any, idx: number) => ({
                            id: v.id || `opt-${idx}`,
                            name: v.name,
                            price_adjustment: Number(v.price_adjustment) || 0,
                            additional_price: Number(v.price_adjustment || v.additional_price) || 0,
                          })),
                        },
                      ]
                    : [];

            return {
              ...item,
              cost_price: item.cost_price
                ? Number(item.cost_price)
                : itemCustomization.cost_price
                  ? Number(itemCustomization.cost_price)
                  : 0,
              promo_price: item.promo_price ?? itemCustomization.promo_price ?? null,
              tax_rate: item.tax_rate ?? itemCustomization.tax_rate ?? 0,
              image_crop_position:
                item.image_crop_position || itemCustomization.image_crop_position || null,
              image_zoom: item.image_zoom ?? itemCustomization.image_zoom ?? 1.0,
              image_rotation: item.image_rotation ?? itemCustomization.image_rotation ?? 0,
              image_aspect_ratio:
                item.image_aspect_ratio || itemCustomization.image_aspect_ratio || "1:1",
              variant_groups: resolvedVariantGroups,
              variants: itemCustomization.variants || resolvedVariantGroups[0]?.options || [],
              modifiers: itemCustomization.modifiers || [],
              addons: itemCustomization.addons || [],
              recipe: itemRecipe || null,
              recipe_items: itemRecipe?.items || [],
              outlet_assignments: itemOutlets,
            };
          });

          // Search filter
          if (search) {
            const s = search.toLowerCase();
            menuItems = menuItems.filter(
              (i) =>
                i.name?.toLowerCase().includes(s) ||
                i.category_name?.toLowerCase().includes(s) ||
                i.sku?.toLowerCase().includes(s),
            );
          }

          // Strict filter: only active, non-deleted menu items are returned to UI
          menuItems = menuItems.filter((i) => i.active !== false && !(i as any).is_deleted);

          return Response.json({ success: true, data: menuItems });
        } catch (err) {
          console.error("[api/menu] GET error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 },
          );
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
          const requestedBusinessId = body.business_id;
          const { primaryId: businessId, allIds: allBusinessIds } = await resolveUserBusinessIds(
            auth.user.id,
            requestedBusinessId,
          );

          if (!businessId) {
            return Response.json({ error: "business_id wajib disertakan" }, { status: 400 });
          }

          // 1. CREATE CATEGORY (BUG 1 FIX: Persistent save into outlets.settings.menu_categories)
          if (action === "create-category") {
            const name = body.name?.trim();
            if (!name) {
              return Response.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
            }

            if (name.includes("6004")) {
              return Response.json(
                { error: "Kategori dummy tidak dapat ditambahkan" },
                { status: 400 },
              );
            }

            const categoryUuid = ensureCategoryUuid(body.id);
            const newCategory = {
              id: categoryUuid,
              business_id: businessId,
              name,
              description: body.description?.trim() || null,
              active: true,
              is_system: false,
              created_at: new Date().toISOString(),
            };

            // A. Attempt insert into menu_categories table if exists
            try {
              const { data: dbCat } = await (supabaseAdmin as any)
                .from("menu_categories")
                .insert({
                  id: categoryUuid,
                  business_id: businessId,
                  name,
                  description: newCategory.description,
                  active: true,
                  is_system: newCategory.is_system,
                })
                .select()
                .single();

              if (dbCat?.id && isValidCategoryUuid(dbCat.id)) newCategory.id = dbCat.id;
            } catch {
              // table not ready
            }

            // B. Persist into all user outlets.settings.menu_categories
            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .in("business_id", allBusinessIds);

            for (const o of outlets || []) {
              const currentSettings = (o.settings as any) || {};
              const existingCats = Array.isArray(currentSettings.menu_categories)
                ? currentSettings.menu_categories
                : [];

              if (!existingCats.some((c: any) => c.name.toLowerCase() === name.toLowerCase())) {
                existingCats.push(newCategory);
                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...currentSettings, menu_categories: existingCats },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }
            }

            console.log("DATABASE RESPONSE: Category created & persisted:", newCategory);
            return Response.json({ success: true, data: newCategory });
          }

          // 2. UPDATE CATEGORY
          if (action === "update-category") {
            const id = body.id;
            const name = body.name?.trim();
            if (!id || !name)
              return Response.json({ error: "ID dan nama kategori required" }, { status: 400 });

            // Update in outlets.settings
            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .in("business_id", allBusinessIds);

            for (const o of outlets || []) {
              const cur = (o.settings as any) || {};
              if (Array.isArray(cur.menu_categories)) {
                const updated = cur.menu_categories.map((c: any) =>
                  c.id === id ? { ...c, name, description: body.description?.trim() || null } : c,
                );
                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...cur, menu_categories: updated },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }
            }

            return Response.json({ success: true, data: { id, name } });
          }

          // 3. DELETE CATEGORY
          if (action === "delete-category") {
            const id = body.id;
            const categoryName = body.name?.trim();
            if (!id) return Response.json({ error: "Category ID required" }, { status: 400 });

            let foundCategoryName = categoryName;

            const { data: outlets } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .in("business_id", allBusinessIds);

            for (const o of outlets || []) {
              const cur = (o.settings as any) || {};
              if (Array.isArray(cur.menu_categories)) {
                const target = cur.menu_categories.find(
                  (c: any) =>
                    c.id === id ||
                    (categoryName && c.name?.toLowerCase() === categoryName.toLowerCase()),
                );
                if (target?.name) {
                  foundCategoryName = target.name;
                }

                const updated = cur.menu_categories.filter(
                  (c: any) =>
                    c.id !== id &&
                    (!categoryName || c.name?.toLowerCase() !== categoryName.toLowerCase()),
                );
                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...cur, menu_categories: updated },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }
            }

            // Also delete from relational menu_categories table
            try {
              await supabaseAdmin
                .from("menu_categories" as any)
                .delete()
                .eq("id", id);
            } catch {
              // fallback
            }

            // Update any products referencing this deleted category to null
            const namesToUpdate = Array.from(
              new Set([foundCategoryName, categoryName].filter(Boolean)),
            ) as string[];
            for (const n of namesToUpdate) {
              try {
                const { error: err1 } = await supabaseAdmin
                  .from("products")
                  .update({ category: null, category_id: null })
                  .eq("category", n)
                  .in("business_id", allBusinessIds);
                if (err1 && (err1.code === "23502" || err1.message?.includes("not-null"))) {
                  await supabaseAdmin
                    .from("products")
                    .update({ category: "", category_id: null })
                    .eq("category", n)
                    .in("business_id", allBusinessIds);
                }
              } catch {
                // ignore
              }
            }
            try {
              const { error: err2 } = await supabaseAdmin
                .from("products")
                .update({ category: null, category_id: null })
                .eq("category_id", id)
                .in("business_id", allBusinessIds);
              if (err2 && (err2.code === "23502" || err2.message?.includes("not-null"))) {
                await supabaseAdmin
                  .from("products")
                  .update({ category: "", category_id: null })
                  .eq("category_id", id)
                  .in("business_id", allBusinessIds);
              }
            } catch {
              // ignore
            }

            return Response.json({ success: true });
          }

          // 4. CREATE MENU ITEM (with Image, BOM Recipe, and Outlet Assignments)
          if (action === "create-item") {
            const name = body.name?.trim();
            const price = Number(body.price) || 0;
            const costPrice = Number(body.cost_price) || 0;
            const categoryName = body.category_name?.trim() || "";
            const imageUrl = body.image_url || null;
            const active = body.active !== false;

            if (!name) {
              return Response.json({ error: "Nama menu wajib diisi" }, { status: 400 });
            }

            // Sync into products table for POS!
            const cropX =
              body.image_position_x !== undefined
                ? Number(body.image_position_x)
                : body.crop_x !== undefined
                  ? Number(body.crop_x)
                  : (body.image_crop_position?.x ?? 50);
            const cropY =
              body.image_position_y !== undefined
                ? Number(body.image_position_y)
                : body.crop_y !== undefined
                  ? Number(body.crop_y)
                  : (body.image_crop_position?.y ?? 50);
            const resolvedCropPos = {
              x: cropX,
              y: cropY,
              crop_x: cropX,
              crop_y: cropY,
              image_position_x: cropX,
              image_position_y: cropY,
            };
            const resolvedZoom = Number(body.image_zoom ?? body.zoom) || 1.0;
            const resolvedRotation = Number(body.image_rotation ?? body.rotation) || 0;
            const resolvedAspectRatio = "1:1";

            const variantGroupsInput = Array.isArray(body.variant_groups)
              ? body.variant_groups
              : [];
            const hasVariants = variantGroupsInput.length > 0;
            const hasRecipe = Array.isArray(body.recipe_items) && body.recipe_items.length > 0;

            const resolvedCatId = await resolveValidCategoryId(
              body.category_id,
              categoryName,
              allBusinessIds,
            );

            const productPayload: any = {
              business_id: businessId,
              name,
              category: categoryName,
              category_id: resolvedCatId,
              description: body.description || null,
              sku: body.sku || null,
              barcode: body.barcode || null,
              price,
              selling_price: price,
              cost_price: body.cost_price ? Number(body.cost_price) : 0,
              promo_price: body.promo_price ? Number(body.promo_price) : null,
              tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
              stock: 999,
              active,
              image_url: imageUrl,
              image_crop_position: resolvedCropPos,
              crop_x: cropX,
              crop_y: cropY,
              image_position_x: cropX,
              image_position_y: cropY,
              image_zoom: resolvedZoom,
              zoom: resolvedZoom,
              image_rotation: resolvedRotation,
              rotation: resolvedRotation,
              image_aspect_ratio: resolvedAspectRatio,
              has_variants: hasVariants,
              has_recipe: hasRecipe,
            };

            let { data: prodData, error: prodErr } = await supabaseAdmin
              .from("products")
              .insert(productPayload)
              .select()
              .single();

            // Resilient fallback: if schema cache lacks some newly migrated columns, retry with base columns
            if (
              prodErr &&
              (prodErr.message?.includes("column") ||
                (prodErr as any).details?.includes("column") ||
                prodErr.message?.includes("cost_price"))
            ) {
              console.warn(
                "[api/menu] cost_price column missing in schema cache, retrying insert without cost_price:",
                prodErr.message,
              );
              const safeBasePayload = {
                business_id: businessId,
                name,
                category: categoryName,
                price,
                stock: 999,
                active,
                image_url: imageUrl,
              };
              const retryRes = await supabaseAdmin
                .from("products")
                .insert(safeBasePayload)
                .select()
                .single();
              prodData = retryRes.data;
              prodErr = retryRes.error;
            }

            if (prodErr) {
              console.error("[api/menu] Product insert error:", prodErr);
              return Response.json({ error: prodErr.message }, { status: 500 });
            }

            const targetItemId = prodData?.id || "";

            // Also insert into menu_items table if available
            try {
              await supabaseAdmin.from("menu_items" as any).insert({
                id: targetItemId,
                business_id: businessId,
                category_id: resolvedCatId,
                category: categoryName,
                name,
                price,
                selling_price: price,
                cost_price: body.cost_price ? Number(body.cost_price) : 0,
                promo_price: body.promo_price ? Number(body.promo_price) : null,
                tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
                sku: body.sku || null,
                barcode: body.barcode || null,
                description: body.description || null,
                active,
                image_url: imageUrl,
                image_crop_position: resolvedCropPos,
                crop_x: cropX,
                crop_y: cropY,
                image_position_x: cropX,
                image_position_y: cropY,
                image_zoom: resolvedZoom,
                zoom: resolvedZoom,
                image_rotation: resolvedRotation,
                rotation: resolvedRotation,
                image_aspect_ratio: resolvedAspectRatio,
                has_variants: hasVariants,
                has_recipe: hasRecipe,
              });
            } catch {
              // relational menu_items fallback
            }

            // Save Recipe / BOM if provided
            if (Array.isArray(body.recipe_items) && body.recipe_items.length > 0) {
              const recipeObj = {
                menu_item_id: targetItemId,
                name: `Resep ${name}`,
                yield_portions: 1,
                items: body.recipe_items,
                updated_at: new Date().toISOString(),
              };

              // Persist into outlets.settings.menu_recipes
              const { data: outlets } = await supabaseAdmin
                .from("outlets")
                .select("id, settings")
                .in("business_id", allBusinessIds);

              for (const o of outlets || []) {
                const cur = (o.settings as any) || {};
                const menuRecipes = cur.menu_recipes || {};
                menuRecipes[targetItemId] = recipeObj;

                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...cur, menu_recipes: menuRecipes },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }

              // Also persist to relational menu_recipes and standalone recipes + recipe_items tables
              try {
                const { data: recData } = await supabaseAdmin
                  .from("menu_recipes" as any)
                  .insert({
                    business_id: businessId,
                    menu_item_id: targetItemId,
                    product_id: targetItemId,
                    name: `Resep ${name}`,
                    yield_portions: 1,
                    total_cost: costPrice,
                    cost_per_portion: costPrice,
                  })
                  .select("id")
                  .single();

                let recipeRowId = (recData as any)?.id;
                try {
                  const { data: standaloneRec } = await supabaseAdmin
                    .from("recipes" as any)
                    .insert({
                      business_id: businessId,
                      product_id: targetItemId,
                      menu_item_id: targetItemId,
                      name: `Resep ${name}`,
                      yield_portions: 1,
                      total_cost: costPrice,
                      cost_per_portion: costPrice,
                    })
                    .select("id")
                    .single();
                  if ((standaloneRec as any)?.id) {
                    recipeRowId = (standaloneRec as any).id;
                  }
                } catch {
                  // recipes table fallback
                }

                if (recipeRowId) {
                  const recItemsToInsert = body.recipe_items.map((r: any) => ({
                    recipe_id: recipeRowId,
                    inventory_item_id: r.inventory_item_id || null,
                    ingredient_id: r.ingredient_id || r.inventory_item_id || null,
                    ingredient_name: r.ingredient_name || "",
                    quantity: Number(r.quantity) || 1,
                    unit: r.unit || "gram",
                    cost_estimate: Number(r.cost_estimate) || 0,
                    cost_per_unit:
                      Number(r.cost_estimate) && Number(r.quantity)
                        ? Number(r.cost_estimate) / Number(r.quantity)
                        : 0,
                  }));
                  await supabaseAdmin.from("recipe_items" as any).insert(recItemsToInsert);
                }
              } catch (recInsertErr) {
                console.warn("[api/menu] Relational menu_recipes insert warning:", recInsertErr);
              }
            }

            // Save Variants & Modifiers Customization (including variant_groups & photo transform!)
            const customizationObj = {
              menu_item_id: targetItemId,
              variant_groups: variantGroupsInput,
              variants:
                Array.isArray(body.variants) && body.variants.length > 0
                  ? body.variants
                  : variantGroupsInput[0]?.options || [],
              modifiers: Array.isArray(body.modifiers) ? body.modifiers : [],
              addons: Array.isArray(body.addons) ? body.addons : [],
              image_crop_position: body.image_crop_position || null,
              image_zoom: Number(body.image_zoom) || 1.0,
              image_rotation: Number(body.image_rotation) || 0,
              image_aspect_ratio: body.image_aspect_ratio || "1:1",
              promo_price: body.promo_price ? Number(body.promo_price) : null,
              tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
              cost_price: costPrice,
              updated_at: new Date().toISOString(),
            };

            // Save to relational tables menu_variant_groups & menu_variant_options
            try {
              for (let gIdx = 0; gIdx < variantGroupsInput.length; gIdx++) {
                const grp = variantGroupsInput[gIdx];
                const { data: insertedGroup, error: grpErr } = await supabaseAdmin
                  .from("menu_variant_groups" as any)
                  .insert({
                    business_id: businessId,
                    menu_item_id: targetItemId,
                    product_id: targetItemId,
                    name: grp.name || `Grup ${gIdx + 1}`,
                    selection_type: grp.selection_type || "single",
                    is_required: grp.is_required || false,
                    sort_order: typeof grp.sort_order === "number" ? grp.sort_order : gIdx,
                    active: true,
                  })
                  .select("id")
                  .single();

                if (!grpErr && insertedGroup && Array.isArray(grp.options)) {
                  const optionsToInsert = grp.options.map((opt: any, oIdx: number) => ({
                    group_id: (insertedGroup as any).id,
                    name: opt.name || `Pilihan ${oIdx + 1}`,
                    additional_price: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                    price_adjustment: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                    selling_price: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                    cost_price: Number(opt.cost_price) || 0,
                    is_default: opt.is_default || false,
                    sort_order: typeof opt.sort_order === "number" ? opt.sort_order : oIdx,
                    active: true,
                  }));
                  if (optionsToInsert.length > 0) {
                    await supabaseAdmin.from("menu_variant_options" as any).insert(optionsToInsert);
                  }
                }
              }
            } catch (vgInsertErr) {
              console.warn("[api/menu] menu_variant_groups insert warning:", vgInsertErr);
            }

            const { data: outletsForCust } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .in("business_id", allBusinessIds);

            for (const o of outletsForCust || []) {
              const cur = (o.settings as any) || {};
              const menuCustomizations = cur.menu_customizations || {};
              menuCustomizations[targetItemId] = customizationObj;

              await supabaseAdmin
                .from("outlets")
                .update({
                  settings: { ...cur, menu_customizations: menuCustomizations },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", o.id);
            }

            // Save Outlet Assignments if provided
            if (Array.isArray(body.outlets) && body.outlets.length > 0) {
              for (const oa of body.outlets) {
                // Try relational outlet_menu_items table
                try {
                  await supabaseAdmin.from("outlet_menu_items" as any).upsert(
                    {
                      outlet_id: oa.outlet_id,
                      menu_item_id: targetItemId,
                      product_id: targetItemId,
                      available: oa.available !== false,
                      selling_price: oa.selling_price || null,
                      cost_price: costPrice || null,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "outlet_id, menu_item_id" },
                  );
                } catch {
                  // relational fallback
                }

                const { data: oData } = await supabaseAdmin
                  .from("outlets")
                  .select("id, settings")
                  .eq("id", oa.outlet_id)
                  .maybeSingle();

                if (oData) {
                  const cur = (oData.settings as any) || {};
                  const assignments = cur.outlet_menu_assignments || {};
                  assignments[targetItemId] = {
                    available: oa.available !== false,
                    selling_price: oa.selling_price || null,
                  };

                  await supabaseAdmin
                    .from("outlets")
                    .update({
                      settings: { ...cur, outlet_menu_assignments: assignments },
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", oa.outlet_id);
                }
              }
            }

            console.log("DATABASE RESPONSE: Menu item created with photo & recipe:", {
              id: targetItemId,
              name,
              image_url: imageUrl,
            });

            return Response.json({
              success: true,
              data: {
                id: targetItemId,
                business_id: businessId,
                name,
                category_name: categoryName,
                price,
                cost_price: costPrice,
                image_url: imageUrl,
                active,
              },
            });
          }

          // 5. UPDATE MENU ITEM
          if (action === "update-item") {
            const id = body.id;
            if (!id) return Response.json({ error: "Item ID required" }, { status: 400 });

            const name = body.name?.trim();
            const price = Number(body.price) || 0;
            const categoryName = body.category_name?.trim() || "";
            const imageUrl = body.image_url;
            const active = body.active !== false;

            const cropX =
              body.image_position_x !== undefined
                ? Number(body.image_position_x)
                : body.crop_x !== undefined
                  ? Number(body.crop_x)
                  : (body.image_crop_position?.x ?? 50);
            const cropY =
              body.image_position_y !== undefined
                ? Number(body.image_position_y)
                : body.crop_y !== undefined
                  ? Number(body.crop_y)
                  : (body.image_crop_position?.y ?? 50);
            const resolvedCropPos = {
              x: cropX,
              y: cropY,
              crop_x: cropX,
              crop_y: cropY,
              image_position_x: cropX,
              image_position_y: cropY,
            };
            const resolvedZoom = Number(body.image_zoom ?? body.zoom) || 1.0;
            const resolvedRotation = Number(body.image_rotation ?? body.rotation) || 0;
            const resolvedAspectRatio = "1:1";

            const variantGroupsInput = Array.isArray(body.variant_groups)
              ? body.variant_groups
              : [];
            const hasVariants =
              variantGroupsInput.length > 0 ||
              (Array.isArray(body.variants) && body.variants.length > 0);
            const hasRecipe = Array.isArray(body.recipe_items) && body.recipe_items.length > 0;

            const resolvedCatId = await resolveValidCategoryId(
              body.category_id,
              categoryName,
              allBusinessIds,
            );

            // Update in products table
            const updatePayload: any = {
              name,
              category: categoryName,
              category_id: resolvedCatId,
              description: body.description || null,
              sku: body.sku || null,
              barcode: body.barcode || null,
              price,
              selling_price: price,
              cost_price: body.cost_price ? Number(body.cost_price) : 0,
              promo_price: body.promo_price ? Number(body.promo_price) : null,
              tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
              image_url: imageUrl,
              image_crop_position: resolvedCropPos,
              crop_x: cropX,
              crop_y: cropY,
              image_position_x: cropX,
              image_position_y: cropY,
              image_zoom: resolvedZoom,
              zoom: resolvedZoom,
              image_rotation: resolvedRotation,
              rotation: resolvedRotation,
              image_aspect_ratio: resolvedAspectRatio,
              has_variants: hasVariants,
              has_recipe: hasRecipe,
              active,
              updated_at: new Date().toISOString(),
            };

            const updRes = await supabaseAdmin.from("products").update(updatePayload).eq("id", id);

            if (
              updRes.error &&
              (updRes.error.message?.includes("cost_price") ||
                (updRes.error as any).details?.includes("cost_price") ||
                updRes.error.message?.includes("column"))
            ) {
              console.warn(
                "[api/menu] cost_price column missing in schema cache, retrying update without cost_price",
              );
              const safeBasePayload = {
                name,
                category: categoryName,
                price,
                active,
                image_url: imageUrl,
                updated_at: new Date().toISOString(),
              };
              await supabaseAdmin.from("products").update(safeBasePayload).eq("id", id);
            }

            // Also update in menu_items table if present
            try {
              await supabaseAdmin
                .from("menu_items" as any)
                .update({
                  name,
                  category_id: resolvedCatId,
                  category: categoryName,
                  price,
                  selling_price: price,
                  cost_price: body.cost_price ? Number(body.cost_price) : 0,
                  promo_price: body.promo_price ? Number(body.promo_price) : null,
                  tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
                  image_url: imageUrl,
                  image_crop_position: resolvedCropPos,
                  crop_x: cropX,
                  crop_y: cropY,
                  image_position_x: cropX,
                  image_position_y: cropY,
                  image_zoom: resolvedZoom,
                  zoom: resolvedZoom,
                  image_rotation: resolvedRotation,
                  rotation: resolvedRotation,
                  image_aspect_ratio: resolvedAspectRatio,
                  description: body.description || null,
                  sku: body.sku || null,
                  barcode: body.barcode || null,
                  has_variants: hasVariants,
                  has_recipe: hasRecipe,
                  active,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            } catch {
              // fallback if menu_items table is not active
            }

            // Update Recipe / BOM if provided
            if (Array.isArray(body.recipe_items)) {
              const recipeObj = {
                menu_item_id: id,
                name: `Resep ${name}`,
                yield_portions: 1,
                items: body.recipe_items,
                updated_at: new Date().toISOString(),
              };

              const { data: outlets } = await supabaseAdmin
                .from("outlets")
                .select("id, settings")
                .in("business_id", allBusinessIds);

              for (const o of outlets || []) {
                const cur = (o.settings as any) || {};
                const menuRecipes = cur.menu_recipes || {};
                menuRecipes[id] = recipeObj;

                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...cur, menu_recipes: menuRecipes },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }

              // Also sync to relational menu_recipes, standalone recipes, and recipe_items tables
              try {
                const { data: existingRecs } = await supabaseAdmin
                  .from("menu_recipes" as any)
                  .select("id")
                  .or(`menu_item_id.eq.${id},product_id.eq.${id}`);

                if (existingRecs && existingRecs.length > 0) {
                  for (const er of existingRecs as any[]) {
                    await supabaseAdmin
                      .from("recipe_items" as any)
                      .delete()
                      .eq("recipe_id", er.id);
                  }
                  await supabaseAdmin
                    .from("menu_recipes" as any)
                    .delete()
                    .or(`menu_item_id.eq.${id},product_id.eq.${id}`);
                }

                try {
                  const { data: existingStandaloneRecs } = await supabaseAdmin
                    .from("recipes" as any)
                    .select("id")
                    .or(`menu_item_id.eq.${id},product_id.eq.${id}`);
                  if (existingStandaloneRecs && existingStandaloneRecs.length > 0) {
                    for (const er of existingStandaloneRecs as any[]) {
                      await supabaseAdmin
                        .from("recipe_items" as any)
                        .delete()
                        .eq("recipe_id", er.id);
                    }
                    await supabaseAdmin
                      .from("recipes" as any)
                      .delete()
                      .or(`menu_item_id.eq.${id},product_id.eq.${id}`);
                  }
                } catch {
                  // ignore
                }

                if (body.recipe_items.length > 0) {
                  const { data: recData } = await supabaseAdmin
                    .from("menu_recipes" as any)
                    .insert({
                      business_id: businessId,
                      menu_item_id: id,
                      product_id: id,
                      name: `Resep ${name}`,
                      yield_portions: 1,
                      total_cost: Number(body.cost_price) || 0,
                      cost_per_portion: Number(body.cost_price) || 0,
                    })
                    .select("id")
                    .single();

                  let recipeRowId = (recData as any)?.id;
                  try {
                    const { data: standaloneRec } = await supabaseAdmin
                      .from("recipes" as any)
                      .insert({
                        business_id: businessId,
                        product_id: id,
                        menu_item_id: id,
                        name: `Resep ${name}`,
                        yield_portions: 1,
                        total_cost: Number(body.cost_price) || 0,
                        cost_per_portion: Number(body.cost_price) || 0,
                      })
                      .select("id")
                      .single();
                    if ((standaloneRec as any)?.id) {
                      recipeRowId = (standaloneRec as any).id;
                    }
                  } catch {
                    // recipes fallback
                  }

                  if (recipeRowId) {
                    const recItemsToInsert = body.recipe_items.map((r: any) => ({
                      recipe_id: recipeRowId,
                      inventory_item_id: r.inventory_item_id || null,
                      ingredient_id: r.ingredient_id || r.inventory_item_id || null,
                      ingredient_name: r.ingredient_name || "",
                      quantity: Number(r.quantity) || 1,
                      unit: r.unit || "gram",
                      cost_estimate: Number(r.cost_estimate) || 0,
                      cost_per_unit:
                        Number(r.cost_estimate) && Number(r.quantity)
                          ? Number(r.cost_estimate) / Number(r.quantity)
                          : 0,
                    }));
                    await supabaseAdmin.from("recipe_items" as any).insert(recItemsToInsert);
                  }
                }
              } catch (recUpdErr) {
                console.warn("[api/menu] update relational menu_recipes warning:", recUpdErr);
              }
            }

            // Update Variants & Modifiers Customization if provided
            if (
              Array.isArray(body.variants) ||
              Array.isArray(body.modifiers) ||
              Array.isArray(body.addons) ||
              Array.isArray(body.variant_groups) ||
              body.image_crop_position !== undefined ||
              body.promo_price !== undefined
            ) {
              const customizationObj = {
                menu_item_id: id,
                variant_groups: variantGroupsInput,
                variants:
                  Array.isArray(body.variants) && body.variants.length > 0
                    ? body.variants
                    : variantGroupsInput[0]?.options || [],
                modifiers: Array.isArray(body.modifiers) ? body.modifiers : [],
                addons: Array.isArray(body.addons) ? body.addons : [],
                image_crop_position: body.image_crop_position || null,
                image_zoom: Number(body.image_zoom) || 1.0,
                image_rotation: Number(body.image_rotation) || 0,
                image_aspect_ratio: body.image_aspect_ratio || "1:1",
                promo_price: body.promo_price ? Number(body.promo_price) : null,
                tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 0,
                cost_price: body.cost_price ? Number(body.cost_price) : 0,
                updated_at: new Date().toISOString(),
              };

              // Update relational tables menu_variant_groups & options
              if (Array.isArray(body.variant_groups)) {
                try {
                  await supabaseAdmin
                    .from("menu_variant_groups" as any)
                    .delete()
                    .eq("menu_item_id", id);
                  for (let gIdx = 0; gIdx < variantGroupsInput.length; gIdx++) {
                    const grp = variantGroupsInput[gIdx];
                    const { data: insertedGroup, error: grpErr } = await supabaseAdmin
                      .from("menu_variant_groups" as any)
                      .insert({
                        business_id: businessId,
                        menu_item_id: id,
                        product_id: id,
                        name: grp.name || `Grup ${gIdx + 1}`,
                        selection_type: grp.selection_type || "single",
                        is_required: grp.is_required || false,
                        sort_order: typeof grp.sort_order === "number" ? grp.sort_order : gIdx,
                        active: true,
                      })
                      .select("id")
                      .single();

                    if (!grpErr && insertedGroup && Array.isArray(grp.options)) {
                      const optionsToInsert = grp.options.map((opt: any, oIdx: number) => ({
                        group_id: (insertedGroup as any).id,
                        name: opt.name || `Pilihan ${oIdx + 1}`,
                        additional_price: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                        price_adjustment: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                        selling_price: Number(opt.additional_price ?? opt.price_adjustment) || 0,
                        cost_price: Number(opt.cost_price) || 0,
                        is_default: opt.is_default || false,
                        sort_order: typeof opt.sort_order === "number" ? opt.sort_order : oIdx,
                        active: true,
                      }));
                      if (optionsToInsert.length > 0) {
                        await supabaseAdmin
                          .from("menu_variant_options" as any)
                          .insert(optionsToInsert);
                      }
                    }
                  }
                } catch (vgUpdErr) {
                  console.warn("[api/menu] update menu_variant_groups warning:", vgUpdErr);
                }
              }

              const { data: outletsForCust } = await supabaseAdmin
                .from("outlets")
                .select("id, settings")
                .in("business_id", allBusinessIds);

              for (const o of outletsForCust || []) {
                const cur = (o.settings as any) || {};
                const menuCustomizations = cur.menu_customizations || {};
                menuCustomizations[id] = customizationObj;

                await supabaseAdmin
                  .from("outlets")
                  .update({
                    settings: { ...cur, menu_customizations: menuCustomizations },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", o.id);
              }
            }

            // Update Outlet assignments if provided
            if (Array.isArray(body.outlets)) {
              for (const oa of body.outlets) {
                // Upsert to relational outlet_menu_items table
                try {
                  await supabaseAdmin.from("outlet_menu_items" as any).upsert(
                    {
                      outlet_id: oa.outlet_id,
                      menu_item_id: id,
                      product_id: id,
                      available: oa.available !== false,
                      selling_price: oa.selling_price || null,
                      cost_price: body.cost_price ? Number(body.cost_price) : null,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "outlet_id, menu_item_id" },
                  );
                } catch {
                  // relational fallback
                }

                const { data: oData } = await supabaseAdmin
                  .from("outlets")
                  .select("id, settings")
                  .eq("id", oa.outlet_id)
                  .maybeSingle();

                if (oData) {
                  const cur = (oData.settings as any) || {};
                  const assignments = cur.outlet_menu_assignments || {};
                  assignments[id] = {
                    available: oa.available !== false,
                    selling_price: oa.selling_price || null,
                  };

                  await supabaseAdmin
                    .from("outlets")
                    .update({
                      settings: { ...cur, outlet_menu_assignments: assignments },
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", oa.outlet_id);
                }
              }
            }

            return Response.json({
              success: true,
              data: { id, name, price, image_url: imageUrl, active },
            });
          }

          // 6. DELETE MENU ITEM (Cascade child entities first)
          if (action === "delete-item") {
            const id = body.id;
            if (!id) return Response.json({ error: "Item ID required" }, { status: 400 });

            // Fetch target item details for duplicate cleanup
            let targetName: string | null = null;
            let targetBusinessId: string | null = null;
            try {
              const { data: itm } = await supabaseAdmin
                .from("products")
                .select("name, business_id")
                .eq("id", id)
                .maybeSingle();
              if (itm) {
                targetName = itm.name;
                targetBusinessId = itm.business_id;
              }
            } catch {}

            // A. Clean up child recipe_items and recipes first
            try {
              const { data: recs } = await supabaseAdmin
                .from("recipes" as any)
                .select("id")
                .eq("menu_item_id", id);
              const { data: menuRecs } = await supabaseAdmin
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
                await supabaseAdmin
                  .from("recipe_items" as any)
                  .delete()
                  .in("recipe_id", recipeIds);
              }

              try {
                await supabaseAdmin
                  .from("recipe_items" as any)
                  .delete()
                  .eq("product_id", id);
              } catch {}

              await supabaseAdmin
                .from("recipes" as any)
                .delete()
                .eq("menu_item_id", id);

              await supabaseAdmin
                .from("menu_recipes" as any)
                .delete()
                .eq("menu_item_id", id);

              try {
                await supabaseAdmin
                  .from("product_recipes" as any)
                  .delete()
                  .eq("product_id", id);
              } catch {}
            } catch (err) {
              console.warn("[api/menu] Recipe cascade cleanup warning:", err);
            }

            // B. Clean up variant options and groups
            try {
              const { data: vGroups } = await supabaseAdmin
                .from("menu_variant_groups" as any)
                .select("id")
                .eq("menu_item_id", id);

              const groupIds = ((vGroups || []) as any[]).map((g) => g.id);
              if (groupIds.length > 0) {
                await supabaseAdmin
                  .from("menu_variant_options" as any)
                  .delete()
                  .in("group_id", groupIds);
              }

              await supabaseAdmin
                .from("menu_variant_groups" as any)
                .delete()
                .eq("menu_item_id", id);

              try {
                await supabaseAdmin
                  .from("product_variants" as any)
                  .delete()
                  .eq("product_id", id);
              } catch {}
            } catch (err) {
              console.warn("[api/menu] Variants cascade cleanup warning:", err);
            }

            // C. Clean up outlet assignments
            try {
              await supabaseAdmin
                .from("outlet_menu_items" as any)
                .delete()
                .eq("menu_item_id", id);
              await supabaseAdmin
                .from("outlet_assignments" as any)
                .delete()
                .eq("menu_item_id", id);
            } catch (err) {
              console.warn("[api/menu] Outlet assignments cleanup warning:", err);
            }

            // D. Clean up duplicates with same name
            if (targetName && targetBusinessId) {
              try {
                await supabaseAdmin
                  .from("products")
                  .delete()
                  .eq("business_id", targetBusinessId)
                  .eq("name", targetName)
                  .neq("id", id);
                await supabaseAdmin
                  .from("menu_items" as any)
                  .delete()
                  .eq("business_id", targetBusinessId)
                  .eq("name", targetName)
                  .neq("id", id);
              } catch {}
            }

            // E. Clean up from outlets.settings
            try {
              const { data: outlets } = await supabaseAdmin
                .from("outlets")
                .select("id, settings")
                .in("business_id", allBusinessIds);

              for (const o of outlets || []) {
                const cur = (o.settings as any) || {};
                let changed = false;
                if (cur.menu_recipes && cur.menu_recipes[id]) {
                  delete cur.menu_recipes[id];
                  changed = true;
                }
                if (cur.menu_customizations && cur.menu_customizations[id]) {
                  delete cur.menu_customizations[id];
                  changed = true;
                }
                if (cur.outlet_menu_assignments && cur.outlet_menu_assignments[id]) {
                  delete cur.outlet_menu_assignments[id];
                  changed = true;
                }
                if (changed) {
                  await supabaseAdmin
                    .from("outlets")
                    .update({ settings: cur, updated_at: new Date().toISOString() })
                    .eq("id", o.id);
                }
              }
            } catch (err) {
              console.warn("[api/menu] Outlets settings cleanup warning:", err);
            }

            // E. Delete from menu_items table
            try {
              await supabaseAdmin.from("menu_items" as any).delete().eq("id", id);
            } catch (err) {
              console.warn("[api/menu] menu_items delete warning:", err);
            }

            // F. Delete from products table
            const { error: delErr } = await supabaseAdmin.from("products").delete().eq("id", id);
            if (delErr) {
              console.warn(
                "[api/menu] Hard delete blocked by sales history foreign key, setting active: false:",
                delErr.message,
              );
              await supabaseAdmin
                .from("products")
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq("id", id);

              try {
                await supabaseAdmin
                  .from("menu_items" as any)
                  .update({ active: false, updated_at: new Date().toISOString() })
                  .eq("id", id);
              } catch {}
            }

            return Response.json({ success: true });
          }

          // 7. TOGGLE ACTIVE STATUS
          if (action === "toggle-status") {
            const id = body.id;
            const active = Boolean(body.active);
            await supabaseAdmin
              .from("products")
              .update({ active, updated_at: new Date().toISOString() })
              .eq("id", id);
            return Response.json({ success: true, active });
          }

          // 8. QUICK ASSIGN OUTLET
          if (action === "assign-outlet") {
            const menuItemId = body.menu_item_id;
            const outletId = body.outlet_id;
            const available = body.available !== false;
            const sellingPrice = body.selling_price ? Number(body.selling_price) : null;

            const { data: oData } = await supabaseAdmin
              .from("outlets")
              .select("id, settings")
              .eq("id", outletId)
              .maybeSingle();

            if (oData) {
              const cur = (oData.settings as any) || {};
              const assignments = cur.outlet_menu_assignments || {};
              assignments[menuItemId] = { available, selling_price: sellingPrice };

              await supabaseAdmin
                .from("outlets")
                .update({
                  settings: { ...cur, outlet_menu_assignments: assignments },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", outletId);
            }

            return Response.json({ success: true });
          }

          return Response.json({ error: "Action tidak dikenali" }, { status: 400 });
        } catch (err) {
          console.error("[api/menu] POST error:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Internal error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
