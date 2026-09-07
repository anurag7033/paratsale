import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agent/orders")({
  head: () => ({
    meta: [
      { title: "My Orders | Parat Haben Systems" },
      { name: "description", content: "Orders placed through your purchase links, with payment and delivery status." },
      { property: "og:title", content: "My Orders | Parat Haben Systems" },
      { property: "og:description", content: "Follow each order from payment to delivery." },
    ],
  }),
  component: AgentOrders,
});

const STAGES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function AgentOrders() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");

  const { data: orders } = useQuery({
    queryKey: ["agent-orders"],
    queryFn: async () => {
      const [{ data, error }, { data: products }, { data: customers }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name"),
        supabase.from("customers").select("id,name,phone,city"),
      ]);
      if (error) throw error;
      return (data ?? []).map((o) => ({
        ...o,
        productName: (products ?? []).find((p) => p.id === o.product_id)?.name ?? "—",
        customer: (customers ?? []).find((c) => c.id === o.customer_id) ?? null,
      }));
    },
  });

  const filtered = useMemo(
    () =>
      (orders ?? []).filter((o) => {
        if (stage !== "all" && o.order_status !== stage) return false;
        return `${o.order_number} ${o.customer?.name ?? ""} ${o.productName}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [orders, search, stage],
  );

  const revenue = filtered.reduce((s, o) => s + Number(o.final_amount), 0);

  return (
    <>
      <PageHeader title="My Orders" description="Only orders from your own purchase links appear here." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label>Search</Label>
            <Input
              placeholder="Order number, customer or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="overflow-x-auto p-4">
          {!filtered.length ? (
            <EmptyState title="No orders yet" description="Share a purchase link to receive your first order." />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {filtered.length} order{filtered.length === 1 ? "" : "s"} · {inr(revenue)} total value
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                      <TableCell>
                        <p className="font-medium">{o.customer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{o.customer?.city}</p>
                      </TableCell>
                      <TableCell>{o.productName}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
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
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
