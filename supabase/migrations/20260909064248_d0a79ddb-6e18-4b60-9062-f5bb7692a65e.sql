ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_per_device numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, admin_id, bpo_name, bpo_contact_person, bpo_address, bpo_city, bpo_state, bpo_pincode, commission_per_device)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), INITCAP(SPLIT_PART(COALESCE(NEW.email,''), '@', 1)), ''),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'admin_id','')::uuid,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_name','')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_contact_person','')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_address','')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_city','')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_state','')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'bpo_pincode','')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'commission_per_device','')), '')::numeric, 0)
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'agent'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;