import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSession } from "@/lib/session";
import { isCodEligible, shortDate } from "@/lib/format";

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
  email: string;
  address: string;
  city: string;
  pincode: string;
  notes: string;
};

const blank: Form = { name: "", phone: "", email: "", address: "", city: "", pincode: "", notes: "" };

function AgentCustomers() {
  const qc = useQueryClient();
  const { session } = useAppSession();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const { data: customers } = useQuery({
    queryKey: ["agent-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.phone.trim()) throw new Error("Name and phone number are required.");
      if (!form.address.trim() || !form.city.trim() || !form.pincode.trim())
        throw new Error("Full delivery address, city and pincode are required.");
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        notes: form.notes.trim() || null,
        agent_id: session!.user.id,
      };
      const query = form.id
        ? supabase.from("customers").update(payload).eq("id", form.id)
        : supabase.from("customers").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer saved");
      setOpen(false);
      setForm(blank);
      void qc.invalidateQueries({ queryKey: ["agent-customers"] });
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
        description="Only you and the admin can see these records."
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
                    <TableHead>Pincode</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email ?? "No email"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                      <TableCell>
                        {c.city}
                        {isCodEligible(c.city, c.pincode) && (
                          <Badge variant="secondary" className="ml-2">
                            COD available
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.pincode}</TableCell>
                      <TableCell>{shortDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setForm({
                                id: c.id,
                                name: c.name,
                                phone: c.phone,
                                email: c.email ?? "",
                                address: c.address,
                                city: c.city,
                                pincode: c.pincode,
                                notes: c.notes ?? "",
                              });
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Delivery address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {form.city && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {isCodEligible(form.city, form.pincode)
                  ? "Cash on delivery will be offered to this customer (Lucknow only)."
                  : "Cash on delivery is not available outside Lucknow — this customer pays online."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
