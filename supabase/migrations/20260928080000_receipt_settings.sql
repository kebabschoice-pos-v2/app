-- Migration: Receipt Settings Table & RLS Policies
-- Task: Create receipt_settings with business_id scoping and full CRUD RLS

CREATE TABLE IF NOT EXISTS public.receipt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
  store_name TEXT,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  receipt_header TEXT,
  receipt_footer TEXT,
  paper_size TEXT NOT NULL DEFAULT '58mm',
  show_business_name BOOLEAN NOT NULL DEFAULT true,
  show_address BOOLEAN NOT NULL DEFAULT true,
  show_phone BOOLEAN NOT NULL DEFAULT true,
  show_tax BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index ensuring one HQ default (outlet_id IS NULL) and one per branch outlet
CREATE UNIQUE INDEX IF NOT EXISTS receipt_settings_bus_outlet_uidx 
ON public.receipt_settings (business_id, COALESCE(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable Row Level Security
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if exist
DROP POLICY IF EXISTS "Members can view receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Admins and Owners can insert receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Admins and Owners can update receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Admins and Owners can delete receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Business members can select receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Owner and Admin can insert receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Owner and Admin can update receipt settings" ON public.receipt_settings;
DROP POLICY IF EXISTS "Owner and Admin can delete receipt settings" ON public.receipt_settings;

-- 1. SELECT POLICY: owner/admin/business member can read
CREATE POLICY "Business members can select receipt settings"
ON public.receipt_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
      AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
      AND bm.user_id = auth.uid()
  )
);

-- 2. INSERT POLICY: owner/admin can create
CREATE POLICY "Owner and Admin can insert receipt settings"
ON public.receipt_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
      AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
  )
);

-- 3. UPDATE POLICY: owner/admin can update
CREATE POLICY "Owner and Admin can update receipt settings"
ON public.receipt_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
      AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
  )
);

-- 4. DELETE POLICY: owner/admin can delete
CREATE POLICY "Owner and Admin can delete receipt settings"
ON public.receipt_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
      AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
  )
);
