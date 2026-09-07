import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Loader2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { getCheckout, placeOrder, verifyPayment } from "@/lib/commerce.functions";
import { BrandLockup } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { couponDiscount, inr, isCodEligible } from "@/lib/format";

const checkoutQuery = (token: string) =>
  queryOptions({
    queryKey: ["checkout", token],
    queryFn: () => getCheckout({ data: { token } }),
    staleTime: 0,
  });

export const Route = createFileRoute("/buy/$token")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(checkoutQuery(params.token)),
  head: () => ({
    meta: [
      { title: "Secure Checkout | Parat Haben Systems" },
      { name: "description", content: "Complete your Parat Haben Systems order with online payment or cash on delivery." },
      { property: "og:title", content: "Secure Checkout | Parat Haben Systems" },
      { property: "og:description", content: "Personal checkout link with your delivery details pre-filled." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function Checkout() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(checkoutQuery(token));
  const submitOrder = useServerFn(placeOrder);
  const confirmPayment = useServerFn(verifyPayment);

  const customer = data.found ? data.customer : null;
  const product = data.found ? data.product : null;

  const [form, setForm] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    city: customer?.city ?? "",
    state: customer?.state || "Uttar Pradesh",
    pincode: customer?.pincode ?? "",
  });
  const [quantity, setQuantity] = useState(1);
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [method, setMethod] = useState("razorpay");
  const [busy, setBusy] = useState(false);

  if (!data.found || !product || data.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">This link is no longer active</h1>
          <p className="mt-2 text-muted-foreground">
            Please contact your Parat Haben sales agent for a fresh purchase link.
          </p>
        </div>
      </div>
    );
  }

  const subtotal = Number(product.selling_price) * quantity;
  const appliedCoupon = applied ? (data.coupons ?? []).find((c) => c.code === applied.code) : undefined;
  const discount = appliedCoupon ? (couponDiscount(appliedCoupon, subtotal).discount ?? 0) : 0;
  const total = Math.max(0, subtotal - discount);
  const codAllowed = isCodEligible(form.city, form.pincode);

  function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    const coupon = (data.found ? data.coupons : []).find((c) => c.code === code);
    if (!coupon) {
      toast.error("That coupon code is not valid.");
      return;
    }
    const result = couponDiscount(coupon, subtotal);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setApplied({ code, discount: result.discount ?? 0 });
    toast.success(`${code} applied — you saved ${inr(result.discount ?? 0)}`);
  }

  async function submit() {
    setBusy(true);
    try {
      const payment = method === "cod" ? "cod" : "razorpay";
      const result = await submitOrder({
        data: {
          token,
          quantity,
          couponCode: applied?.code ?? null,
          paymentMethod: payment,
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
        },
      });

      if (result.mode === "cod") {
        toast.success("Order confirmed — pay cash on delivery.");
        void navigate({ to: "/order/$orderNumber", params: { orderNumber: result.orderNumber } });
        return;
      }

      if (result.mode === "razorpay_unconfigured") {
        toast.success("Order placed. Online payment isn't switched on yet, so your agent will confirm payment.");
        void navigate({ to: "/order/$orderNumber", params: { orderNumber: result.orderNumber } });
        return;
      }

      const ready = await loadRazorpay();
      if (!ready) {
        toast.error("Could not load the payment window. Please try again.");
        return;
      }
      const Razorpay = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: result.keyId,
        amount: Math.round(result.amount * 100),
        currency: "INR",
        name: "Parat Haben Systems",
        description: product!.name,
        order_id: result.razorpayOrderId,
        prefill: { name: form.name, contact: form.phone, email: form.email || undefined },
        theme: { color: "#1b2a5e" },
        handler: async (response: RazorpayResponse) => {
          try {
            await confirmPayment({ data: { orderId: result.orderId, ...response } });
            toast.success("Payment successful");
            void navigate({ to: "/order/$orderNumber", params: { orderNumber: result.orderNumber } });
          } catch {
            toast.error("We could not verify the payment. Please contact your agent.");
          }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <BrandLockup />
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Secure checkout
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Delivery details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, product.stock)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Payment method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={method} onValueChange={setMethod} className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                  <RadioGroupItem value="razorpay" id="pay-online" className="mt-1" />
                  <div>
                    <p className="font-medium">Pay online</p>
                    <p className="text-sm text-muted-foreground">
                      UPI, cards, netbanking and wallets through Razorpay.
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    codAllowed ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <RadioGroupItem value="cod" id="pay-cod" disabled={!codAllowed} className="mt-1" />
                  <div>
                    <p className="font-medium">Cash on delivery</p>
                    <p className="text-sm text-muted-foreground">
                      {codAllowed
                        ? "Pay in cash when the order reaches you."
                        : "Available only for deliveries inside Lucknow."}
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {(product.images as string[])?.[0] ? (
                    <img
                      src={(product.images as string[])[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PackageCheck className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-muted-foreground">
                    {inr(product.selling_price)} × {quantity}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {product.stock} in stock
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="inline-flex items-center gap-2">
                  <BadgePercent className="h-4 w-4" /> Coupon code
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  />
                  <Button variant="outline" onClick={applyCoupon}>
                    Apply
                  </Button>
                </div>
                {applied && (
                  <p className="text-xs text-primary">
                    {applied.code} applied.{" "}
                    <button className="underline" onClick={() => setApplied(null)}>
                      Remove
                    </button>
                  </p>
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{inr(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount</span>
                    <span>-{inr(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total payable</span>
                  <span>{inr(total)}</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={() => void submit()} disabled={busy || product.stock < 1}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {method === "cod" ? "Place COD order" : `Pay ${inr(total)}`}
              </Button>
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" /> Dispatched within 2 working days
              </p>
            </CardContent>
          </Card>

          {data.agent && (
            <Card>
              <CardContent className="p-5 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your agent</p>
                <p className="mt-1 font-medium">{data.agent.name}</p>
                {data.agent.phone && <p className="text-muted-foreground">{data.agent.phone}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
