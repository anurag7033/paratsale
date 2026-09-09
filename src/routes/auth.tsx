import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole, homeFor, useAppSession } from "@/lib/session";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Parat Haben Systems Distribution Core" },
      {
        name: "description",
        content:
          "Secure sign in for Parat Haben Systems admins and sales agents to manage products, customers and orders.",
      },
      { property: "og:title", content: "Sign in | Parat Haben Systems Distribution Core" },
      {
        property: "og:description",
        content: "Role-based access for admins and sales agents of Parat Haben Systems.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAppSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && role) navigate({ to: homeFor(role), replace: true });
  }, [loading, session, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      toast.error(error?.message ?? "Could not sign in.");
      return;
    }
    const userRole = await fetchRole(data.user.id);
    setBusy(false);
    if (!userRole) {
      toast.error("No role assigned to this account. Contact your administrator.");
      return;
    }
    toast.success(`Welcome back!`);
    navigate({ to: homeFor(userRole), replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-brand)" }}
      >
        <BrandMark className="h-12 w-fit" />
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Distribution Core for automation, electronics &amp; innovation
          </h1>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/75">
            One control room for your catalogue, field agents, tracked purchase links, coupons and
            every rupee of attributed revenue.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
            {["Tracked agent links", "Razorpay &amp; COD", "Live sales analytics"].map((item) => (
              <div key={item} className="rounded-xl border border-white/15 bg-white/10 p-3">
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Parat Haben Systems • Automation • Electronics • Innovation
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/70 shadow-[var(--shadow-elevated)]">
          <CardContent className="p-8">
            <div className="lg:hidden">
              <BrandMark className="mx-auto h-12" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admins and agents share this entrance — you land on your own dashboard.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
