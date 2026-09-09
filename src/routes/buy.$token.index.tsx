import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgePercent,
  Building2,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Star,
  Truck,
  User,
} from "lucide-react";
import { getCheckout } from "@/lib/commerce.functions";
import { BrandLockup } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/format";

const checkoutQuery = (token: string) =>
  queryOptions({
    queryKey: ["checkout", token],
    queryFn: () => getCheckout({ data: { token } }),
    staleTime: 0,
  });

export const Route = createFileRoute("/buy/$token/")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(checkoutQuery(params.token)),
  head: () => ({
    meta: [
      { title: "Your Product | Parat Haben Systems" },
      {
        name: "description",
        content: "Product details, specifications and pricing shared by your Parat Haben Systems sales agent.",
      },
      { property: "og:title", content: "Your Product | Parat Haben Systems" },
      { property: "og:description", content: "See full product details before you buy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductLinkPage,
});

function ProductLinkPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(checkoutQuery(token));
  const [activeImage, setActiveImage] = useState(0);

  const product = data.found ? data.product : null;

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <BrandLockup />
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Secure purchase link
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
            <Button size="lg" className="w-full sm:w-auto" disabled={product.stock < 1} asChild={product.stock > 0}>
              {product.stock > 0 ? (
                <Link to="/buy/$token/checkout" params={{ token }}>
                  Buy now — {inr(product.selling_price)}
                </Link>
              ) : (
                <span>Out of stock</span>
              )}
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

      {data.agent && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <Card>
            <CardContent className="p-5 text-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your agent</p>
              <p className="mt-1 font-medium">{data.agent.name}</p>
              {data.agent.phone && <p className="text-muted-foreground">{data.agent.phone}</p>}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur sm:hidden">
        <Button className="w-full" size="lg" disabled={product.stock < 1} asChild={product.stock > 0}>
          {product.stock > 0 ? (
            <Link to="/buy/$token/checkout" params={{ token }}>
              Buy now — {inr(product.selling_price)}
            </Link>
          ) : (
            <span>Out of stock</span>
          )}
        </Button>
      </div>
    </div>
  );
}
