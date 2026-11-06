-- Migration: HR Staff Management, Face Attendance, Shifts, and Payroll Foundation
-- Tables: staff_profiles, staff_shifts, staff_attendances, staff_payrolls

-- 1. Table: staff_profiles (HR extensions for staff members)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  address text,
  avatar_url text,
  job_title text NOT NULL DEFAULT 'Kasir',
  role text NOT NULL DEFAULT 'cashier', -- 'owner' | 'admin' | 'manager' | 'cashier'
  employment_status text NOT NULL DEFAULT 'Tetap', -- 'Tetap' | 'Kontrak' | 'Probation' | 'Magang'
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  base_salary numeric(14,2) NOT NULL DEFAULT 2000000,
  daily_allowance numeric(14,2) NOT NULL DEFAULT 25000,
  late_deduction numeric(14,2) NOT NULL DEFAULT 20000,
  absence_deduction numeric(14,2) NOT NULL DEFAULT 80000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_business_id ON public.staff_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_outlet_id ON public.staff_profiles(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON public.staff_profiles(user_id);

-- 2. Table: staff_shifts (Work Shift Schedules)
CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  shift_name text NOT NULL, -- 'Shift Pagi', 'Shift Siang', 'Shift Malam'
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '16:00',
  grace_period_minutes integer NOT NULL DEFAULT 15,
  assigned_staff_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_business_id ON public.staff_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_outlet_id ON public.staff_shifts(outlet_id);

-- 3. Table: staff_attendances (Face Recognition Attendance Logs)
CREATE TABLE IF NOT EXISTS public.staff_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  staff_name text NOT NULL,
  date text NOT NULL, -- 'YYYY-MM-DD'
  check_in_time timestamptz,
  check_out_time timestamptz,
  type text NOT NULL DEFAULT 'in', -- 'in' | 'out'
  status text NOT NULL DEFAULT 'on_time', -- 'on_time' | 'late' | 'early_leave'
  device text NOT NULL DEFAULT 'Web POS Client',
  face_snapshot_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_attendances_business_id ON public.staff_attendances(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendances_outlet_id ON public.staff_attendances(outlet_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendances_date ON public.staff_attendances(date);
CREATE INDEX IF NOT EXISTS idx_staff_attendances_user_id ON public.staff_attendances(user_id);

-- 4. Table: staff_payrolls (Salary & Payrolls linked to attendance)
CREATE TABLE IF NOT EXISTS public.staff_payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  staff_name text NOT NULL,
  period_month integer NOT NULL, -- 1 to 12
  period_year integer NOT NULL, -- e.g. 2026
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_days_present integer NOT NULL DEFAULT 0,
  total_times_late integer NOT NULL DEFAULT 0,
  total_days_absent integer NOT NULL DEFAULT 0,
  allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  deduction_amount numeric(14,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'paid'
  payment_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_payrolls_business_id ON public.staff_payrolls(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_payrolls_user_id ON public.staff_payrolls(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_payrolls_period ON public.staff_payrolls(period_year, period_month);

-- 5. RLS Policies
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payrolls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_profiles' AND policyname = 'Authenticated users can manage staff_profiles'
  ) THEN
    CREATE POLICY "Authenticated users can manage staff_profiles" ON public.staff_profiles
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_shifts' AND policyname = 'Authenticated users can manage staff_shifts'
  ) THEN
    CREATE POLICY "Authenticated users can manage staff_shifts" ON public.staff_shifts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_attendances' AND policyname = 'Authenticated users can manage staff_attendances'
  ) THEN
    CREATE POLICY "Authenticated users can manage staff_attendances" ON public.staff_attendances
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_payrolls' AND policyname = 'Authenticated users can manage staff_payrolls'
  ) THEN
    CREATE POLICY "Authenticated users can manage staff_payrolls" ON public.staff_payrolls
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
