import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAdmin, deleteAgent } from "@/lib/agents.functions";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { StatusDot } from "@/components/order-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  beforeLoad: ({ context }) => {
    if ((context as { role?: string }).role !== "super_admin") throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Admin Accounts | Parat Haben Systems" },
      { name: "description", content: "Create and manage BPO admin accounts and the teams they run." },
      { property: "og:title", content: "Admin Accounts | Parat Haben Systems" },
      { property: "og:description", content: "Super admin control over every BPO admin account." },
    ],
  }),
  component: SuperAdmins,
});

const blank = { name: "", email: "", phone: "", password: "" };

function SuperAdmins() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const create = useServerFn(createAdmin);
  const removeFn = useServerFn(deleteAgent);

  const { data: admins } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("profiles").select("id,name,email,phone,status,created_at,admin_id"),
      ]);
      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles ?? [])
        .filter((p) => adminIds.has(p.id))
        .map((p) => ({
          ...p,
          agents: (profiles ?? []).filter((x) => x.admin_id === p.id).length,
        }));
    },
  });

  const addAdmin = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const email = form.email.trim().toLowerCase();
      const phone = form.phone.trim();
      if (name.length < 2) throw new Error("Please enter the admin's full name.");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))
        throw new Error("Please enter a valid email address, like name@company.com.");
      if (phone.replace(/\D/g, "").length < 6) throw new Error("Please enter a valid mobile number.");
      if (form.password.length < 8) throw new Error("The temporary password needs at least 8 characters.");
      return create({ data: { name, email, phone, password: form.password } });
    },
    onSuccess: () => {
      toast.success("Admin created — they can sign in immediately.");
      setOpen(false);
      setForm(blank);
      void qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admins"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdmin = useMutation({
    mutationFn: async (agentId: string) => removeFn({ data: { agentId } }),
    onSuccess: () => {
      toast.success("Admin removed");
      void qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Admins"
        description="BPO admins manage their own agents. You keep full visibility across every account."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New admin
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="overflow-x-auto p-4">
          {!admins?.length ? (
            <EmptyState title="No admins yet" description="Create a BPO admin to start building a team." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium">{a.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </TableCell>
                    <TableCell>{a.phone ?? "—"}</TableCell>
                    <TableCell>{a.agents}</TableCell>
                    <TableCell>{shortDate(a.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.status === "active"}
                          onCheckedChange={(v) => setStatus.mutate({ id: a.id, status: v ? "active" : "inactive" })}
                        />
                        <StatusDot active={a.status === "active"} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeAdmin.mutate(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Admin name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Temporary password (min 8 characters)</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addAdmin.mutate()} disabled={addAdmin.isPending}>
              Create admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
