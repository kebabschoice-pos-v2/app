CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_business_member(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_business_admin(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_business_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_business_admin(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.is_business_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_business_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_business_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION private.is_business_admin(uuid, uuid) FROM anon;

DROP POLICY "Members can view their businesses" ON public.businesses;
DROP POLICY "Owners and admins can update businesses" ON public.businesses;
DROP POLICY "Members can view business members" ON public.business_members;
DROP POLICY "Owners and admins can invite members" ON public.business_members;
DROP POLICY "Owners and admins can update members" ON public.business_members;
DROP POLICY "Owners and admins can remove members" ON public.business_members;

CREATE POLICY "Members can view their businesses" ON public.businesses FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR private.is_business_member(id, auth.uid())
);
CREATE POLICY "Owners and admins can update businesses" ON public.businesses FOR UPDATE TO authenticated USING (
  owner_id = auth.uid() OR private.is_business_admin(id, auth.uid())
) WITH CHECK (
  owner_id = auth.uid() OR private.is_business_admin(id, auth.uid())
);

CREATE POLICY "Members can view business members" ON public.business_members FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR private.is_business_member(business_id, auth.uid())
);
CREATE POLICY "Owners and admins can invite members" ON public.business_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR private.is_business_admin(business_id, auth.uid())
);
CREATE POLICY "Owners and admins can update members" ON public.business_members FOR UPDATE TO authenticated USING (
  private.is_business_admin(business_id, auth.uid())
) WITH CHECK (
  private.is_business_admin(business_id, auth.uid())
);
CREATE POLICY "Owners and admins can remove members" ON public.business_members FOR DELETE TO authenticated USING (
  private.is_business_admin(business_id, auth.uid())
);

DROP POLICY "Members can manage products" ON public.products;
CREATE POLICY "Members can manage products" ON public.products FOR ALL TO authenticated USING (
  private.is_business_member(business_id, auth.uid())
) WITH CHECK (
  private.is_business_member(business_id, auth.uid())
);

DROP POLICY "Members can manage customers" ON public.customers;
CREATE POLICY "Members can manage customers" ON public.customers FOR ALL TO authenticated USING (
  private.is_business_member(business_id, auth.uid())
) WITH CHECK (
  private.is_business_member(business_id, auth.uid())
);

DROP POLICY "Members can manage orders" ON public.sales_orders;
CREATE POLICY "Members can manage orders" ON public.sales_orders FOR ALL TO authenticated USING (
  private.is_business_member(business_id, auth.uid())
) WITH CHECK (
  private.is_business_member(business_id, auth.uid())
);

DROP POLICY "Members can manage inventory" ON public.inventory_items;
CREATE POLICY "Members can manage inventory" ON public.inventory_items FOR ALL TO authenticated USING (
  private.is_business_member(business_id, auth.uid())
) WITH CHECK (
  private.is_business_member(business_id, auth.uid())
);

DROP POLICY "Members can manage AI insights" ON public.ai_insights;
CREATE POLICY "Members can manage AI insights" ON public.ai_insights FOR ALL TO authenticated USING (
  private.is_business_member(business_id, auth.uid())
) WITH CHECK (
  private.is_business_member(business_id, auth.uid())
);