import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAgent, deleteAgent } from "@/lib/agents.functions";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { StatusDot } from "@/components/order-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({
    meta: [
      { title: "Agent Management | Parat Haben Systems" },
      { name: "description", content: "Create agents, control account access and review each agent's sales." },
      { property: "og:title", content: "Agent Management | Parat Haben Systems" },
      { property: "og:description", content: "Searchable agent roster with customers, orders and revenue." },
    ],
  }),
  component: AdminAgents,
});

export type AgentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  customers: number;
  orders: number;
  revenue: number;
  pending: number;
  completed: number;
  bpo_name: string | null;
};

export async function loadAgentRows(): Promise<AgentRow[]> {
  const [{ data: roles }, { data: profiles }, { data: customers }, { data: orders }] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "agent"),
    supabase.from("profiles").select("id,name,email,phone,status,created_at,admin_id,bpo_name"),
    supabase.from("customers").select("id,agent_id"),
    supabase.from("orders").select("id,agent_id,final_amount,payment_status,order_status"),
  ]);
  const agentIds = new Set((roles ?? []).map((r) => r.user_id));
  return (profiles ?? [])
    .filter((p) => agentIds.has(p.id))
    .map((p) => {
      const own = (orders ?? []).filter((o) => o.agent_id === p.id);
      const owner = (profiles ?? []).find((x) => x.id === p.admin_id);
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        status: p.status,
        created_at: p.created_at,
        bpo_name: owner?.bpo_name ?? p.bpo_name ?? null,
        customers: (customers ?? []).filter((c) => c.agent_id === p.id).length,
        orders: own.length,
        revenue: own.reduce((s, o) => s + Number(o.final_amount), 0),
        pending: own.filter((o) => ["pending", "confirmed", "processing"].includes(o.order_status)).length,
        completed: own.filter((o) => o.order_status === "delivered").length,
      };
    });
}

const blank = { name: "", email: "", phone: "", password: "" };

function AdminAgents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [detail, setDetail] = useState<AgentRow | null>(null);
  const create = useServerFn(createAgent);
  const removeFn = useServerFn(deleteAgent);

  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: loadAgentRows });

  const addAgent = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const email = form.email.trim().toLowerCase();
      const phone = form.phone.trim();
      if (name.length < 2) throw new Error("Please enter the agent's full name.");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error("Please enter a valid email address, like name@company.com.");
      if (phone.replace(/\D/g, "").length < 6) throw new Error("Please enter a valid mobile number.");
      if (form.password.length < 8) throw new Error("The temporary password needs at least 8 characters.");
      return create({ data: { name, email, phone, password: form.password } });
    },
    onSuccess: () => {
      toast.success("Agent created — they can sign in immediately.");
      setOpen(false);
      setForm(blank);
      void qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agents"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAgent = useMutation({
    mutationFn: async (agentId: string) => removeFn({ data: { agentId } }),
    onSuccess: () => {
      toast.success("Agent removed");
      void qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (agents ?? []).filter((a) =>
    `${a.name} ${a.email} ${a.phone ?? ""} ${a.bpo_name ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Agents"
        description="Every field agent, their book of customers and the revenue they generate."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New agent
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Input
            className="max-w-sm"
            placeholder="Search agents by name, email, phone or BPO…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-4 overflow-x-auto">
            {!filtered.length ? (
              <EmptyState title="No agents found" description="Create an agent to start distributing links." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Agent ID</TableHead>
                    <TableHead>BPO</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetail(a)}>
                      <TableCell>
                        <p className="font-medium">{a.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">AGT-{a.id.slice(0, 6).toUpperCase()}</TableCell>
                      <TableCell>{a.bpo_name || "—"}</TableCell>
                      <TableCell>{a.phone ?? "—"}</TableCell>
                      <TableCell>{a.customers}</TableCell>
                      <TableCell>{a.orders}</TableCell>
                      <TableCell className="font-semibold">{inr(a.revenue)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={a.status === "active"}
                            onCheckedChange={(v) => setStatus.mutate({ id: a.id, status: v ? "active" : "inactive" })}
                          />
                          <StatusDot active={a.status === "active"} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeAgent.mutate(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agent name</Label>
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
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addAgent.mutate()} disabled={addAgent.isPending}>
              Create agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detail?.name}</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Agent ID", `AGT-${detail.id.slice(0, 6).toUpperCase()}`],
                  ["Email", detail.email],
                  ["Phone", detail.phone ?? "—"],
                  ["Joined", shortDate(detail.created_at)],
                  ["Customers", String(detail.customers)],
                  ["Orders", String(detail.orders)],
                  ["Pending orders", String(detail.pending)],
                  ["Completed orders", String(detail.completed)],
                  ["Revenue generated", inr(detail.revenue)],
                  ["Account status", detail.status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 font-medium break-words">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
