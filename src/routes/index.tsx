import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { BrandLockup } from "@/components/brand";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { fetchRole, homeFor } = await import("@/lib/session");
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const role = await fetchRole(data.user.id);
    throw redirect({ to: homeFor(role) });
  },
  head: () => ({
    meta: [
      { title: "Parat Haben Systems | Sales & Product Platform" },
      {
        name: "description",
        content:
          "Internal platform for Parat Haben Systems: manage products, agents, coupons, purchase links and orders.",
      },
      { property: "og:title", content: "Parat Haben Systems | Sales & Product Platform" },
      { property: "og:description", content: "Admin and agent dashboards for products, links, orders and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <BrandLockup />
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});
