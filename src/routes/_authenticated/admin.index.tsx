import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, Package, ShoppingCart, TrendingUp, Users, UserSquare2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState, StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, shortDate } from "@/lib/format";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Parat Haben Systems" },
      { name: "description", content: "Revenue, agents, products and order analytics for Parat Haben Systems." },
      { property: "og:title", content: "Admin Dashboard | Parat Haben Systems" },
      { property: "og:description", content: "Live sales analytics across every agent and product." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { role } = Route.useRouteContext() as { role?: string };
  const isSuper = role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", isSuper],
    queryFn: async () => {
      const [products, agents, customers, orders, people] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "agent"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select(
            "id, order_number, agent_id, quantity, final_amount, payment_method, payment_status, order_status, created_at, customers(name), products(name), profiles:agent_id(name)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, admin_id, commission_per_device"),
      ]);
      const rows = orders.data ?? [];
      const byId = new Map((people.data ?? []).map((p) => [p.id, p]));

      const commissionOf = (agentId: string | null) => {
        if (!agentId) return 0;
        const agent = byId.get(agentId);
        if (!agent) return 0;
        const owner = agent.admin_id ? byId.get(agent.admin_id) : null;
        return Number((owner ?? agent).commission_per_device ?? 0);
      };

      const settled = (o: (typeof rows)[number]) => o.order_status === "delivered" && o.payment_status === "paid";

      const valueOf = (o: (typeof rows)[number]) => {
        const commission = commissionOf(o.agent_id) * Number(o.quantity ?? 1);
        if (isSuper) {
          if (!(o.payment_status === "paid" || o.payment_method === "cod")) return 0;
          return Math.max(0, Number(o.final_amount) - (settled(o) ? commission : 0));
        }
        return settled(o) ? commission : 0;
      };

      const revenue = rows.reduce((sum, o) => sum + valueOf(o), 0);

      const byMonth = new Map<string, { month: string; revenue: number; orders: number }>();
      rows.forEach((o) => {
        const key = new Date(o.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const entry = byMonth.get(key) ?? { month: key, revenue: 0, orders: 0 };
        entry.revenue += valueOf(o);
        entry.orders += 1;
        byMonth.set(key, entry);
      });

      return {
        products: products.count ?? 0,
        agents: agents.count ?? 0,
        customers: customers.count ?? 0,
        orders: rows.length,
        revenue,
        recent: rows.slice(0, 8),
        chart: Array.from(byMonth.values()).reverse(),
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Everything happening across the Parat Haben Systems distribution network."
        action={<Badge variant="outline">Live data</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Products" value={data?.products ?? 0} icon={Package} loading={isLoading} />
        <StatCard label="Total Agents" value={data?.agents ?? 0} icon={Users} loading={isLoading} />
        <StatCard label="Total Customers" value={data?.customers ?? 0} icon={UserSquare2} loading={isLoading} />
        <StatCard label="Total Sales" value={data?.orders ?? 0} icon={ShoppingCart} loading={isLoading} hint="orders placed" />
        <StatCard
          label={isSuper ? "Net Revenue" : "My Commission"}
          value={inr(data?.revenue ?? 0)}
          icon={IndianRupee}
          loading={isLoading}
          hint={isSuper ? "after BPO commission" : "delivered & paid orders"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-accent" /> {isSuper ? "Net revenue by month" : "Commission by month"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="revenue" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Orders trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} allowDecimals={false} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recent.length ? (
            <EmptyState title="No orders yet" description="Orders appear here as agents convert their links." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                      <TableCell>{(o.customers as { name: string } | null)?.name ?? "—"}</TableCell>
                      <TableCell>{(o.profiles as { name: string } | null)?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {(o.products as { name: string } | null)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-semibold">{inr(o.final_amount)}</TableCell>
                      <TableCell>
                        <PaymentBadge method={o.payment_method} status={o.payment_status} />
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.order_status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{shortDate(o.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
