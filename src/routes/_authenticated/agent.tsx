import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Link2, ShoppingCart, Truck, UserSquare2 } from "lucide-react";
import { DashboardShell, type NavGroup } from "@/components/dashboard-shell";
import { useAppSession } from "@/lib/session";

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Agent Workspace", to: "/agent", icon: LayoutDashboard }],
  },
  {
    label: "My Book",
    items: [
      { title: "My Customers", to: "/agent/customers", icon: UserSquare2 },
      { title: "Purchase Links", to: "/agent/links", icon: Link2 },
      { title: "My Orders", to: "/agent/orders", icon: ShoppingCart },
      { title: "Shipment Charges", to: "/agent/shipping", icon: Truck },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/agent")({
  beforeLoad: ({ context }) => {
    if ((context as { role?: string }).role !== "agent") {
      throw redirect({ to: "/admin" });
    }
  },
  component: AgentLayout,
});

function AgentLayout() {
  const { name, email } = useAppSession();
  return (
    <DashboardShell groups={groups} roleLabel="Sales Agent" userName={name} userEmail={email}>
      <Outlet />
    </DashboardShell>
  );
}
