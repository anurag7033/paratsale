import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import {
  BadgePercent,
  LayoutDashboard,
  Link2,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  UserSquare2,
} from "lucide-react";
import { DashboardShell, type NavGroup } from "@/components/dashboard-shell";
import { useAppSession } from "@/lib/session";

function navFor(isSuper: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { title: isSuper ? "Super Admin Dashboard" : "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
        { title: "Sales Analytics", to: "/admin/sales", icon: TrendingUp },
      ],
    },
    {
      label: "Catalog & Sales",
      items: [
        { title: "Products", to: "/admin/products", icon: Package },
        { title: "Product Pages", to: "/admin/pages", icon: Link2 },
        { title: isSuper ? "Voucher Codes" : "Available Vouchers", to: "/admin/coupons", icon: BadgePercent },
      ],
    },
    {
      label: "People & Team",
      items: [
        ...(isSuper ? [{ title: "Admins", to: "/admin/admins", icon: ShieldCheck }] : []),
        { title: "Agents", to: "/admin/agents", icon: Users },
        { title: "Customers", to: "/admin/customers", icon: UserSquare2 },
      ],
    },
    {
      label: "Operations",
      items: [
        { title: "Orders", to: "/admin/orders", icon: ShoppingCart },
        { title: "Shipment Charges", to: "/admin/shipping", icon: Truck },
      ],
    },
  ];
  return groups;
}

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const role = (context as { role?: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      throw redirect({ to: "/agent" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { name, email, role } = useAppSession();
  const isSuper = role === "super_admin";
  return (
    <DashboardShell
      groups={navFor(isSuper)}
      roleLabel={isSuper ? "Super Admin" : "Admin"}
      userName={name}
      userEmail={email}
    >
      <Outlet />
    </DashboardShell>
  );
}
