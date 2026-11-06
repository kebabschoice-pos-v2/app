-- Migration: Stock Movements and POS Outlet Association Foundation
-- Enables automated recipe inventory tracking and outlet-specific sales

-- 1. Table: stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  movement_type text NOT NULL DEFAULT 'pos_sale',
  quantity numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  remaining_stock numeric(12,3) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id ON public.stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item ON public.stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- 2. Add outlet_id column to sales_orders if not already present
ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_outlet_id ON public.sales_orders(outlet_id);

-- 3. Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Business members can view stock_movements" ON public.stock_movements;
CREATE POLICY "Business members can view stock_movements"
ON public.stock_movements FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Business members can insert stock_movements" ON public.stock_movements;
CREATE POLICY "Business members can insert stock_movements"
ON public.stock_movements FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    UNION
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);
