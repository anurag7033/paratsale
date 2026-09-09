import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/stat-card";
import { StatusDot } from "@/components/order-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { inr, slugify } from "@/lib/format";
import { useAppSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Product Management | Parat Haben Systems" },
      { name: "description", content: "Create, edit, price and publish the Parat Haben Systems product catalogue." },
      { property: "og:title", content: "Product Management | Parat Haben Systems" },
      { property: "og:description", content: "Full control over catalogue, pricing, stock and specifications." },
    ],
  }),
  component: AdminProducts,
});

type ProductForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  images: string;
  original_price: string;
  selling_price: string;
  category: string;
  stock: string;
  specifications: string;
  status: string;
};

const blank: ProductForm = {
  name: "",
  slug: "",
  description: "",
  images: "",
  original_price: "",
  selling_price: "",
  category: "Automation",
  stock: "0",
  specifications: "Power: 24V DC\nWarranty: 12 months",
  status: "active",
};

const specsToText = (specs: unknown) =>
  Object.entries((specs ?? {}) as Record<string, string>)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

const textToSpecs = (text: string) =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split(":"))
      .filter((parts) => parts.length >= 2 && parts[0]!.trim())
      .map((parts) => [parts[0]!.trim(), parts.slice(1).join(":").trim()]),
  );

function AdminProducts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blank);
  const [uploading, setUploading] = useState(false);
  const { role } = useAppSession();
  const canEdit = role === "super_admin";

  const imageList = form.images.split("\n").map((s) => s.trim()).filter(Boolean);

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, {
          contentType: file.type || "image/jpeg",
        });
        if (error) throw error;
        // Long-lived signed link so the public product page can display the photo.
        const { data, error: signError } = await supabase.storage
          .from("product-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (signError || !data) throw signError ?? new Error("Could not create the image link.");
        urls.push(data.signedUrl);
      }
      setForm((f) => ({ ...f, images: [...f.images.split("\n").map((s) => s.trim()).filter(Boolean), ...urls].join("\n") }));
      toast.success(urls.length > 1 ? `${urls.length} photos uploaded` : "Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({
      ...f,
      images: f.images.split("\n").map((s) => s.trim()).filter((s) => s && s !== url).join("\n"),
    }));

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProductForm) => {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim() || slugify(values.name),
        description: values.description,
        images: values.images.split("\n").map((s) => s.trim()).filter(Boolean),
        original_price: Number(values.original_price || 0),
        selling_price: Number(values.selling_price || 0),
        category: values.category,
        stock: Number(values.stock || 0),
        specifications: textToSpecs(values.specifications),
        status: values.status,
      };
      if (!payload.name) throw new Error("Product name is required.");
      if (payload.selling_price <= 0) throw new Error("Selling price must be greater than zero.");
      const query = values.id
        ? supabase.from("products").update(payload).eq("id", values.id)
        : supabase.from("products").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product saved");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => toast.error("This product has orders and cannot be deleted. Deactivate it instead."),
  });

  const filtered = (products ?? []).filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalogue, pricing, stock and public product pages."
        action={
          <Button
            onClick={() => {
              setForm(blank);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New product
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <Input
            placeholder="Search products or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="mt-4 overflow-x-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !filtered.length ? (
              <EmptyState title="No products found" description="Create your first product to publish a page." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>MRP</TableHead>
                    <TableHead>Selling</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">/{p.slug}</p>
                      </TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-muted-foreground line-through">{inr(p.original_price)}</TableCell>
                      <TableCell className="font-semibold">{inr(p.selling_price)}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={p.status === "active"}
                            onCheckedChange={(v) =>
                              toggle.mutate({ id: p.id, status: v ? "active" : "inactive" })
                            }
                          />
                          <StatusDot active={p.status === "active"} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" title="View public page">
                            <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setForm({
                                id: p.id,
                                name: p.name,
                                slug: p.slug,
                                description: p.description,
                                images: (p.images ?? []).join("\n"),
                                original_price: String(p.original_price),
                                selling_price: String(p.selling_price),
                                category: p.category,
                                stock: String(p.stock),
                                specifications: specsToText(p.specifications),
                                status: p.status,
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove.mutate(p.id)}
                            className="text-destructive"
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Product name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (public URL)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Original price (₹)</Label>
              <Input
                type="number"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Selling price (₹)</Label>
              <Input
                type="number"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock quantity</Label>
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex h-9 items-center gap-3">
                <Switch
                  checked={form.status === "active"}
                  onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Product photos</Label>
              {imageList.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {imageList.map((url) => (
                    <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border">
                      <img src={url} alt="Product photo" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute right-0 top-0 rounded-bl-md bg-background/90 p-1 text-destructive"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : "Upload photos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void uploadImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <span className="text-xs text-muted-foreground">JPG or PNG, up to 10 MB each.</span>
              </div>
              <Textarea
                rows={2}
                placeholder="Or paste image links, one per line"
                value={form.images}
                onChange={(e) => setForm({ ...form, images: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Specifications (one “Label: value” per line)</Label>
              <Textarea
                rows={4}
                value={form.specifications}
                onChange={(e) => setForm({ ...form, specifications: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              Save product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
