-- Migration: Add cost_price column to products and ensure menu_items has cost_price
-- Fixes schema cache mismatch: "Could not find the 'cost_price' column of 'products' in the schema cache"
-- Ensures consistent HPP (cost price) tracking across frontend, backend API, and database.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2) NOT NULL DEFAULT 0;

-- Optional index for performance on cost calculations
CREATE INDEX IF NOT EXISTS idx_products_cost_price ON public.products(cost_price);
CREATE INDEX IF NOT EXISTS idx_menu_items_cost_price ON public.menu_items(cost_price);
