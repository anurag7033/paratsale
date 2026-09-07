CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), INITCAP(SPLIT_PART(COALESCE(NEW.email,''), '@', 1)), ''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'agent'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET name = COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), INITCAP(SPLIT_PART(COALESCE(u.email, p.email, ''), '@', 1)), ''),
    phone = COALESCE(p.phone, u.raw_user_meta_data->>'phone')
FROM auth.users u
WHERE u.id = p.id AND TRIM(COALESCE(p.name, '')) = '';