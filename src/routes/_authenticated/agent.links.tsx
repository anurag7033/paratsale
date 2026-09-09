import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { StatusDot } from "@/components/order-badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSession } from "@/lib/session";
import { ShippingCalculator } from "@/components/shipping-calculator";
import { Input } from "@/components/ui/input";
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agent/links")({
  head: () => ({
    meta: [
      { title: "Purchase Links | Parat Haben Systems" },
      { name: "description", content: "Generate a unique checkout link for any customer and product." },
      { property: "og:title", content: "Purchase Links | Parat Haben Systems" },
      { property: "og:description", content: "Share personal buy links and track visits and orders." },
    ],
  }),
  component: AgentLinks,
});

const token = () =>
  `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`.toUpperCase();

function AgentLinks() {
  const qc = useQueryClient();
  const { session } = useAppSession();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [shipping, setShipping] = useState(0);

  const { data } = useQuery({
    queryKey: ["agent-links"],
    queryFn: async () => {
      const [{ data: links, error }, { data: customers }, { data: products }, { data: orders }] = await Promise.all([
        supabase.from("purchase_links").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("id,name,phone,city,pincode"),
        supabase.from("products").select("id,name,selling_price,status,stock"),
        supabase.from("orders").select("id, purchase_link_id, final_amount"),
      ]);
      if (error) throw error;
      return {
        customers: customers ?? [],
        products: products ?? [],
        links: (links ?? []).map((l) => {
          const own = (orders ?? []).filter((o) => o.purchase_link_id === l.id);
          return {
            ...l,
            customer: (customers ?? []).find((c) => c.id === l.customer_id) ?? null,
            product: (products ?? []).find((p) => p.id === l.product_id) ?? null,
            orders: own.length,
            revenue: own.reduce((s, o) => s + Number(o.final_amount), 0),
          };
        }),
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!customerId || !productId) throw new Error("Pick both a customer and a product.");
      const { error } = await supabase.from("purchase_links").insert({
        agent_id: session!.user.id,
        customer_id: customerId,
        product_id: productId,
        unique_token: token(),
        shipping_amount: shipping,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase link created");
      setOpen(false);
      setCustomerId("");
      setProductId("");
      setShipping(0);
      void qc.invalidateQueries({ queryKey: ["agent-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_links").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agent-links"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link deleted");
      void qc.invalidateQueries({ queryKey: ["agent-links"] });
    },
    onError: () => toast.error("This link already has orders — deactivate it instead."),
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      <PageHeader
        title="Purchase Links"
        description="Each link opens a checkout that already knows the customer and the product."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create link
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="overflow-x-auto p-4">
          {!data?.links.length ? (
            <EmptyState
              title="No purchase links yet"
              description="Create one for a customer and share it on WhatsApp or email."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Shipping</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.links.map((l) => {
                  const url = `${origin}/buy/${l.unique_token}`;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <p className="font-medium">{l.customer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.customer?.phone}</p>
                      </TableCell>
                      <TableCell>{l.product?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.unique_token}</TableCell>
                      <TableCell>
                        {Number(l.shipping_amount) > 0 ? inr(Number(l.shipping_amount)) : "Free"}
                      </TableCell>
                      <TableCell>{l.visits}</TableCell>
                      <TableCell>{l.orders}</TableCell>
                      <TableCell className="font-semibold">{inr(l.revenue)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={l.status === "active"}
                            onCheckedChange={(v) => setStatus.mutate({ id: l.id, status: v ? "active" : "inactive" })}
                          />
                          <StatusDot active={l.status === "active"} />
                        </div>
                      </TableCell>
                      <TableCell>{shortDate(l.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copy link"
                            onClick={() => {
                              void navigator.clipboard.writeText(url);
                              toast.success("Purchase link copied");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button asChild variant="ghost" size="icon" title="Open checkout">
                            <a href={`/buy/${l.unique_token}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => remove.mutate(l.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create purchase link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.products ?? [])
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {inr(p.selling_price)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Shipment charge</Label>
              <p className="text-xs text-muted-foreground">
                Check the customer's pincode, then choose a charge. It is added to the customer's total at checkout.
              </p>
              <ShippingCalculator
                compact
                selectedAmount={shipping}
                initialPincode={
                  (data?.customers ?? []).find((c) => c.id === customerId)?.pincode ?? ""
                }
                onPick={(amount) => setShipping(amount)}
              />
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Or set your own</span>
                <Input
                  className="h-8 w-28"
                  inputMode="numeric"
                  value={shipping}
                  onChange={(e) => setShipping(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
                />
                <span className="text-xs font-medium">Applied: {shipping > 0 ? inr(shipping) : "Free"}</span>
              </div>
            </div>
            {!data?.customers.length && (
              <p className="text-xs text-muted-foreground">Add a customer first to create a link.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
