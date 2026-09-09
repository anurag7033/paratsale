ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_latitude numeric,
  ADD COLUMN IF NOT EXISTS shipping_longitude numeric,
  ADD COLUMN IF NOT EXISTS shipping_location_accuracy numeric;