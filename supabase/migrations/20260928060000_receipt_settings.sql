-- Migration: Receipt / Invoice Settings Table and Policies
-- Supports both Business-level (HQ) default and Outlet-specific receipt customization

CREATE TABLE IF NOT EXISTS public.receipt_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  store_name text,
  receipt_header text,
  receipt_footer text,
  logo_url text,
  show_business_name boolean NOT NULL DEFAULT true,
  show_address boolean NOT NULL DEFAULT true,
  show_phone boolean NOT NULL DEFAULT true,
  show_tax boolean NOT NULL DEFAULT true,
  paper_size text NOT NULL DEFAULT '58mm',
  footer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint ensuring one default (outlet_id IS NULL) and one per outlet
CREATE UNIQUE INDEX IF NOT EXISTS receipt_settings_bus_outlet_uidx 
ON public.receipt_settings (business_id, COALESCE(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable RLS
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Any member of the business can view receipt settings (cashier needs this on POS)
CREATE POLICY "Members can view receipt settings"
ON public.receipt_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
    AND bm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
    AND b.owner_id = auth.uid()
  )
);

-- INSERT policy: Only Owner and Admin can insert receipt settings
CREATE POLICY "Admins and Owners can insert receipt settings"
ON public.receipt_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
    AND b.owner_id = auth.uid()
  )
);

-- UPDATE policy: Only Owner and Admin can update receipt settings
CREATE POLICY "Admins and Owners can update receipt settings"
ON public.receipt_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
    AND b.owner_id = auth.uid()
  )
);

-- DELETE policy: Only Owner and Admin can delete receipt settings
CREATE POLICY "Admins and Owners can delete receipt settings"
ON public.receipt_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = receipt_settings.business_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = receipt_settings.business_id
    AND b.owner_id = auth.uid()
  )
);
