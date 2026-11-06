-- Migration: Recipe / BOM (Bill of Materials) Foundation
-- Links Menu Items to Inventory Items for automated ingredient depletion

-- 1. Table: menu_recipes
CREATE TABLE IF NOT EXISTS public.menu_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  name text NOT NULL,
  yield_portions int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_recipes_business_id ON public.menu_recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_recipes_menu_item_id ON public.menu_recipes(menu_item_id);

-- 2. Table: recipe_items (Ingredients breakdown)
CREATE TABLE IF NOT EXISTS public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.menu_recipes(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1.000,
  unit text NOT NULL DEFAULT 'gram',
  cost_estimate numeric(12,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_inventory_item_id ON public.recipe_items(inventory_item_id);

-- 3. Enable RLS
ALTER TABLE public.menu_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Business members can view menu_recipes" ON public.menu_recipes;
CREATE POLICY "Business members can view menu_recipes"
ON public.menu_recipes FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Business owner and admin can manage menu_recipes" ON public.menu_recipes;
CREATE POLICY "Business owner and admin can manage menu_recipes"
ON public.menu_recipes FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Business members can view recipe_items" ON public.recipe_items;
CREATE POLICY "Business members can view recipe_items"
ON public.recipe_items FOR SELECT
TO authenticated
USING (
  recipe_id IN (
    SELECT id FROM public.menu_recipes WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Business owner and admin can manage recipe_items" ON public.recipe_items;
CREATE POLICY "Business owner and admin can manage recipe_items"
ON public.recipe_items FOR ALL
TO authenticated
USING (
  recipe_id IN (
    SELECT id FROM public.menu_recipes WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);
