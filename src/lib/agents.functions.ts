import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "super_admin" | "admin" | "agent";

const RANK: Record<Role, number> = { super_admin: 3, admin: 2, agent: 1 };

async function roleOf(supabase: any, userId: string): Promise<Role | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = ((data ?? []) as { role: Role }[]).map((r) => r.role).filter((r) => r in RANK);
  if (!roles.length) return null;
  return roles.sort((a, b) => RANK[b] - RANK[a])[0]!;
}

async function assertSuperAdmin(supabase: any, userId: string) {
  if ((await roleOf(supabase, userId)) !== "super_admin") throw new Error("Only a super admin can do this.");
}

const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(20),
  password: z.string().min(8).max(72),
});

export const createAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => accountSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await roleOf(context.supabase, context.userId);
    if (role !== "admin" && role !== "super_admin") throw new Error("Only admins can create agents.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        phone: data.phone,
        role: "agent",
        // Agents created by an admin belong to that admin.
        admin_id: role === "admin" ? context.userId : null,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const bpoSchema = accountSchema.extend({
  bpo_name: z.string().trim().min(2).max(160),
  bpo_contact_person: z.string().trim().max(120).optional().default(""),
  bpo_address: z.string().trim().max(240).optional().default(""),
  bpo_city: z.string().trim().max(80).optional().default(""),
  bpo_state: z.string().trim().max(80).optional().default(""),
  bpo_pincode: z.string().trim().max(12).optional().default(""),
});

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bpoSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        phone: data.phone,
        role: "admin",
        bpo_name: data.bpo_name,
        bpo_contact_person: data.bpo_contact_person,
        bpo_address: data.bpo_address,
        bpo_city: data.bpo_city,
        bpo_state: data.bpo_state,
        bpo_pincode: data.bpo_pincode,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ agentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const role = await roleOf(context.supabase, context.userId);
    if (role !== "admin" && role !== "super_admin") throw new Error("Only admins can remove accounts.");
    if (role === "admin") {
      // An admin may only remove their own agents.
      const { data: owned } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("id", data.agentId)
        .eq("admin_id", context.userId)
        .maybeSingle();
      if (!owned) throw new Error("You can only remove agents you created.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.agentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
