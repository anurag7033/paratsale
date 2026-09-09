import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShippingCalculator } from "@/components/shipping-calculator";
import { useAppSession } from "@/lib/session";
import { inr, isCodEligible, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agent/customers")({
  head: () => ({
    meta: [
      { title: "My Customers | Parat Haben Systems" },
      { name: "description", content: "Add and manage the customers assigned to you as a sales agent." },
      { property: "og:title", content: "My Customers | Parat Haben Systems" },
      { property: "og:description", content: "Capture buyer details once and reuse them for every purchase link." },
    ],
  }),
  component: AgentCustomers,
});

type Form = {
  id?: string;
  name: string;
  phone: string;
};

const blank: Form = { name: "", phone: "" };

const newToken = () =>
  `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`.toUpperCase();


function AgentCustomers() {
  const qc = useQueryClient();
  const { session } = useAppSession();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [productId, setProductId] = useState("");
  const [pincode, setPincode] = useState("");
  const [shipping, setShipping] = useState(0);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["agent-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["agent-products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,selling_price,status")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.phone.trim()) throw new Error("Name and phone number are required.");
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        agent_id: session!.user.id,
      };
      if (form.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", form.id);
        if (error) throw error;
        return null;
      }
      const { data: inserted, error } = await supabase.from("customers").insert(payload).select("id").single();
      if (error) throw error;
      if (!productId) return null;
      const token = newToken();
      const { error: linkError } = await supabase.from("purchase_links").insert({
        agent_id: session!.user.id,
        customer_id: inserted.id,
        product_id: productId,
        unique_token: token,
        shipping_amount: shipping,
      });
      if (linkError) throw linkError;
      return token;
    },
    onSuccess: (token) => {
      toast.success(token ? "Customer saved and payment link created" : "Customer saved");
      void qc.invalidateQueries({ queryKey: ["agent-customers"] });
      void qc.invalidateQueries({ queryKey: ["agent-links"] });
      if (token) {
        setCreatedLink(`${window.location.origin}/buy/${token}`);
      } else {
        setOpen(false);
      }
      setForm(blank);
      setProductId("");
      setPincode("");
      setShipping(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer removed");
      void qc.invalidateQueries({ queryKey: ["agent-customers"] });
    },
    onError: () => toast.error("This customer has orders and can't be deleted."),
  });

  const filtered = (customers ?? []).filter((c) =>
    `${c.name} ${c.phone} ${c.city}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="My Customers"
        description="Just a name and a mobile number — the rest is captured at checkout."
        action={
          <Button
            onClick={() => {
              setForm(blank);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add customer
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Input
            className="max-w-sm"
            placeholder="Search by name, phone or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-4 overflow-x-auto">
            {!filtered.length ? (
              <EmptyState title="No customers yet" description="Add your first customer to create purchase links." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Delivery city</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email ?? "No email yet"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                      <TableCell>
                        {c.city ? (
                          <>
                            {c.city}
                            {isCodEligible(c.city, c.pincode) && (
                              <Badge variant="secondary" className="ml-2">
                                COD available
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Added at checkout</span>
                        )}
                      </TableCell>
                      <TableCell>{shortDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setForm({ id: c.id, name: c.name, phone: c.phone });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => remove.mutate(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setCreatedLink(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createdLink ? "Payment link ready" : form.id ? "Edit customer" : "Add customer"}
            </DialogTitle>
          </DialogHeader>
          {createdLink ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this link with the customer. It opens their product page and checkout.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={createdLink} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdLink);
                    toast.success("Payment link copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button asChild variant="outline">
                  <a href={createdLink} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                </Button>
                <Button
                  onClick={() => {
                    setCreatedLink(null);
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Customer name</Label>
                  <Input
                    value={form.name}
                    placeholder="e.g. Ramesh Gupta"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile number</Label>
                  <Input
                    value={form.phone}
                    placeholder="e.g. +91 98765 43210"
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                {!form.id && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="space-y-2">
                      <Label>Payment link product (optional)</Label>
                      <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product to generate a payment link" />
                        </SelectTrigger>
                        <SelectContent>
                          {(products ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {inr(Number(p.selling_price))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {productId && (
                      <div className="space-y-2">
                        <Label>Shipment charge</Label>
                        <p className="text-xs text-muted-foreground">
                          Check the delivery pincode, then pick a charge. It is added to the customer's total.
                        </p>
                        <Input
                          className="h-9 max-w-[10rem]"
                          inputMode="numeric"
                          placeholder="Delivery pincode"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        />
                        <ShippingCalculator
                          compact
                          selectedAmount={shipping}
                          initialPincode={pincode}
                          onPick={(amount) => setShipping(amount)}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">Or set your own</span>
                          <Input
                            className="h-8 w-28"
                            inputMode="numeric"
                            value={shipping}
                            onChange={(e) =>
                              setShipping(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))
                            }
                          />
                          <span className="text-xs font-medium">
                            Applied: {shipping > 0 ? inr(shipping) : "Free"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The customer fills in their delivery address while placing the order.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {!form.id && productId ? "Save & create link" : "Save customer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>

      </Dialog>
    </>
  );
}
