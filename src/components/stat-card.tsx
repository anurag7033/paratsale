import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <span className="rounded-lg bg-secondary p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
