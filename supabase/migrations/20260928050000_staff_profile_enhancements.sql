-- Migration: Staff profile enhancements
-- Adds email column to public.profiles for easy staff lookup and directory display

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;
