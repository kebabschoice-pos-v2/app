-- ==============================================================================
-- KEBABSCHOICE POS V2.0 - MASTER SCHEMA SYNC SCRIPT (IDEMPOTENT DDL)
-- Complete schema definition and synchronization for KebabsChoice POS V2.0
-- Ensures all tables, columns, indexes, and triggers exist in Supabase PostgREST
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE BUSINESS & MULTI-TENANCY FOUNDATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_name TEXT,
    tax_id TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'ID',
    logo_url TEXT,
    currency TEXT DEFAULT 'IDR',
    timezone TEXT DEFAULT 'Asia/Jakarta',
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT DEFAULT 'JAKARTA',
    state TEXT,
    postal_code TEXT,
    is_warehouse BOOLEAN DEFAULT false,
    is_central BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. PROFILES, USERS & ROLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    full_name TEXT,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'cashier',
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, user_id)
);

-- ==============================================================================
-- 4. PRODUCTS & MENU CATALOG
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    icon TEXT,
    color TEXT,
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    category TEXT,
    price NUMERIC(15,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15,2) DEFAULT 0,
    cost_price NUMERIC(15,2) DEFAULT 0,
    promo_price NUMERIC(15,2),
    tax_rate NUMERIC(5,2) DEFAULT 0,
    stock NUMERIC(12,2) DEFAULT 0,
    min_stock NUMERIC(12,2) DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    image_url TEXT,
    image_crop_position JSONB,
    crop_x NUMERIC(6,2) DEFAULT 50,
    crop_y NUMERIC(6,2) DEFAULT 50,
    image_position_x NUMERIC(6,2) DEFAULT 50,
    image_position_y NUMERIC(6,2) DEFAULT 50,
    image_zoom NUMERIC(4,2) DEFAULT 1,
    image_rotation NUMERIC(5,2) DEFAULT 0,
    ai_badge TEXT,
    description TEXT,
    is_combo BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price NUMERIC(15,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15,2) DEFAULT 0,
    promo_price NUMERIC(15,2),
    tax_rate NUMERIC(5,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    image_url TEXT,
    image_crop_position JSONB,
    crop_x NUMERIC(6,2) DEFAULT 50,
    crop_y NUMERIC(6,2) DEFAULT 50,
    image_position_x NUMERIC(6,2) DEFAULT 50,
    image_position_y NUMERIC(6,2) DEFAULT 50,
    image_zoom NUMERIC(4,2) DEFAULT 1,
    image_rotation NUMERIC(5,2) DEFAULT 0,
    customization JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. MENU VARIANT GROUPS & OPTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.menu_variant_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    selection_type TEXT NOT NULL DEFAULT 'single', -- 'single' | 'multiple'
    is_required BOOLEAN NOT NULL DEFAULT false,
    min_selections INT DEFAULT 0,
    max_selections INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_variant_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.menu_variant_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_adjustment NUMERIC(15,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15,2) DEFAULT 0,
    cost_price NUMERIC(15,2) DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_item_variant_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.menu_variant_groups(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. INVENTORY & RECIPES (BOM)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    unit TEXT NOT NULL DEFAULT 'gram',
    cost_per_unit NUMERIC(15,2) DEFAULT 0,
    stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12,2) DEFAULT 0,
    optimal_stock NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    yield_portions NUMERIC(10,2) DEFAULT 1,
    total_cost NUMERIC(15,2) DEFAULT 0,
    cost_per_portion NUMERIC(15,2) DEFAULT 0,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    yield_portions NUMERIC(10,2) DEFAULT 1,
    total_cost NUMERIC(15,2) DEFAULT 0,
    cost_per_portion NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    menu_recipe_id UUID REFERENCES public.menu_recipes(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'gram',
    cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    order_id UUID,
    reference_id TEXT,
    reference_type TEXT,
    type TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    quantity NUMERIC(12,4) NOT NULL,
    unit TEXT NOT NULL,
    remaining_stock NUMERIC(12,4),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. CUSTOMERS & CRM
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    points INT DEFAULT 0,
    visits INT DEFAULT 0,
    total_spend NUMERIC(15,2) DEFAULT 0,
    favorite_product TEXT,
    ai_insight TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. SALES ORDERS & ORDER ITEMS (POS ENGINE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    order_type TEXT DEFAULT 'dine_in',
    table_number TEXT,
    channel TEXT DEFAULT 'store',
    status TEXT NOT NULL DEFAULT 'paid', -- 'pending' | 'paid' | 'cancelled' | 'void' | 'refunded'
    payment_method TEXT NOT NULL DEFAULT 'qris',
    subtotal NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    service_charge NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    cash_tendered NUMERIC(15,2),
    change_amount NUMERIC(15,2),
    notes TEXT,
    external_reference_id TEXT,
    qris_payload TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    product_id UUID,
    name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    final_price NUMERIC(15,2) DEFAULT 0,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    selected_variant JSONB,
    selected_modifiers JSONB,
    selected_addons JSONB,
    selected_variant_groups JSONB,
    customization JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. CASH MANAGEMENT & SHIFTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.pos_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    cashier_id UUID,
    cashier_name TEXT,
    starting_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    cash_sales NUMERIC(15,2) DEFAULT 0,
    total_cash_in NUMERIC(15,2) DEFAULT 0,
    total_cash_out NUMERIC(15,2) DEFAULT 0,
    expected_ending_cash NUMERIC(15,2) DEFAULT 0,
    actual_ending_cash NUMERIC(15,2),
    cash_difference NUMERIC(15,2),
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'in' | 'out'
    amount NUMERIC(15,2) NOT NULL,
    category TEXT,
    reason TEXT NOT NULL,
    authorized_by TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. HR, BIOMETRIC ATTENDANCE & SHIFTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    user_id UUID,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    phone TEXT,
    email TEXT,
    national_id TEXT,
    avatar_url TEXT,
    face_embedding JSONB,
    base_salary NUMERIC(15,2) DEFAULT 0,
    hourly_rate NUMERIC(15,2) DEFAULT 0,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_holder TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT DEFAULT 15,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.staff_shifts(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_photo TEXT,
    check_out_photo TEXT,
    check_in_verification_method TEXT DEFAULT 'pin',
    check_out_verification_method TEXT DEFAULT 'pin',
    status TEXT NOT NULL DEFAULT 'present', -- 'present' | 'late' | 'absent' | 'leave'
    late_minutes INT DEFAULT 0,
    early_leave_minutes INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. INDEXES FOR HIGH-THROUGHPUT REALTIME TRANSACTIONS
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_products_business_active ON public.products(business_id, active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_business ON public.menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_variant_groups_item ON public.menu_variant_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_variant_options_group ON public.menu_variant_options(group_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_business ON public.inventory_items(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_outlet ON public.inventory_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_business ON public.sales_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_outlet ON public.sales_orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON public.sales_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_outlet_status ON public.pos_shifts(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_attendances_staff_date ON public.staff_attendances(staff_id, date);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_variant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform operations
DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to businesses" ON public.businesses FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to outlets" ON public.outlets FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to menu_items" ON public.menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to sales_orders" ON public.sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to sales_order_items" ON public.sales_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to staff_profiles" ON public.staff_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to staff_attendances" ON public.staff_attendances FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated full access to pos_shifts" ON public.pos_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 13. RELOAD POSTGREST SCHEMA CACHE
-- ==============================================================================

NOTIFY pgrst, 'reload schema';
