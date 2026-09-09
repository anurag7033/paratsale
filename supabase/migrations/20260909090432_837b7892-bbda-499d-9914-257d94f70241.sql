ALTER TABLE public.purchase_links ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0;