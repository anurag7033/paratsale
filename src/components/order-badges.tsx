import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  processing: "bg-chart-4/15 text-primary border-chart-4/30",
  shipped: "bg-accent/15 text-accent border-accent/30",
  delivered: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusStyles[status] ?? "")}>
      {status}
    </Badge>
  );
}

export function PaymentBadge({ method, status }: { method: string; status: string }) {
  const paid = status === "paid";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide">
        {method === "cod" ? "COD" : "Razorpay"}
      </span>
      <Badge
        variant="outline"
        className={cn(
          "w-fit capitalize",
          paid ? "border-success/30 bg-success/15 text-success" : "border-warning/30 bg-warning/15 text-warning-foreground",
        )}
      >
        {status}
      </Badge>
    </div>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        active ? "border-success/30 bg-success/15 text-success" : "border-border bg-muted text-muted-foreground",
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
