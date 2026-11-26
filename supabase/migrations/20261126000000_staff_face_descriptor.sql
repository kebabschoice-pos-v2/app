-- Migration: Add 128D face_descriptor JSONB column to staff_profiles for PIN-free biometric attendance
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS face_descriptor jsonb;
