-- roles
CREATE TYPE public.app_role AS ENUM ('admin','agent');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  original_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'General',
  stock integer NOT NULL DEFAULT 0,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active products" ON public.products FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent own customers" ON public.customers FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  minimum_purchase numeric(12,2) NOT NULL DEFAULT 0,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  expiry_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active coupons" ON public.coupons FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "auth read coupons" ON public.coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- purchase links
CREATE TABLE public.purchase_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_token text NOT NULL UNIQUE,
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  visits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchase_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_links TO authenticated;
GRANT ALL ON public.purchase_links TO service_role;
ALTER TABLE public.purchase_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read link by token" ON public.purchase_links FOR SELECT TO anon USING (true);
CREATE POLICY "agent own links" ON public.purchase_links FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('PHS-' || upper(substr(md5(random()::text),1,8))),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  purchase_link_id uuid REFERENCES public.purchase_links(id) ON DELETE SET NULL,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'razorpay',
  payment_status text NOT NULL DEFAULT 'pending',
  order_status text NOT NULL DEFAULT 'pending',
  shipping_address text NOT NULL DEFAULT '',
  shipping_city text NOT NULL DEFAULT '',
  shipping_state text NOT NULL DEFAULT '',
  shipping_pincode text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent own orders" ON public.orders FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  razorpay_order_id text,
  razorpay_payment_id text,
  payment_status text NOT NULL DEFAULT 'created',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'agent'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed products
INSERT INTO public.products (name, slug, description, images, original_price, selling_price, category, stock, specifications, status) VALUES
('PHS Industrial PLC Controller X200','phs-plc-controller-x200','Compact programmable logic controller for industrial automation lines. 24 digital I/O, Modbus RTU + Ethernet, DIN-rail mount, wide temperature range.','{https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200}',24999,19999,'Automation',48,'{"IO Channels":"24 (16 DI / 8 DO)","Protocols":"Modbus RTU, Ethernet/IP","Supply":"24V DC","Warranty":"24 months"}','active'),
('PHS Soldering Station Pro 90W','phs-soldering-station-pro-90w','Temperature-controlled digital soldering station with ceramic heater, 90W output and rapid heat-up for electronics assembly benches.','{https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=1200}',8999,6499,'Electronics',120,'{"Power":"90W","Temp Range":"100-480 C","Heat-up":"8 seconds","Warranty":"12 months"}','active'),
('PHS Servo Drive Kit 750W','phs-servo-drive-kit-750w','Complete AC servo motor and drive kit with encoder feedback for precision motion control in CNC and pick-and-place machines.','{https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200}',54999,46999,'Automation',22,'{"Rated Power":"750W","Encoder":"17-bit absolute","Torque":"2.39 Nm","Warranty":"18 months"}','active'),
('PHS IoT Sensor Gateway G4','phs-iot-sensor-gateway-g4','Edge gateway that aggregates up to 32 industrial sensors and streams data over 4G or Ethernet to your dashboards.','{https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200}',18999,14999,'Innovation',60,'{"Sensor Inputs":"32","Connectivity":"4G LTE, Ethernet, WiFi","Storage":"8GB local buffer","Warranty":"12 months"}','active');

INSERT INTO public.coupons (code, discount_type, discount_value, minimum_purchase, usage_limit, expiry_date, status) VALUES
('WELCOME10','percentage',10,5000,100,(now() + interval '90 days')::date,'active'),
('FLAT2000','fixed',2000,20000,50,(now() + interval '60 days')::date,'active'),
('FESTIVE15','percentage',15,10000,200,(now() + interval '30 days')::date,'active');