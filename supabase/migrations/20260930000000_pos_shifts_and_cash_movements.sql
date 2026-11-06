-- Migration: POS Shifts and Cash Movements Foundation
-- Tables: pos_shifts, cash_movements

-- 1. Table: pos_shifts
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  cashier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cashier_name text NOT NULL DEFAULT 'Kasir',
  outlet_name text NOT NULL DEFAULT 'Outlet Utama',
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  cash_sales numeric(14,2) NOT NULL DEFAULT 0,
  total_cash_in numeric(14,2) NOT NULL DEFAULT 0,
  total_cash_out numeric(14,2) NOT NULL DEFAULT 0,
  expected_ending_cash numeric(14,2) NOT NULL DEFAULT 0,
  actual_ending_cash numeric(14,2),
  cash_difference numeric(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_business_id ON public.pos_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_outlet_id ON public.pos_shifts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier_id ON public.pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_status ON public.pos_shifts(status);

-- 2. Table: cash_movements
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  type text NOT NULL, -- 'in' | 'out'
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift_id ON public.cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_business_id ON public.cash_movements(business_id);

-- 3. RLS Policies
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pos_shifts' AND policyname = 'Authenticated users can manage pos_shifts'
  ) THEN
    CREATE POLICY "Authenticated users can manage pos_shifts" ON public.pos_shifts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cash_movements' AND policyname = 'Authenticated users can manage cash_movements'
  ) THEN
    CREATE POLICY "Authenticated users can manage cash_movements" ON public.cash_movements
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
