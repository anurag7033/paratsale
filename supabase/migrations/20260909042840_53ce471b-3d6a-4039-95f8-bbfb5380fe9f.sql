ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_admin_id_idx ON public.profiles(admin_id);