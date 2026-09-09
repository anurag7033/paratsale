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

const RANK: Record<Role, number> = { super_admin: 3, admin: 2, agent: 1 };

export function highestRole(roles: (string | null | undefined)[]): Role | null {
  const valid = roles.filter((r): r is Role => r === "super_admin" || r === "admin" || r === "agent");
  if (!valid.length) return null;
  return valid.reduce((best, r) => (RANK[r] > RANK[best] ? r : best));
}

export async function fetchRole(userId: string): Promise<Role | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return highestRole((data ?? []).map((r) => r.role));
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
