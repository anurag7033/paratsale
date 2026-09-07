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
};

const blank: Form = { name: "", phone: "" };

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
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
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
            <p className="text-xs text-muted-foreground">
              That's all you need. The customer fills in their delivery address while placing the order.
            </p>
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
