import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { OrderStatusBadge, PaymentBadge } from "@/components/order-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Order Management | Parat Haben Systems" },
      { name: "description", content: "Track every order, payment status and delivery stage in one place." },
      { property: "og:title", content: "Order Management | Parat Haben Systems" },
      { property: "og:description", content: "Update order stages and review full order details." },
    ],
  }),
  component: AdminOrders,
});

const STAGES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export function useOrdersQuery(agentId?: string) {
  return useQuery({
    queryKey: ["orders", agentId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (agentId) query = query.eq("agent_id", agentId);
      const [
        { data: orders, error },
        { data: products },
        { data: customers },
        { data: profiles },
        { data: coupons },
      ] = await Promise.all([
        query,
        supabase.from("products").select("id,name,slug"),
        supabase.from("customers").select("id,name,phone,city,address,pincode"),
        supabase.from("profiles").select("id,name,email"),
        supabase.from("coupons").select("id,code"),
      ]);
      if (error) throw error;
      return (orders ?? []).map((o) => ({
        ...o,
        product: (products ?? []).find((p) => p.id === o.product_id) ?? null,
        customer: (customers ?? []).find((c) => c.id === o.customer_id) ?? null,
        agent: (profiles ?? []).find((p) => p.id === o.agent_id) ?? null,
        coupon_code: (coupons ?? []).find((c) => c.id === o.coupon_id)?.code ?? null,
      }));
    },
  });
}

export type OrderRow = NonNullable<ReturnType<typeof useOrdersQuery>["data"]>[number];

function AdminOrders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const { data: orders } = useOrdersQuery();

  const setStage = useMutation({
    mutationFn: async ({ id, order_status }: { id: string; order_status: string }) => {
      const { error } = await supabase.from("orders").update({ order_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order stage updated");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      (orders ?? []).filter((o) => {
        if (status !== "all" && o.order_status !== status) return false;
        if (payment !== "all" && o.payment_status !== payment) return false;
        const haystack = `${o.order_number} ${o.customer?.name ?? ""} ${o.customer?.phone ?? ""} ${o.product?.name ?? ""} ${o.agent?.name ?? ""}`;
        return haystack.toLowerCase().includes(search.toLowerCase());
      }),
    [orders, search, status, payment],
  );

  return (
    <>
      <PageHeader title="Orders" description="Every order placed through agent links, with live payment status." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Order no., customer, product, agent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Order stage</Label>
            <Select value={status} onValueChange={setStatus}>
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
          <div className="space-y-2">
            <Label>Payment</Label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["all", "pending", "paid", "failed", "cod_pending"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All payments" : s.replace("_", " ")}
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
            <EmptyState title="No orders match" description="Try clearing the filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Placed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetail(o)}>
                    <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                    <TableCell>
                      <p className="font-medium">{o.customer?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{o.customer?.phone}</p>
                    </TableCell>
                    <TableCell>{o.product?.name ?? "—"}</TableCell>
                    <TableCell>{o.agent?.name ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{inr(o.final_amount)}</TableCell>
                    <TableCell>
                      <PaymentBadge status={o.payment_status} method={o.payment_method} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={o.order_status}
                        onValueChange={(v) => setStage.mutate({ id: o.id, order_status: v })}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{shortDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-mono">{detail?.order_number}</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 p-4 text-sm">
              <div className="flex gap-2">
                <OrderStatusBadge status={detail.order_status} />
                <PaymentBadge status={detail.payment_status} method={detail.payment_method} />
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p className="font-semibold">{detail.product?.name}</p>
                <p className="text-muted-foreground">Quantity: {detail.quantity}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{inr(detail.total_amount)}</span>
                </div>
                {Number(detail.discount_amount) > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount {detail.coupon_code ? `(${detail.coupon_code})` : ""}</span>
                    <span>-{inr(detail.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{inr(detail.final_amount)}</span>
                </div>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Delivery details
                </p>
                <p className="font-medium">{detail.customer?.name}</p>
                <p>{detail.customer?.phone}</p>
                <p className="text-muted-foreground">
                  {detail.customer?.address}, {detail.customer?.city} — {detail.customer?.pincode}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Agent</p>
                <p className="font-medium">{detail.agent?.name}</p>
                <p className="text-muted-foreground">{detail.agent?.email}</p>
              </div>
              <p className="text-xs text-muted-foreground">Placed {dateTime(detail.created_at)}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
