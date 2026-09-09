import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard-shell";
import { ShippingCalculator } from "@/components/shipping-calculator";

export const Route = createFileRoute("/_authenticated/agent/shipping")({
  head: () => ({
    meta: [
      { title: "Shipment Charges | Parat Haben Systems" },
      { name: "description", content: "Check any Indian pincode and see the shipment charge for that delivery zone." },
      { property: "og:title", content: "Shipment Charges | Parat Haben Systems" },
      { property: "og:description", content: "India Post based shipment charge calculator for agents." },
    ],
  }),
  component: AgentShipping,
});

function AgentShipping() {
  return (
    <>
      <PageHeader
        title="Shipment Charges"
        description="Check a delivery pincode and see the charge for that zone."
      />
      <ShippingCalculator />
    </>
  );
}
