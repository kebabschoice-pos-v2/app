-- ============================================================================
-- DRAFT MIGRATION — DO NOT APPLY TO PRODUCTION WITHOUT REVIEW
-- ============================================================================
-- File ini adalah RANCANGAN (draft) untuk mengganti policy RLS permisif
-- (`USING (true)` dan akses anon di `qris_transactions`) dengan isolasi ketat
-- berbasis keanggotaan bisnis (`business_members` / `businesses.owner_id`).
--
-- CATATAN PENTING SEBELUM DITERAPKAN:
--   1. File ini BELUM pernah dieksekusi ke database mana pun. Review manual dulu.
--   2. Terapkan di staging, jalankan aplikasi, lalu bandingkan hasilnya dengan
--      production sebelum menyentuh Supabase production.
--   3. Server API memakai `service_role` (bypass RLS), jadi route server tetap
--      berjalan. Yang berubah adalah akses langsung dari browser memakai anon key
--      + JWT user — alur yang mengandalkan policy permisif bisa ikut tertutup.
--   4. Baris dengan `business_id IS NULL` menjadi TIDAK TERLIHAT oleh user biasa
--      (EXISTS pada NULL selalu false). Backfill `business_id` dulu untuk
--      `qris_transactions`, `pos_shifts`, `cash_movements`, `staff_profiles`
--      bila ada data lama yang masih NULL.
--   5. `businesses.owner_id` adalah sumber kebenaran untuk role Owner.
--      `business_members.role` dipakai untuk admin/manager/cashier.
--   6. Semua helper di bawah adalah SECURITY DEFINER milik table owner sehingga
--      RLS pada tabel di dalamnya di-bypass dan tidak terjadi rekursi policy.
--
-- Rollback: jalankan ulang bagian "DROP POLICY" untuk policy `strict_*`,
-- hapus 3 fungsi helper, lalu restore policy lama dari migrasi asal
-- (MASTER_SCHEMA_SYNC.sql, 20261003010000_comprehensive_menu_management_schema.sql,
--  20260930000000_pos_shifts_and_cash_movements.sql, 20260930030000_hr_staff_attendance_payroll.sql,
--  20261022100000_dynamic_qris_and_webhooks.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Guard: pastikan semua tabel target ada sebelum DDL dijalankan.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t, ', ')
    INTO missing
  FROM unnest(ARRAY[
    'businesses', 'outlets', 'business_members',
    'products', 'menu_categories', 'menu_items', 'menu_variant_groups',
    'menu_variant_options', 'menu_recipes', 'recipes', 'recipe_items',
    'ingredients', 'inventory_items', 'outlet_menu_items',
    'sales_orders', 'sales_order_items',
    'staff_profiles', 'staff_shifts', 'staff_attendances', 'staff_payrolls',
    'pos_shifts', 'cash_movements', 'qris_transactions'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'DRAFT RLS: tabel berikut tidak ditemukan: %', missing;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Helper functions
-- ----------------------------------------------------------------------------

-- Semua business_id yang boleh diakses caller (owned + member).
CREATE OR REPLACE FUNCTION public.current_user_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id
    FROM public.businesses b
   WHERE b.owner_id = auth.uid()
  UNION
  SELECT m.business_id
    FROM public.business_members m
   WHERE m.user_id = auth.uid();
$$;

-- Apakah caller punya akses (owner atau member) ke business ini?
CREATE OR REPLACE FUNCTION public.user_has_business_access(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_business_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.current_user_business_ids() AS ids(id)
        WHERE ids.id = p_business_id
     );
$$;

-- Apakah caller punya salah satu role pada business ini?
-- Owner selalu lolos (via businesses.owner_id), role lain via business_members.
CREATE OR REPLACE FUNCTION public.user_has_business_role(p_business_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_business_id IS NOT NULL
     AND (
       EXISTS (
         SELECT 1 FROM public.businesses b
          WHERE b.id = p_business_id AND b.owner_id = auth.uid()
       )
       OR EXISTS (
         SELECT 1 FROM public.business_members m
          WHERE m.business_id = p_business_id
            AND m.user_id = auth.uid()
            AND m.role = ANY (p_roles)
       )
     );
$$;

REVOKE ALL ON FUNCTION public.current_user_business_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_business_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_business_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_business_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_business_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_business_role(uuid, text[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Hapus policy permisif yang lama
--    (nama-nama ini diambil dari migrasi yang sudah ada di repo)
-- ----------------------------------------------------------------------------

-- MASTER_SCHEMA_SYNC.sql
DROP POLICY IF EXISTS "Allow authenticated full access to businesses" ON public.businesses;
DROP POLICY IF EXISTS "Allow authenticated full access to outlets" ON public.outlets;
DROP POLICY IF EXISTS "Allow authenticated full access to products" ON public.products;
DROP POLICY IF EXISTS "Allow authenticated full access to menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow authenticated full access to sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated full access to sales_order_items" ON public.sales_order_items;
DROP POLICY IF EXISTS "Allow authenticated full access to inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow authenticated full access to staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Allow authenticated full access to staff_attendances" ON public.staff_attendances;
DROP POLICY IF EXISTS "Allow authenticated full access to pos_shifts" ON public.pos_shifts;

-- 20261003010000_comprehensive_menu_management_schema.sql
DROP POLICY IF EXISTS "Public read menu_categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Manage menu_categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Manage products" ON public.products;
DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Manage menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Public read menu_variant_groups" ON public.menu_variant_groups;
DROP POLICY IF EXISTS "Manage menu_variant_groups" ON public.menu_variant_groups;
DROP POLICY IF EXISTS "Public read menu_variant_options" ON public.menu_variant_options;
DROP POLICY IF EXISTS "Manage menu_variant_options" ON public.menu_variant_options;
DROP POLICY IF EXISTS "Public read menu_recipes" ON public.menu_recipes;
DROP POLICY IF EXISTS "Manage menu_recipes" ON public.menu_recipes;
DROP POLICY IF EXISTS "Public read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Manage recipes" ON public.recipes;
DROP POLICY IF EXISTS "Public read recipe_items" ON public.recipe_items;
DROP POLICY IF EXISTS "Manage recipe_items" ON public.recipe_items;
DROP POLICY IF EXISTS "Public read inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Manage inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Public read ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Manage ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Public read outlet_menu_items" ON public.outlet_menu_items;
DROP POLICY IF EXISTS "Manage outlet_menu_items" ON public.outlet_menu_items;

-- 20260930040000_menu_variant_groups.sql
DROP POLICY IF EXISTS "Manage menu_variant_groups for authenticated" ON public.menu_variant_groups;
DROP POLICY IF EXISTS "Manage menu_variant_options for authenticated" ON public.menu_variant_options;

-- 20260930000000_pos_shifts_and_cash_movements.sql
DROP POLICY IF EXISTS "Authenticated users can manage pos_shifts" ON public.pos_shifts;
DROP POLICY IF EXISTS "Authenticated users can manage cash_movements" ON public.cash_movements;

-- 20260930030000_hr_staff_attendance_payroll.sql
DROP POLICY IF EXISTS "Authenticated users can manage staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "Authenticated users can manage staff_shifts" ON public.staff_shifts;
DROP POLICY IF EXISTS "Authenticated users can manage staff_attendances" ON public.staff_attendances;
DROP POLICY IF EXISTS "Authenticated users can manage staff_payrolls" ON public.staff_payrolls;

-- 20261022100000_dynamic_qris_and_webhooks.sql
-- Policy anon dihapus TOTAL: verifikasi pembayaran QRIS hanya boleh lewat
-- webhook server (service_role). Browser tidak boleh membaca/mengubah tabel ini
-- tanpa JWT.
DROP POLICY IF EXISTS "Authenticated users can manage qris_transactions" ON public.qris_transactions;
DROP POLICY IF EXISTS "Anon users can view and update qris_transactions for payment verification" ON public.qris_transactions;

-- Policy lama yang sudah berbasis keanggotaan (dari migrasi awal) tetap
-- dipertahankan sebagai lapisan tambahan; tidak di-drop di sini.

-- ----------------------------------------------------------------------------
-- 3. businesses
--    SELECT: owner atau member
--    INSERT: hanya untuk diri sendiri sebagai owner
--    UPDATE: hanya Owner (mencegah admin menaikkan dirinya jadi owner)
--    DELETE: hanya Owner
-- ----------------------------------------------------------------------------
CREATE POLICY "strict_businesses_select" ON public.businesses
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(id));

CREATE POLICY "strict_businesses_insert" ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "strict_businesses_update" ON public.businesses
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "strict_businesses_delete" ON public.businesses
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. business_members
--    SELECT: anggota bisnis yang sama
--    INSERT/UPDATE/DELETE: owner/admin bisnis tersebut
--    (Mencegah user menambahkan dirinya ke bisnis lain.)
-- ----------------------------------------------------------------------------
CREATE POLICY "strict_business_members_select" ON public.business_members
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));

CREATE POLICY "strict_business_members_insert" ON public.business_members
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

CREATE POLICY "strict_business_members_update" ON public.business_members
  FOR UPDATE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

CREATE POLICY "strict_business_members_delete" ON public.business_members
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- ----------------------------------------------------------------------------
-- 5. Tabel dengan kolom `business_id` langsung
--    Pola: SELECT = member; INSERT/UPDATE = member (dengan WITH CHECK agar
--    baris tidak bisa dipindah ke bisnis lain); DELETE = owner/admin.
-- ----------------------------------------------------------------------------

-- outlets
CREATE POLICY "strict_outlets_select" ON public.outlets
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_outlets_insert" ON public.outlets
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_outlets_update" ON public.outlets
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_outlets_delete" ON public.outlets
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- products
CREATE POLICY "strict_products_select" ON public.products
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_products_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_products_update" ON public.products
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_products_delete" ON public.products
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- menu_categories
CREATE POLICY "strict_menu_categories_select" ON public.menu_categories
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_categories_insert" ON public.menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_categories_update" ON public.menu_categories
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_categories_delete" ON public.menu_categories
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- menu_items
CREATE POLICY "strict_menu_items_select" ON public.menu_items
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_items_insert" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_items_update" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_items_delete" ON public.menu_items
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- menu_variant_groups
CREATE POLICY "strict_menu_variant_groups_select" ON public.menu_variant_groups
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_variant_groups_insert" ON public.menu_variant_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_variant_groups_update" ON public.menu_variant_groups
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_variant_groups_delete" ON public.menu_variant_groups
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- menu_recipes
CREATE POLICY "strict_menu_recipes_select" ON public.menu_recipes
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_recipes_insert" ON public.menu_recipes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_recipes_update" ON public.menu_recipes
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_menu_recipes_delete" ON public.menu_recipes
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- recipes
CREATE POLICY "strict_recipes_select" ON public.recipes
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_recipes_insert" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_recipes_update" ON public.recipes
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_recipes_delete" ON public.recipes
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- ingredients
CREATE POLICY "strict_ingredients_select" ON public.ingredients
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_ingredients_insert" ON public.ingredients
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_ingredients_update" ON public.ingredients
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_ingredients_delete" ON public.ingredients
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- inventory_items
CREATE POLICY "strict_inventory_items_select" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_inventory_items_insert" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_inventory_items_update" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_inventory_items_delete" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- sales_orders
CREATE POLICY "strict_sales_orders_select" ON public.sales_orders
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_sales_orders_insert" ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_sales_orders_update" ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_sales_orders_delete" ON public.sales_orders
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- staff_profiles
CREATE POLICY "strict_staff_profiles_select" ON public.staff_profiles
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_profiles_insert" ON public.staff_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_profiles_update" ON public.staff_profiles
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_profiles_delete" ON public.staff_profiles
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- staff_shifts
CREATE POLICY "strict_staff_shifts_select" ON public.staff_shifts
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_shifts_insert" ON public.staff_shifts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_shifts_update" ON public.staff_shifts
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_shifts_delete" ON public.staff_shifts
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- staff_attendances
CREATE POLICY "strict_staff_attendances_select" ON public.staff_attendances
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_attendances_insert" ON public.staff_attendances
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_attendances_update" ON public.staff_attendances
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_attendances_delete" ON public.staff_attendances
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- staff_payrolls
CREATE POLICY "strict_staff_payrolls_select" ON public.staff_payrolls
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_payrolls_insert" ON public.staff_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_payrolls_update" ON public.staff_payrolls
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_staff_payrolls_delete" ON public.staff_payrolls
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- pos_shifts
CREATE POLICY "strict_pos_shifts_select" ON public.pos_shifts
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_pos_shifts_insert" ON public.pos_shifts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_pos_shifts_update" ON public.pos_shifts
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_pos_shifts_delete" ON public.pos_shifts
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- cash_movements
CREATE POLICY "strict_cash_movements_select" ON public.cash_movements
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_cash_movements_insert" ON public.cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_cash_movements_update" ON public.cash_movements
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_cash_movements_delete" ON public.cash_movements
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- qris_transactions
-- Tidak ada policy anon. Browser dengan JWT member hanya bisa membaca transaksi
-- bisnisnya sendiri; pembuatan/update status dilakukan server via service_role
-- (webhook QRIS). DELETE dibatasi owner/admin.
CREATE POLICY "strict_qris_transactions_select" ON public.qris_transactions
  FOR SELECT TO authenticated
  USING (public.user_has_business_access(business_id));
CREATE POLICY "strict_qris_transactions_insert" ON public.qris_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_qris_transactions_update" ON public.qris_transactions
  FOR UPDATE TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY "strict_qris_transactions_delete" ON public.qris_transactions
  FOR DELETE TO authenticated
  USING (public.user_has_business_role(business_id, ARRAY['owner', 'admin']));

-- ----------------------------------------------------------------------------
-- 6. Tabel anak (tanpa business_id) — isolasi lewat EXISTS ke tabel induk
-- ----------------------------------------------------------------------------

-- sales_order_items -> sales_orders.business_id
CREATE POLICY "strict_sales_order_items_select" ON public.sales_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
       WHERE so.id = sales_order_items.order_id
         AND public.user_has_business_access(so.business_id)
    )
  );
CREATE POLICY "strict_sales_order_items_insert" ON public.sales_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
       WHERE so.id = sales_order_items.order_id
         AND public.user_has_business_access(so.business_id)
    )
  );
CREATE POLICY "strict_sales_order_items_update" ON public.sales_order_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
       WHERE so.id = sales_order_items.order_id
         AND public.user_has_business_access(so.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
       WHERE so.id = sales_order_items.order_id
         AND public.user_has_business_access(so.business_id)
    )
  );
CREATE POLICY "strict_sales_order_items_delete" ON public.sales_order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
       WHERE so.id = sales_order_items.order_id
         AND public.user_has_business_role(so.business_id, ARRAY['owner', 'admin'])
    )
  );

-- menu_variant_options -> menu_variant_groups.business_id
CREATE POLICY "strict_menu_variant_options_select" ON public.menu_variant_options
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_variant_groups g
       WHERE g.id = menu_variant_options.group_id
         AND public.user_has_business_access(g.business_id)
    )
  );
CREATE POLICY "strict_menu_variant_options_insert" ON public.menu_variant_options
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_variant_groups g
       WHERE g.id = menu_variant_options.group_id
         AND public.user_has_business_access(g.business_id)
    )
  );
CREATE POLICY "strict_menu_variant_options_update" ON public.menu_variant_options
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_variant_groups g
       WHERE g.id = menu_variant_options.group_id
         AND public.user_has_business_access(g.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_variant_groups g
       WHERE g.id = menu_variant_options.group_id
         AND public.user_has_business_access(g.business_id)
    )
  );
CREATE POLICY "strict_menu_variant_options_delete" ON public.menu_variant_options
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_variant_groups g
       WHERE g.id = menu_variant_options.group_id
         AND public.user_has_business_role(g.business_id, ARRAY['owner', 'admin'])
    )
  );

-- recipe_items -> recipes.business_id
CREATE POLICY "strict_recipe_items_select" ON public.recipe_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
       WHERE r.id = recipe_items.recipe_id
         AND public.user_has_business_access(r.business_id)
    )
  );
CREATE POLICY "strict_recipe_items_insert" ON public.recipe_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
       WHERE r.id = recipe_items.recipe_id
         AND public.user_has_business_access(r.business_id)
    )
  );
CREATE POLICY "strict_recipe_items_update" ON public.recipe_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
       WHERE r.id = recipe_items.recipe_id
         AND public.user_has_business_access(r.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
       WHERE r.id = recipe_items.recipe_id
         AND public.user_has_business_access(r.business_id)
    )
  );
CREATE POLICY "strict_recipe_items_delete" ON public.recipe_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
       WHERE r.id = recipe_items.recipe_id
         AND public.user_has_business_role(r.business_id, ARRAY['owner', 'admin'])
    )
  );

-- outlet_menu_items -> outlets.business_id
CREATE POLICY "strict_outlet_menu_items_select" ON public.outlet_menu_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
       WHERE o.id = outlet_menu_items.outlet_id
         AND public.user_has_business_access(o.business_id)
    )
  );
CREATE POLICY "strict_outlet_menu_items_insert" ON public.outlet_menu_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
       WHERE o.id = outlet_menu_items.outlet_id
         AND public.user_has_business_access(o.business_id)
    )
  );
CREATE POLICY "strict_outlet_menu_items_update" ON public.outlet_menu_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
       WHERE o.id = outlet_menu_items.outlet_id
         AND public.user_has_business_access(o.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
       WHERE o.id = outlet_menu_items.outlet_id
         AND public.user_has_business_access(o.business_id)
    )
  );
CREATE POLICY "strict_outlet_menu_items_delete" ON public.outlet_menu_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
       WHERE o.id = outlet_menu_items.outlet_id
         AND public.user_has_business_role(o.business_id, ARRAY['owner', 'admin'])
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Verifikasi cepat setelah apply (jalankan manual, bukan bagian migrasi):
--
--   SELECT tablename, policyname, roles, cmd, qual
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('qris_transactions','businesses','outlets','sales_orders')
--    ORDER BY tablename, policyname;
--
--   -- Pastikan tidak ada lagi policy permisif:
--   SELECT tablename, policyname
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND (qual = 'true' OR with_check = 'true');
--
--   -- Deteksi baris tenant tanpa business_id (harus di-backfill):
--   SELECT 'qris_transactions' AS tbl, count(*) FROM public.qris_transactions WHERE business_id IS NULL
--   UNION ALL SELECT 'pos_shifts', count(*) FROM public.pos_shifts WHERE business_id IS NULL
--   UNION ALL SELECT 'cash_movements', count(*) FROM public.cash_movements WHERE business_id IS NULL
--   UNION ALL SELECT 'staff_profiles', count(*) FROM public.staff_profiles WHERE business_id IS NULL;
-- ============================================================================
-- END OF DRAFT — DO NOT APPLY WITHOUT REVIEW
-- ============================================================================
