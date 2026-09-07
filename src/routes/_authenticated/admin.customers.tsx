import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customer Directory | Parat Haben Systems" },
      { name: "description", content: "Every customer added by the sales team, with orders and spend." },
      { property: "og:title", content: "Customer Directory | Parat Haben Systems" },
      { property: "og:description", content: "Search customers by name, phone, city or assigned agent." },
    ],
  }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const [{ data: customers, error }, { data: profiles }, { data: orders }] = await Promise.all([
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,name,email"),
        supabase.from("orders").select("customer_id, final_amount"),
      ]);
      if (error) throw error;
      const agentName = new Map((profiles ?? []).map((p) => [p.id, p.name || p.email]));
      return (customers ?? []).map((c) => {
        const own = (orders ?? []).filter((o) => o.customer_id === c.id);
        return {
          ...c,
          agentName: agentName.get(c.agent_id) ?? "—",
          orders: own.length,
          spend: own.reduce((s, o) => s + Number(o.final_amount), 0),
        };
      });
    },
  });

  const filtered = useMemo(
    () =>
      (data ?? []).filter((c) =>
        `${c.name} ${c.phone} ${c.email ?? ""} ${c.city} ${c.agentName}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );

  return (
    <>
      <PageHeader title="Customers" description="Directory of every customer captured by your agents." />
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Input
            className="max-w-sm"
            placeholder="Search by name, phone, city or agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-4 overflow-x-auto">
            {!filtered.length ? (
              <EmptyState title="No customers yet" description="Agents add customers from their dashboard." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total spend</TableHead>
                    <TableHead>Added</TableHead>
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
                        {c.city.toLowerCase() === "lucknow" && (
                          <Badge variant="secondary" className="ml-2">
                            COD
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.agentName}</TableCell>
                      <TableCell>{c.orders}</TableCell>
                      <TableCell className="font-semibold">{inr(c.spend)}</TableCell>
                      <TableCell>{shortDate(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
