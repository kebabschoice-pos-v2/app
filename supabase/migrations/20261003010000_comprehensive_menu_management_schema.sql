-- Migration: Comprehensive Menu Management Schema Synchronization
-- Covers: products, menu_items, menu_categories, menu_variant_groups, menu_variant_options,
--         menu_recipes, recipes, recipe_items, inventory_items, ingredients, outlet_menu_items
-- Ensures all frontend fields for image framing, pricing (cost_price, selling_price),
-- variant groups/options, and BOM recipes/HPP calculation are fully supported across all tables.

-- 1. Table: menu_categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order int DEFAULT 0,
  is_system boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_categories_business_id ON public.menu_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON public.menu_categories(active);

-- 2. Table: products (POS catalog & unified product entity)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_price numeric(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_crop_position jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  ADD COLUMN IF NOT EXISTS crop_x numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS crop_y numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_x numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS image_rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_recipe boolean DEFAULT false;

-- Sync selling_price with price if selling_price is 0
UPDATE public.products SET selling_price = price WHERE (selling_price IS NULL OR selling_price = 0) AND price > 0;

CREATE INDEX IF NOT EXISTS idx_products_cost_price ON public.products(cost_price);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON public.products(selling_price);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 3. Table: menu_items (HQ Menu Management relational catalog)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Makanan',
  name text NOT NULL,
  description text,
  image_url text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  promo_price numeric(12, 2) DEFAULT NULL,
  tax_rate numeric(5, 2) DEFAULT 0,
  sku text,
  barcode text,
  stock numeric(12, 2) DEFAULT 999,
  image_crop_position jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  crop_x numeric(5, 2) DEFAULT 50,
  crop_y numeric(5, 2) DEFAULT 50,
  image_position_x numeric(5, 2) DEFAULT 50,
  image_position_y numeric(5, 2) DEFAULT 50,
  image_zoom numeric(5, 2) DEFAULT 1.0,
  zoom numeric(5, 2) DEFAULT 1.0,
  image_rotation numeric(5, 2) DEFAULT 0,
  rotation numeric(5, 2) DEFAULT 0,
  image_aspect_ratio text DEFAULT '1:1',
  has_variants boolean DEFAULT false,
  has_recipe boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Makanan',
  ADD COLUMN IF NOT EXISTS selling_price numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_price numeric(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock numeric(12, 2) DEFAULT 999,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS image_crop_position jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  ADD COLUMN IF NOT EXISTS crop_x numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS crop_y numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_x numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y numeric(5, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS image_rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_recipe boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON public.menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON public.menu_items(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_cost_price ON public.menu_items(cost_price);

-- 4. Table: menu_variant_groups
CREATE TABLE IF NOT EXISTS public.menu_variant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  menu_item_id uuid,
  name text NOT NULL,
  selection_type text NOT NULL DEFAULT 'single',
  is_required boolean DEFAULT false,
  min_selection int DEFAULT 0,
  max_selection int DEFAULT 1,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_variant_groups
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS menu_item_id uuid,
  ADD COLUMN IF NOT EXISTS selection_type text DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_selection int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_selection int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_item ON public.menu_variant_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_product ON public.menu_variant_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_business ON public.menu_variant_groups(business_id);

-- 5. Table: menu_variant_options
CREATE TABLE IF NOT EXISTS public.menu_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.menu_variant_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  additional_price numeric(12, 2) NOT NULL DEFAULT 0,
  price_adjustment numeric(12, 2) NOT NULL DEFAULT 0,
  selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  image_url text,
  sku text,
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_variant_options
  ADD COLUMN IF NOT EXISTS additional_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_adjustment numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_variant_options_group ON public.menu_variant_options(group_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_options_cost_price ON public.menu_variant_options(cost_price);

-- 6. Table: menu_recipes & recipes (BOM Recipes)
CREATE TABLE IF NOT EXISTS public.menu_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  product_id uuid,
  name text NOT NULL,
  yield_portions int NOT NULL DEFAULT 1,
  total_cost numeric(12, 2) DEFAULT 0,
  cost_per_portion numeric(12, 2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_recipes
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS total_cost numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_portion numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yield_portions int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_menu_recipes_item ON public.menu_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_recipes_product ON public.menu_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_recipes_business ON public.menu_recipes(business_id);

-- Standalone table: recipes (BOM Recipes)
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  menu_item_id uuid,
  name text NOT NULL,
  yield_portions int NOT NULL DEFAULT 1,
  total_cost numeric(12, 2) DEFAULT 0,
  cost_per_portion numeric(12, 2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS menu_item_id uuid,
  ADD COLUMN IF NOT EXISTS total_cost numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_portion numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yield_portions int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_recipes_product ON public.recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_business ON public.recipes(business_id);

-- 7. Table: ingredients (Standalone Master Ingredients)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Bahan Baku',
  unit text NOT NULL DEFAULT 'gram',
  stock numeric(12, 2) NOT NULL DEFAULT 0,
  minimum_stock numeric(12, 2) NOT NULL DEFAULT 0,
  cost_price numeric(14, 2) NOT NULL DEFAULT 0,
  selling_price numeric(14, 2) DEFAULT 0,
  supplier_id uuid,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS cost_price numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ingredients_business ON public.ingredients(business_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON public.ingredients(active);

-- 8. Table: recipe_items (Recipe ingredients breakdown linking recipes -> ingredients)
CREATE TABLE IF NOT EXISTS public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric(10, 3) NOT NULL DEFAULT 1.000,
  unit text NOT NULL DEFAULT 'gram',
  cost_estimate numeric(12, 2) DEFAULT 0,
  cost_per_unit numeric(12, 2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_items
  ADD COLUMN IF NOT EXISTS ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON public.recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_inv ON public.recipe_items(inventory_item_id);

-- 9. Table: inventory_items enhancements
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 9. Table: outlet_menu_items (Outlet assignments & overrides)
CREATE TABLE IF NOT EXISTS public.outlet_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  menu_item_id uuid,
  product_id uuid,
  available boolean DEFAULT true,
  selling_price numeric(12, 2) NULL,
  cost_price numeric(12, 2) NULL,
  stock numeric(12, 2) DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outlet_menu_items
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS stock numeric(12, 2) DEFAULT 999;

-- 10. Enable RLS and setup permissive policies
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_variant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read menu_categories" ON public.menu_categories;
CREATE POLICY "Public read menu_categories" ON public.menu_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage menu_categories" ON public.menu_categories;
CREATE POLICY "Manage menu_categories" ON public.menu_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage products" ON public.products;
CREATE POLICY "Manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
CREATE POLICY "Public read menu_items" ON public.menu_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage menu_items" ON public.menu_items;
CREATE POLICY "Manage menu_items" ON public.menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read menu_variant_groups" ON public.menu_variant_groups;
CREATE POLICY "Public read menu_variant_groups" ON public.menu_variant_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage menu_variant_groups" ON public.menu_variant_groups;
CREATE POLICY "Manage menu_variant_groups" ON public.menu_variant_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read menu_variant_options" ON public.menu_variant_options;
CREATE POLICY "Public read menu_variant_options" ON public.menu_variant_options FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage menu_variant_options" ON public.menu_variant_options;
CREATE POLICY "Manage menu_variant_options" ON public.menu_variant_options FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read menu_recipes" ON public.menu_recipes;
CREATE POLICY "Public read menu_recipes" ON public.menu_recipes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage menu_recipes" ON public.menu_recipes;
CREATE POLICY "Manage menu_recipes" ON public.menu_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read recipes" ON public.recipes;
CREATE POLICY "Public read recipes" ON public.recipes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage recipes" ON public.recipes;
CREATE POLICY "Manage recipes" ON public.recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read recipe_items" ON public.recipe_items;
CREATE POLICY "Public read recipe_items" ON public.recipe_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage recipe_items" ON public.recipe_items;
CREATE POLICY "Manage recipe_items" ON public.recipe_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read inventory_items" ON public.inventory_items;
CREATE POLICY "Public read inventory_items" ON public.inventory_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage inventory_items" ON public.inventory_items;
CREATE POLICY "Manage inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read ingredients" ON public.ingredients;
CREATE POLICY "Public read ingredients" ON public.ingredients FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage ingredients" ON public.ingredients;
CREATE POLICY "Manage ingredients" ON public.ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read outlet_menu_items" ON public.outlet_menu_items;
CREATE POLICY "Public read outlet_menu_items" ON public.outlet_menu_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage outlet_menu_items" ON public.outlet_menu_items;
CREATE POLICY "Manage outlet_menu_items" ON public.outlet_menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
