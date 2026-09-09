import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Loader2, LogOut, MapPin, Menu, Search, ShieldCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { lookupPincode, type PincodeResult } from "@/lib/shipping.functions";
import { inr } from "@/lib/format";

export type NavGroup = {
  label: string;
  items: { title: string; to: string; icon: LucideIcon }[];
};

function SidebarShippingCalculator() {
  const lookup = useServerFn(lookupPincode);
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PincodeResult | null>(null);

  async function run() {
    const pin = pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a valid 6 digit pincode.");
      setResult(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await lookup({ data: { pincode: pin } });
      setResult(res);
      if (!res.ok) setError(res.message || "Pincode not found.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-sidebar-border px-3 py-4">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
        Shipment Charges
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="Pincode"
          className="h-8 flex-1 bg-sidebar-accent/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40 border-sidebar-border"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void run()}
          disabled={busy}
          aria-label="Check pincode"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {error && <p className="px-3 text-xs text-destructive">{error}</p>}

      {result?.ok && (
        <div className="space-y-2 px-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <MapPin className="h-3 w-3 text-sidebar-foreground/70" />
            <span className="font-medium text-sidebar-foreground">
              {result.district ?? "—"}, {result.state ?? "—"}
            </span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-sidebar-border text-sidebar-foreground">
              {result.zone}
            </Badge>
          </div>
          <div className="space-y-1">
            {result.options.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs">
                <span className="text-sidebar-foreground/80">{o.label}</span>
                <span className="font-semibold text-sidebar-foreground">{inr(o.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({
  groups,
  roleLabel,
  userName,
  userEmail,
  children,
}: {
  groups: NavGroup[];
  roleLabel: string;
  userName: string;
  userEmail: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                pathname === item.to || (item.to !== "/admin" && item.to !== "/agent" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  title={item.title}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-3">
          {collapsed ? <BrandLockup subtitle="" /> : <BrandLockup />}
        </div>
        {nav}
        {!collapsed && <SidebarShippingCalculator />}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
              <BrandLockup />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <SidebarShippingCalculator />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Badge className="hidden gap-1 bg-accent text-accent-foreground sm:flex">
            <ShieldCheck className="h-3 w-3" /> {roleLabel}
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
