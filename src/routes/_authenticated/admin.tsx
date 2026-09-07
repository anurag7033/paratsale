import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import {
  BadgePercent,
  LayoutDashboard,
  Link2,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  UserSquare2,
} from "lucide-react";
import { DashboardShell, type NavGroup } from "@/components/dashboard-shell";
import { useAppSession } from "@/lib/session";

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
      { title: "Sales Analytics", to: "/admin/sales", icon: TrendingUp },
    ],
  },
  {
    label: "Catalog & Sales",
    items: [
      { title: "Products", to: "/admin/products", icon: Package },
      { title: "Product Pages", to: "/admin/pages", icon: Link2 },
      { title: "Coupon Manager", to: "/admin/coupons", icon: BadgePercent },
    ],
  },
  {
    label: "People & Team",
    items: [
      { title: "Agents", to: "/admin/agents", icon: Users },
      { title: "Customers", to: "/admin/customers", icon: UserSquare2 },
    ],
  },
  {
    label: "Operations",
    items: [{ title: "Orders", to: "/admin/orders", icon: ShoppingCart }],
  },
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if ((context as { role?: string }).role !== "admin") {
      throw redirect({ to: "/agent" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { name, email } = useAppSession();
  return (
    <DashboardShell groups={groups} roleLabel="Admin" userName={name} userEmail={email}>
      <Outlet />
    </DashboardShell>
  );
}
