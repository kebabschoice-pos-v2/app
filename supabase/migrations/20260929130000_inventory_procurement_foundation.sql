-- Migration: Enterprise Inventory & Procurement Management Foundation
-- Modules: Inventory Items, Stock In/Out, Adjustments, Stock Opname, Waste, Suppliers, Purchase Orders, Stock Transfers

-- 1. Add cost_price and supplier_id to inventory_items
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS cost_price numeric(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_id uuid;

-- 2. Table: suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  product_category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);

-- 3. Table: purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  approved_by uuid,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_business_id ON public.purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_outlet_id ON public.purchase_orders(outlet_id);

-- 4. Table: purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'pcs',
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  received_quantity numeric(12,3) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON public.purchase_order_items(purchase_order_id);

-- 5. Table: stock_adjustments
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL DEFAULT 'correction',
  system_stock numeric(12,3) NOT NULL,
  actual_stock numeric(12,3) NOT NULL,
  difference numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  reason text NOT NULL,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_business ON public.stock_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_item ON public.stock_adjustments(inventory_item_id);

-- 6. Table: stock_opnames
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  opname_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  conducted_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_business ON public.stock_opnames(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_outlet ON public.stock_opnames(outlet_id);

-- 7. Table: stock_opname_items
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id uuid NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  system_stock numeric(12,3) NOT NULL,
  physical_stock numeric(12,3) NOT NULL,
  difference numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opname_items_opname ON public.stock_opname_items(opname_id);

-- 8. Table: waste_records
CREATE TABLE IF NOT EXISTS public.waste_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  cost_loss numeric(14,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_business ON public.waste_records(business_id);
CREATE INDEX IF NOT EXISTS idx_waste_outlet ON public.waste_records(outlet_id);

-- 9. Table: stock_transfers
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  origin_outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  destination_outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  notes text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_business ON public.stock_transfers(business_id);

-- 10. Table: stock_transfer_items
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.stock_transfer_items(transfer_id);

-- 11. Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- 12. Register New Permissions
INSERT INTO public.permissions (code, description) VALUES
('inventory.view', 'View inventory dashboard and raw materials list'),
('inventory.create', 'Add raw materials and record stock in/out'),
('inventory.edit', 'Edit raw materials and adjust stock'),
('inventory.delete', 'Delete raw materials'),
('stock_opname.view', 'View stock opname audit reports'),
('stock_opname.create', 'Perform and approve stock opname audit'),
('supplier.view', 'View suppliers list and purchase history'),
('supplier.create', 'Create new supplier profile'),
('supplier.edit', 'Edit supplier profile details'),
('purchase_order.view', 'View purchase order list and detail'),
('purchase_order.create', 'Create and submit purchase orders'),
('purchase_order.approve', 'Approve and receive purchase orders'),
('stock_transfer.view', 'View inter-outlet stock transfers'),
('stock_transfer.create', 'Create stock transfer request'),
('stock_transfer.receive', 'Approve and receive stock transfer')
ON CONFLICT (code) DO NOTHING;

-- Grant to Owner and Admin roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'owner'::public.app_role, p.id FROM public.permissions p
WHERE p.code LIKE 'inventory.%' OR p.code LIKE 'stock_opname.%' OR p.code LIKE 'supplier.%' OR p.code LIKE 'purchase_order.%' OR p.code LIKE 'stock_transfer.%'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id FROM public.permissions p
WHERE p.code LIKE 'inventory.%' OR p.code LIKE 'stock_opname.%' OR p.code LIKE 'supplier.%' OR p.code LIKE 'purchase_order.%' OR p.code LIKE 'stock_transfer.%'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Grant operational permissions to Manager role
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, p.id FROM public.permissions p
WHERE p.code IN (
  'inventory.view', 'inventory.create', 'inventory.edit',
  'stock_opname.view', 'stock_opname.create',
  'supplier.view',
  'purchase_order.view', 'purchase_order.create',
  'stock_transfer.view', 'stock_transfer.create', 'stock_transfer.receive'
)
ON CONFLICT (role, permission_id) DO NOTHING;
