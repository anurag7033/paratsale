import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type Role = "super_admin" | "admin" | "agent";

export type AppSession = {
  loading: boolean;
  session: Session | null;
  role: Role | null;
  name: string;
  email: string;
};

export async function fetchRole(userId: string): Promise<Role | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.role as Role) ?? null;
}

export function useAppSession(): AppSession {
  const [state, setState] = useState<AppSession>({
    loading: true,
    session: null,
    role: null,
    name: "",
    email: "",
  });

  useEffect(() => {
    let active = true;

    const hydrate = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ loading: false, session: null, role: null, name: "", email: "" });
        return;
      }
      const [role, profile] = await Promise.all([
        fetchRole(session.user.id),
        supabase.from("profiles").select("name,email").eq("id", session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      setState({
        loading: false,
        session,
        role,
        name: profile.data?.name || session.user.email || "",
        email: profile.data?.email || session.user.email || "",
      });
    };

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrate(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export const homeFor = (role: Role | null) =>
  role === "super_admin" || role === "admin" ? "/admin" : role === "agent" ? "/agent" : "/auth";
