CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'cashier', 'manager');
CREATE TYPE public.business_member_role AS ENUM ('owner', 'admin', 'cashier', 'manager');
CREATE TYPE public.payment_method AS ENUM ('cash', 'qris', 'ewallet', 'card');
CREATE TYPE public.order_status AS ENUM ('draft', 'paid', 'refunded', 'cancelled');
CREATE TYPE public.insight_type AS ENUM ('sales_prediction', 'stock_recommendation', 'product_analysis', 'customer_insight', 'daily_summary');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  language text NOT NULL DEFAULT 'id',
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own default role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role IN ('owner', 'admin', 'cashier', 'manager'));

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'restaurant',
  currency text NOT NULL DEFAULT 'IDR',
  city text,
  ai_tone text NOT NULL DEFAULT 'friendly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.business_member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their businesses" ON public.businesses FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.business_members bm WHERE bm.business_id = businesses.id AND bm.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create owned businesses" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners and admins can update businesses" ON public.businesses FOR UPDATE TO authenticated USING (
  owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.business_members bm WHERE bm.business_id = businesses.id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'admin')
  )
) WITH CHECK (
  owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.business_members bm WHERE bm.business_id = businesses.id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Owners can delete businesses" ON public.businesses FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members can view business members" ON public.business_members FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.business_members my_membership WHERE my_membership.business_id = business_members.business_id AND my_membership.user_id = auth.uid()
  )
);
CREATE POLICY "Owners and admins can invite members" ON public.business_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.business_members my_membership WHERE my_membership.business_id = business_members.business_id AND my_membership.user_id = auth.uid() AND my_membership.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Owners and admins can update members" ON public.business_members FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.business_members my_membership WHERE my_membership.business_id = business_members.business_id AND my_membership.user_id = auth.uid() AND my_membership.role IN ('owner', 'admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_members my_membership WHERE my_membership.business_id = business_members.business_id AND my_membership.user_id = auth.uid() AND my_membership.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Owners and admins can remove members" ON public.business_members FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.business_members my_membership WHERE my_membership.business_id = business_members.business_id AND my_membership.user_id = auth.uid() AND my_membership.role IN ('owner', 'admin')
  )
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  ai_badge text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage products" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = products.business_id AND bm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = products.business_id AND bm.user_id = auth.uid())
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  total_spend numeric(12, 2) NOT NULL DEFAULT 0,
  visits integer NOT NULL DEFAULT 0,
  favorite_product text,
  ai_insight text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage customers" ON public.customers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = customers.business_id AND bm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = customers.business_id AND bm.user_id = auth.uid())
);

CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  status public.order_status NOT NULL DEFAULT 'draft',
  channel text NOT NULL DEFAULT 'store',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage orders" ON public.sales_orders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = sales_orders.business_id AND bm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = sales_orders.business_id AND bm.user_id = auth.uid())
);

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_items TO authenticated;
GRANT ALL ON public.sales_order_items TO service_role;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage order items" ON public.sales_order_items FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    JOIN public.business_members bm ON bm.business_id = so.business_id
    WHERE so.id = sales_order_items.order_id AND bm.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    JOIN public.business_members bm ON bm.business_id = so.business_id
    WHERE so.id = sales_order_items.order_id AND bm.user_id = auth.uid()
  )
);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  stock numeric(12, 2) NOT NULL DEFAULT 0,
  minimum_stock numeric(12, 2) NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 100,
  predicted_empty_at date,
  ai_alert text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage inventory" ON public.inventory_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = inventory_items.business_id AND bm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = inventory_items.business_id AND bm.user_id = auth.uid())
);

CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type public.insight_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  confidence integer NOT NULL DEFAULT 88,
  action_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage AI insights" ON public.ai_insights FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = ai_insights.business_id AND bm.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = ai_insights.business_id AND bm.user_id = auth.uid())
);

CREATE INDEX idx_business_members_user_id ON public.business_members(user_id);
CREATE INDEX idx_products_business_id ON public.products(business_id);
CREATE INDEX idx_customers_business_id ON public.customers(business_id);
CREATE INDEX idx_sales_orders_business_created ON public.sales_orders(business_id, created_at DESC);
CREATE INDEX idx_inventory_items_business_id ON public.inventory_items(business_id);
CREATE INDEX idx_ai_insights_business_created ON public.ai_insights(business_id, created_at DESC);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON public.ai_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;