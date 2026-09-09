import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download } from "lucide-react";
import { getOrderSummary } from "@/lib/commerce.functions";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dateTime, inr } from "@/lib/format";

const summaryQuery = (orderNumber: string) =>
  queryOptions({
    queryKey: ["order-summary", orderNumber],
    queryFn: () => getOrderSummary({ data: { orderNumber } }),
  });

export const Route = createFileRoute("/order/$orderNumber")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(summaryQuery(params.orderNumber)),
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderNumber} | Parat Haben Systems` },
      { name: "description", content: "Your Parat Haben Systems order confirmation and delivery details." },
      { property: "og:title", content: `Order ${params.orderNumber} | Parat Haben Systems` },
      { property: "og:description", content: "Order confirmation with payment status and delivery address." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { orderNumber } = Route.useParams();
  const { data } = useSuspenseQuery(summaryQuery(orderNumber));

  if (!data.found) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Order not found</h1>
          <p className="mt-2 text-muted-foreground">Check the order number in your confirmation message.</p>
        </div>
      </div>
    );
  }

  const { order, product, agent } = data;
  const paid = order.payment_status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <BrandLockup />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            {paid ? (
              <CheckCircle2 className="h-7 w-7 text-primary" />
            ) : (
              <Clock className="h-7 w-7 text-accent-foreground" />
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {paid ? "Payment received" : "Order placed"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {order.payment_method === "cod"
              ? "Pay in cash when your order is delivered."
              : paid
                ? "Your payment has been confirmed."
                : "We are waiting for your payment to be confirmed."}
          </p>
          <p className="mt-4 inline-block rounded-full bg-muted px-4 py-1.5 font-mono text-sm font-semibold">
            {order.order_number}
          </p>
        </div>

        <Card className="mt-8 shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-6 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold">{product?.name}</p>
                <p className="text-muted-foreground">Quantity: {order.quantity}</p>
              </div>
              <p className="font-semibold">{inr(order.total_amount)}</p>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-primary">
                <span>Coupon discount</span>
                <span>-{inr(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping charges</span>
              <span>{Number(order.shipping_amount) > 0 ? inr(order.shipping_amount) : "Free"}</span>
            </div>
            <div className="flex justify-between border-t pt-4 text-lg font-bold">
              <span>Total</span>
              <span>{inr(order.final_amount)}</span>
            </div>
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Delivering to</p>
                <p className="mt-1">
                  {order.shipping_address}, {order.shipping_city}, {order.shipping_state} — {order.shipping_pincode}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
                <p className="mt-1 capitalize">
                  {order.payment_method === "cod" ? "Cash on delivery" : "Online payment"} · {order.payment_status}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Placed</p>
                <p className="mt-1">{dateTime(order.created_at)}</p>
              </div>
            </div>
            {agent && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your agent</p>
                <p className="mt-1 font-medium">{agent.name}</p>
                {agent.phone && <p className="text-muted-foreground">{agent.phone}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/invoice/$orderNumber" params={{ orderNumber: order.order_number }}>
              <Download className="h-4 w-4" /> Download invoice
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
