import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { loadAgentRows } from "./admin.agents";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({
    meta: [
      { title: "Agent Sales Tracking | Parat Haben Systems" },
      { name: "description", content: "Track sales, revenue and order status by agent with date filters." },
      { property: "og:title", content: "Agent Sales Tracking | Parat Haben Systems" },
      { property: "og:description", content: "Compare agent performance across any date range." },
    ],
  }),
  component: AdminSales,
});

function AdminSales() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  const { data: agents } = useQuery({ queryKey: ["agents"], queryFn: loadAgentRows });
  const { data: orders } = useQuery({
    queryKey: ["all-orders-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, agent_id, final_amount, order_status, payment_status, created_at, customer_id");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const filtered = (orders ?? []).filter((o) => {
      if (from && new Date(o.created_at) < new Date(from)) return false;
      if (to && new Date(o.created_at) > new Date(`${to}T23:59:59`)) return false;
      if (agentFilter !== "all" && o.agent_id !== agentFilter) return false;
      return true;
    });
    return (agents ?? [])
      .filter((a) => agentFilter === "all" || a.id === agentFilter)
      .map((a) => {
        const own = filtered.filter((o) => o.agent_id === a.id);
        return {
          id: a.id,
          name: a.name || a.email,
          customers: new Set(own.map((o) => o.customer_id)).size,
          orders: own.length,
          revenue: own.reduce((s, o) => s + Number(o.final_amount), 0),
          pending: own.filter((o) => ["pending", "confirmed", "processing", "shipped"].includes(o.order_status)).length,
          completed: own.filter((o) => o.order_status === "delivered").length,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, agents, from, to, agentFilter]);

  return (
    <>
      <PageHeader title="Agent Sales Tracking" description="Filter by agent and date to compare performance." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>From date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Agent</Label>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {(agents ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base">Revenue by agent</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!rows.length ? (
            <EmptyState title="Nothing to chart yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? "var(--chart-1)" : "var(--chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-[var(--shadow-card)]">
        <CardContent className="overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total sales</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.customers}</TableCell>
                  <TableCell>{r.orders}</TableCell>
                  <TableCell className="font-semibold">{inr(r.revenue)}</TableCell>
                  <TableCell>{r.pending}</TableCell>
                  <TableCell>{r.completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
