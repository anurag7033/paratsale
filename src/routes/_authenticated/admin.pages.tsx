import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  head: () => ({
    meta: [
      { title: "Product Pages | Parat Haben Systems" },
      { name: "description", content: "Public product pages generated for every catalogue item." },
      { property: "og:title", content: "Product Pages | Parat Haben Systems" },
      { property: "og:description", content: "Copy and share live product page links with buyers." },
    ],
  }),
  component: AdminPages,
});

function AdminPages() {
  const { data } = useQuery({
    queryKey: ["product-pages"],
    queryFn: async () => {
      const [{ data: products, error }, { data: links }] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase.from("purchase_links").select("id, product_id"),
      ]);
      if (error) throw error;
      return (products ?? []).map((p) => ({
        ...p,
        links: (links ?? []).filter((l) => l.product_id === p.id).length,
      }));
    },
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      <PageHeader
        title="Product Pages"
        description="Each product automatically gets a public page. Share these links anywhere."
      />
      {!data?.length ? (
        <EmptyState title="No product pages yet" description="Add a product to generate its public page." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => {
            const url = `${origin}/product/${p.slug}`;
            return (
              <Card key={p.id} className="shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {inr(p.selling_price)} · {p.stock} in stock · {p.links} agent link{p.links === 1 ? "" : "s"}
                  </p>
                  <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{url}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        toast.success("Page link copied");
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    <Button asChild size="sm" className="flex-1">
                      <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
