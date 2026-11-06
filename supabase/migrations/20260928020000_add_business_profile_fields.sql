-- Add business identity fields for Business Settings
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS legal_name text,
ADD COLUMN IF NOT EXISTS logo text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS business_category text;
