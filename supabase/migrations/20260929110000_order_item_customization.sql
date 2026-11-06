-- Migration: Add product customization fields to sales_order_items
-- Supports Variants, Modifiers, Add-ons, and customer notes for POS transactions

ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS variant_name text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS selected_options jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS final_price numeric(12,2);

-- Index for searching orders with customized options
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON public.sales_order_items(product_id);
