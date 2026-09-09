-- helpers
CREATE OR REPLACE FUNCTION public.manages_user(_admin uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user AND admin_id = _admin)
$$;

CREATE OR REPLACE FUNCTION public.can_view_order(_uid uuid, _order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND (o.agent_id = _uid OR public.manages_user(_uid, o.agent_id))
  )
$$;

-- new-user trigger keeps the managing admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, admin_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), INITCAP(SPLIT_PART(COALESCE(NEW.email,''), '@', 1)), ''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'admin_id','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'agent'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- profiles
DROP POLICY IF EXISTS "own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admin insert profile" ON public.profiles;
DROP POLICY IF EXISTS "admin delete profile" ON public.profiles;

CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR has_role(auth.uid(),'super_admin') OR admin_id = auth.uid());

CREATE POLICY "update profiles" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR has_role(auth.uid(),'super_admin') OR admin_id = auth.uid())
WITH CHECK (id = auth.uid() OR has_role(auth.uid(),'super_admin') OR admin_id = auth.uid());

CREATE POLICY "insert profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));

CREATE POLICY "delete profiles" ON public.profiles FOR DELETE TO authenticated
USING (has_role(auth.uid(),'super_admin') OR admin_id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "own roles" ON public.user_roles;
CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), user_id));

-- products
DROP POLICY IF EXISTS "admin write products" ON public.products;
CREATE POLICY "super admin write products" ON public.products FOR ALL TO authenticated
USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- coupons
DROP POLICY IF EXISTS "admin write coupons" ON public.coupons;
CREATE POLICY "super admin write coupons" ON public.coupons FOR ALL TO authenticated
USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- customers
DROP POLICY IF EXISTS "agent own customers" ON public.customers;
CREATE POLICY "customer access" ON public.customers FOR ALL TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id))
WITH CHECK (agent_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id));

-- purchase_links
DROP POLICY IF EXISTS "agent own links" ON public.purchase_links;
CREATE POLICY "link access" ON public.purchase_links FOR ALL TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id))
WITH CHECK (agent_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id));

-- orders
DROP POLICY IF EXISTS "agent own orders" ON public.orders;
DROP POLICY IF EXISTS "admin update orders" ON public.orders;
CREATE POLICY "read orders" ON public.orders FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id));
CREATE POLICY "update orders" ON public.orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id))
WITH CHECK (has_role(auth.uid(),'super_admin') OR public.manages_user(auth.uid(), agent_id));
CREATE POLICY "super admin insert orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'super_admin'));

-- payments
DROP POLICY IF EXISTS "admin read payments" ON public.payments;
CREATE POLICY "read payments" ON public.payments FOR SELECT TO authenticated
USING (has_role(auth.uid(),'super_admin') OR public.can_view_order(auth.uid(), order_id));