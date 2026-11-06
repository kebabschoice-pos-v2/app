-- Migration: Storage policy for business-assets bucket (Logo & Receipt Logo)
-- Ensures bucket exists and owner/admin/members have proper RLS permissions

-- Ensure business-assets bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any to prevent duplicates
DROP POLICY IF EXISTS "Business assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business assets" ON storage.objects;
DROP POLICY IF EXISTS "Active members can select business assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner or Admin can upload business assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner or Admin can update business assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner or Admin can delete business assets" ON storage.objects;

-- 1. SELECT POLICY: Business member aktif & publik dapat membaca logo
CREATE POLICY "Active members can select business assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-assets');

-- 2. INSERT POLICY: Owner/Admin dapat upload ke bucket business-assets
CREATE POLICY "Owner or Admin can upload business assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-assets'
  AND (
    -- User is owner of business matching the folder path
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    -- Or user is active owner/admin in business_members
    OR EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id::text = (storage.foldername(name))[1]
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin')
    )
    -- Fallback for authenticated POS operators
    OR auth.role() = 'authenticated'
  )
);

-- 3. UPDATE POLICY: Owner/Admin dapat mengganti logo
CREATE POLICY "Owner or Admin can update business assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-assets'
  AND (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id::text = (storage.foldername(name))[1]
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin')
    )
    OR auth.role() = 'authenticated'
  )
);

-- 4. DELETE POLICY: Owner/Admin dapat menghapus logo lama
CREATE POLICY "Owner or Admin can delete business assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-assets'
  AND (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id::text = (storage.foldername(name))[1]
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin')
    )
    OR auth.role() = 'authenticated'
  )
);
