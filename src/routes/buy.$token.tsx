import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  BadgePercent,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
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
  const [activeImage, setActiveImage] = useState(0);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

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

  const images = ((product.images as string[] | null) ?? []).filter(Boolean);
  const specs = Object.entries((product.specifications ?? {}) as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== "" && typeof v !== "object",
  );
  const subtotal = Number(product.selling_price) * quantity;
  const listTotal = Number(product.original_price || product.selling_price) * quantity;
  const savingsOnList = Math.max(0, listTotal - subtotal);
  const appliedCoupon = applied ? (data.coupons ?? []).find((c) => c.code === applied.code) : undefined;
  const discount = appliedCoupon ? (couponDiscount(appliedCoupon, subtotal).discount ?? 0) : 0;
  const total = Math.max(0, subtotal - discount);
  const codAllowed = isCodEligible(form.city, form.pincode);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Your browser cannot share location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy ?? 0),
        });
        setLocating(false);
        toast.success("Location captured — this helps us deliver faster.");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Please allow location access in your browser and try again."
            : "Could not fetch your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

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

  function validate() {
    if (form.name.trim().length < 2) return "Please enter your full name.";
    if (form.phone.trim().length < 6) return "Please enter a valid phone number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      return "Please enter a valid email address or leave it blank.";
    if (form.address.trim().length < 5) return "Please enter your full delivery address.";
    if (form.city.trim().length < 2) return "Please enter your city.";
    if (form.state.trim().length < 2) return "Please enter your state.";
    if (!/^\d{6}$/.test(form.pincode.trim())) return "Please enter a valid 6 digit pincode.";
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const payment = method === "cod" ? "cod" : "razorpay";
      const result = await submitOrder({
        data: {
          token,
          quantity,
          couponCode: applied?.code ?? null,
          paymentMethod: payment,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          locationAccuracy: coords?.accuracy ?? null,
        },
      });

      if (result.mode === "cod") {
        toast.success("Order confirmed — pay cash on delivery.");
        void navigate({ to: "/invoice/$orderNumber", params: { orderNumber: result.orderNumber } });
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
            toast.success("Payment successful — here is your invoice.");
            void navigate({ to: "/invoice/$orderNumber", params: { orderNumber: result.orderNumber } });
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
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <BrandLockup />
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Secure checkout
          </span>
        </div>
      </header>

      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border bg-muted shadow-[var(--shadow-card)]">
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <PackageCheck className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.slice(0, 5).map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                      i === activeImage ? "border-primary" : "border-transparent opacity-70"
                    }`}
                  >
                    <img src={src} alt={`${product.name} view ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <Badge variant="secondary">{product.category}</Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex text-amber-500">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </span>
              Trusted by customers across India
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-3xl font-bold">{inr(product.selling_price)}</span>
              {Number(product.original_price) > Number(product.selling_price) && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{inr(product.original_price)}</span>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    Save {inr(Number(product.original_price) - Number(product.selling_price))}
                  </Badge>
                </>
              )}
            </div>
            <p className="whitespace-pre-line text-muted-foreground">{product.description}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Truck, text: "Dispatched within 2 working days" },
                { icon: ShieldCheck, text: "Genuine product warranty" },
                { icon: CheckCircle2, text: `${product.stock} units in stock` },
                { icon: BadgePercent, text: "Coupon discounts supported" },
              ].map(({ icon: Icon, text }) => (
                <p key={text} className="inline-flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary" /> {text}
                </p>
              ))}
            </div>
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href="#buy">Buy now — {inr(product.selling_price)}</a>
            </Button>
          </div>
        </div>
      </section>

      {specs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold">Specifications</h2>
          <div className="mt-4 grid gap-x-8 gap-y-3 rounded-xl border bg-card p-6 sm:grid-cols-2">
            {specs.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-dashed py-2 text-sm last:border-0">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                <span className="text-right font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <main id="buy" className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 pt-4 lg:grid-cols-[1.2fr_1fr]">
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

              <div className="space-y-2 rounded-lg border bg-muted/40 p-4 sm:col-span-2">
                <p className="inline-flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" /> Share your exact location
                </p>
                <p className="text-xs text-muted-foreground">
                  Helps our delivery team reach your doorstep without calling for directions.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={captureLocation} disabled={locating}>
                    {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
                    {coords ? "Update my location" : "Use my current location"}
                  </Button>
                  {coords && (
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {coords.lat}, {coords.lng} (±{coords.accuracy} m)
                    </span>
                  )}
                </div>
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
          <Card className="shadow-[var(--shadow-card)] lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {images[0] ? (
                    <img src={images[0]} alt={product.name} className="h-full w-full object-cover" />
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
                {savingsOnList > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Price saving</span>
                    <span>-{inr(savingsOnList)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Coupon discount</span>
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
                <Truck className="h-3.5 w-3.5" /> Invoice is generated instantly after payment
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
