import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "super_admin" | "admin" | "agent";

async function roleOf(supabase: any, userId: string): Promise<Role | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
  return (data?.role as Role) ?? null;
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

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => accountSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, phone: data.phone, role: "admin" },
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
