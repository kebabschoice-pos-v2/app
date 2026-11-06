-- Migration: Menu Variant Groups and Options Architecture
-- Relational Schema:
-- menu_items (products)
--     |
-- menu_variant_groups
--     |
-- menu_variant_options

-- 1. Table: menu_variant_groups
CREATE TABLE IF NOT EXISTS public.menu_variant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  name text NOT NULL, -- e.g. "Ukuran", "Level Pedas", "Packaging", "Pilihan Saus"
  selection_type text NOT NULL DEFAULT 'single', -- 'single' (Radio) | 'multiple' (Checkbox)
  is_required boolean DEFAULT false,
  min_selection int DEFAULT 0,
  max_selection int DEFAULT 1,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_item ON public.menu_variant_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_business ON public.menu_variant_groups(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_groups_active ON public.menu_variant_groups(active);

-- 2. Table: menu_variant_options
CREATE TABLE IF NOT EXISTS public.menu_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.menu_variant_groups(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g. "Small", "Medium", "Large", "Pedas", "Dine In"
  additional_price numeric(12,2) NOT NULL DEFAULT 0, -- e.g. 0, 3000, 5000
  is_default boolean DEFAULT false,
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_variant_options_group ON public.menu_variant_options(group_id);
CREATE INDEX IF NOT EXISTS idx_menu_variant_options_active ON public.menu_variant_options(active);

-- 3. Enable Row Level Security
ALTER TABLE public.menu_variant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_variant_options ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Public and authenticated read for menu_variant_groups" ON public.menu_variant_groups;
DROP POLICY IF EXISTS "Manage menu_variant_groups for authenticated" ON public.menu_variant_groups;

CREATE POLICY "Public and authenticated read for menu_variant_groups"
  ON public.menu_variant_groups FOR SELECT
  USING (true);

CREATE POLICY "Manage menu_variant_groups for authenticated"
  ON public.menu_variant_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public and authenticated read for menu_variant_options" ON public.menu_variant_options;
DROP POLICY IF EXISTS "Manage menu_variant_options for authenticated" ON public.menu_variant_options;

CREATE POLICY "Public and authenticated read for menu_variant_options"
  ON public.menu_variant_options FOR SELECT
  USING (true);

CREATE POLICY "Manage menu_variant_options for authenticated"
  ON public.menu_variant_options FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
