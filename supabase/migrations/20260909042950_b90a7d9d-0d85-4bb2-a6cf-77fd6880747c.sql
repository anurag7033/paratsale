REVOKE ALL ON FUNCTION public.manages_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manages_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_order(uuid, uuid) TO authenticated;