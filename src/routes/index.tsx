import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { homeFor, useAppSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Parat Haben Systems | Distribution Core" },
      {
        name: "description",
        content:
          "Role-based sales and product management platform for Parat Haben Systems — automation, electronics and innovation.",
      },
      { property: "og:title", content: "Parat Haben Systems | Distribution Core" },
      {
        property: "og:description",
        content: "Admin and agent dashboards, tracked purchase links, coupons, Razorpay and COD orders.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { loading, session, role } = useAppSession();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session && role ? homeFor(role) : "/auth", replace: true });
  }, [loading, session, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
