-- Migration: Menu Management Foundation
-- Creates menu_categories, menu_items, menu_modifiers, outlet_menu_items
-- Adds RLS policies and RBAC permissions for Menu Management

-- 1. Table: menu_categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_business_id ON public.menu_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON public.menu_categories(active);

-- 2. Table: menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) DEFAULT 0,
  sku text,
  barcode text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON public.menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON public.menu_items(active);

-- 3. Table: menu_modifiers
CREATE TABLE IF NOT EXISTS public.menu_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_adjustment numeric(12,2) NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_modifiers_menu_item_id ON public.menu_modifiers(menu_item_id);

-- 4. Table: outlet_menu_items (Outlet availability and custom price override)
CREATE TABLE IF NOT EXISTS public.outlet_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  available boolean DEFAULT true,
  selling_price numeric(12,2) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_menu_items_outlet_id ON public.outlet_menu_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_menu_items_menu_item_id ON public.outlet_menu_items(menu_item_id);

-- 5. Enable RLS
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_menu_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for menu_categories
DROP POLICY IF EXISTS "Business members can view menu_categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Business owner and admin can manage menu_categories" ON public.menu_categories;

CREATE POLICY "Business members can view menu_categories"
ON public.menu_categories FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Business owner and admin can manage menu_categories"
ON public.menu_categories FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- 7. RLS Policies for menu_items
DROP POLICY IF EXISTS "Business members can view menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Business owner and admin can manage menu_items" ON public.menu_items;

CREATE POLICY "Business members can view menu_items"
ON public.menu_items FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Business owner and admin can manage menu_items"
ON public.menu_items FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- 8. RLS Policies for menu_modifiers
DROP POLICY IF EXISTS "Business members can view menu_modifiers" ON public.menu_modifiers;
DROP POLICY IF EXISTS "Business owner and admin can manage menu_modifiers" ON public.menu_modifiers;

CREATE POLICY "Business members can view menu_modifiers"
ON public.menu_modifiers FOR SELECT
TO authenticated
USING (
  menu_item_id IN (
    SELECT id FROM public.menu_items WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Business owner and admin can manage menu_modifiers"
ON public.menu_modifiers FOR ALL
TO authenticated
USING (
  menu_item_id IN (
    SELECT id FROM public.menu_items WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
)
WITH CHECK (
  menu_item_id IN (
    SELECT id FROM public.menu_items WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

-- 9. RLS Policies for outlet_menu_items
DROP POLICY IF EXISTS "Business members can view outlet_menu_items" ON public.outlet_menu_items;
DROP POLICY IF EXISTS "Business owner and admin can manage outlet_menu_items" ON public.outlet_menu_items;

CREATE POLICY "Business members can view outlet_menu_items"
ON public.outlet_menu_items FOR SELECT
TO authenticated
USING (
  outlet_id IN (
    SELECT id FROM public.outlets WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Business owner and admin can manage outlet_menu_items"
ON public.outlet_menu_items FOR ALL
TO authenticated
USING (
  outlet_id IN (
    SELECT id FROM public.outlets WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
)
WITH CHECK (
  outlet_id IN (
    SELECT id FROM public.outlets WHERE business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

-- 10. Register Menu Permissions
INSERT INTO public.permissions (code, description) VALUES
('menu.view', 'View menu and categories'),
('menu.create', 'Create menu items and categories'),
('menu.edit', 'Edit menu items and categories'),
('menu.delete', 'Delete menu items and categories')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to owner and admin
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'owner'::public.app_role, p.id FROM public.permissions p WHERE p.code IN ('menu.view', 'menu.create', 'menu.edit', 'menu.delete')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id FROM public.permissions p WHERE p.code IN ('menu.view', 'menu.create', 'menu.edit', 'menu.delete')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, p.id FROM public.permissions p WHERE p.code IN ('menu.view', 'menu.edit')
ON CONFLICT (role, permission_id) DO NOTHING;
