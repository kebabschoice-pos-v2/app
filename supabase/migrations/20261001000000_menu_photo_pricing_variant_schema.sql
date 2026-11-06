-- Migration: Menu Photo Editing, Pricing & Profit, and Variant Groups Schema Enhancements
-- Adds photo transformation metadata (crop, zoom, rotation, aspect ratio)
-- Adds promo price, tax rate for profit calculation

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS image_crop_position jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS image_rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS promo_price numeric(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_crop_position jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_zoom numeric(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS image_rotation numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS promo_price numeric(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0;

-- Ensure menu_variant_groups has sort_order and selection_type
ALTER TABLE public.menu_variant_groups
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selection_type text NOT NULL DEFAULT 'single';

-- Ensure menu_variant_options has sort_order and additional_price
ALTER TABLE public.menu_variant_options
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_price numeric(12, 2) NOT NULL DEFAULT 0;
