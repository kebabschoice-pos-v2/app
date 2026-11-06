-- Migration: Storage policy for business-assets bucket
-- Ensures bucket exists and authenticated users can upload/manage business assets

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any to prevent duplicates
DROP POLICY IF EXISTS "Business assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business assets" ON storage.objects;

-- 1. Public read access
CREATE POLICY "Business assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-assets');

-- 2. Authenticated users can upload assets
CREATE POLICY "Authenticated users can upload business assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-assets');

-- 3. Authenticated users can update assets
CREATE POLICY "Authenticated users can update business assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'business-assets');

-- 4. Authenticated users can delete assets
CREATE POLICY "Authenticated users can delete business assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'business-assets');
