import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Link2, ShoppingCart, UserSquare2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { StatCard, EmptyState } from "@/components/stat-card";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSession } from "@/lib/session";
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agent/")({
  head: () => ({
    meta: [
      { title: "Agent Workspace | Parat Haben Systems" },
      { name: "description", content: "Your customers, purchase links, orders and commissionable revenue." },
      { property: "og:title", content: "Agent Workspace | Parat Haben Systems" },
      { property: "og:description", content: "Track your own sales performance in real time." },
    ],
  }),
  component: AgentHome,
});

function AgentHome() {
  const { session, name } = useAppSession();
  const agentId = session?.user.id;

  const { data } = useQuery({
    enabled: !!agentId,
    queryKey: ["agent-home", agentId],
    queryFn: async () => {
      const [{ data: customers }, { data: links }, { data: orders }, { data: products }] = await Promise.all([
        supabase.from("customers").select("id,name"),
        supabase.from("purchase_links").select("id,status"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name"),
      ]);
      return {
        customers: customers ?? [],
        links: links ?? [],
        orders: (orders ?? []).map((o) => ({
          ...o,
          customerName: (customers ?? []).find((c) => c.id === o.customer_id)?.name ?? "—",
          productName: (products ?? []).find((p) => p.id === o.product_id)?.name ?? "—",
        })),
      };
    },
  });

  const orders = data?.orders ?? [];
  const revenue = orders.reduce((s, o) => s + Number(o.final_amount), 0);
  const paid = orders.filter((o) => o.payment_status === "paid");

  const byMonth = orders.reduce<Record<string, number>>((acc, o) => {
    const key = new Date(o.created_at).toLocaleDateString("en-IN", { month: "short" });
    acc[key] = (acc[key] ?? 0) + Number(o.final_amount);
    return acc;
  }, {});
  const chart = Object.entries(byMonth).map(([month, value]) => ({ month, value }));

  return (
    <>
      <PageHeader
        title={`Welcome back${name ? `, ${name.split(" ")[0]}` : ""}`}
        description="Everything you sell, in one workspace."
        action={
          <Button asChild>
            <Link to="/agent/links">
              <Link2 className="mr-2 h-4 w-4" /> Create purchase link
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My customers" value={String(data?.customers.length ?? 0)} icon={UserSquare2} />
        <StatCard label="Purchase links" value={String(data?.links.length ?? 0)} icon={Link2} />
        <StatCard label="My orders" value={String(orders.length)} icon={ShoppingCart} />
        <StatCard label="Revenue generated" value={inr(revenue)} icon={IndianRupee} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">My sales by month</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {!chart.length ? (
              <EmptyState title="No sales yet" description="Share a purchase link to get your first order." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Payments received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid orders</span>
              <span className="font-semibold">{paid.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collected</span>
              <span className="font-semibold">{inr(paid.reduce((s, o) => s + Number(o.final_amount), 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Awaiting payment</span>
              <span className="font-semibold">{orders.length - paid.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!orders.length ? (
            <EmptyState title="No orders yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 8).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>{o.productName}</TableCell>
                    <TableCell className="font-semibold">{inr(o.final_amount)}</TableCell>
                    <TableCell>
                      <PaymentBadge status={o.payment_status} method={o.payment_method} />
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.order_status} />
                    </TableCell>
                    <TableCell>{shortDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
