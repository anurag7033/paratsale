import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLockup } from "@/components/brand";
import { inr } from "@/lib/format";

const getProduct = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabasePublic = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: product } = await supabasePublic
      .from("products")
      .select("name, slug, description, images, original_price, selling_price, category, stock, specifications")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    return product;
  });

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-product", slug],
    queryFn: () => getProduct({ data: { slug } }),
  });

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params, context }) => {
    const product = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Product unavailable | Parat Haben Systems" }, { name: "robots", content: "noindex" }] };
    }
    const { product } = loaderData;
    const description = (product.description as string).slice(0, 155) || `Buy ${product.name} from Parat Haben Systems.`;
    return {
      meta: [
        { title: `${product.name} | Parat Haben Systems` },
        { name: "description", content: description },
        { property: "og:title", content: `${product.name} | Parat Haben Systems` },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">This product may have been removed or is not currently on sale.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQuery(slug));
  if (!product) return null;

  const savings = Number(product.original_price) - Number(product.selling_price);
  const specs = Object.entries((product.specifications ?? {}) as Record<string, string>);
  const image = (product.images as string[])?.[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <BrandLockup />
          <p className="hidden text-sm text-muted-foreground sm:block">Industrial automation & electronics</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            {image ? (
              <img src={image} alt={product.name} className="max-h-full max-w-full object-contain" loading="lazy" />

            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground">
                <PackageCheck className="h-16 w-16" />
              </div>
            )}
          </div>

          <div>
            <Badge variant="secondary">{product.category}</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-bold text-primary">{inr(product.selling_price)}</span>
              {savings > 0 && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{inr(product.original_price)}</span>
                  <Badge className="bg-accent text-accent-foreground">Save {inr(savings)}</Badge>
                </>
              )}
            </div>
            <p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</p>

            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {product.stock > 0 ? `${product.stock} units in stock` : "Currently out of stock"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Cash on delivery in Lucknow
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Secure online payment
              </span>
            </div>

            <Card className="mt-8 border-dashed">
              <CardContent className="p-5 text-sm">
                <p className="font-semibold">Ready to order?</p>
                <p className="mt-1 text-muted-foreground">
                  Purchases are completed through your Parat Haben sales agent, who sends you a personal checkout link
                  with your delivery details already filled in. Contact your agent to receive it.
                </p>
              </CardContent>
            </Card>

            {!!specs.length && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold">Specifications</h2>
                <dl className="mt-3 divide-y rounded-xl border">
                  {specs.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 px-4 py-3 text-sm">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
