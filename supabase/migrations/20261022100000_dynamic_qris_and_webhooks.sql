-- Migration: Dynamic QRIS & Payment Webhooks Foundation
-- Table: qris_transactions

CREATE TABLE IF NOT EXISTS public.qris_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  external_reference_id text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL,
  qris_payload text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'EXPIRED', 'FAILED'
  customer_name text,
  payment_time timestamptz,
  settlement_reference text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qris_transactions_external_ref ON public.qris_transactions(external_reference_id);
CREATE INDEX IF NOT EXISTS idx_qris_transactions_order_number ON public.qris_transactions(order_number);
CREATE INDEX IF NOT EXISTS idx_qris_transactions_status ON public.qris_transactions(status);
CREATE INDEX IF NOT EXISTS idx_qris_transactions_business_id ON public.qris_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_qris_transactions_outlet_id ON public.qris_transactions(outlet_id);

-- RLS Policies
ALTER TABLE public.qris_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qris_transactions' AND policyname = 'Authenticated users can manage qris_transactions'
  ) THEN
    CREATE POLICY "Authenticated users can manage qris_transactions" ON public.qris_transactions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qris_transactions' AND policyname = 'Anon users can view and update qris_transactions for payment verification'
  ) THEN
    CREATE POLICY "Anon users can view and update qris_transactions for payment verification" ON public.qris_transactions
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
