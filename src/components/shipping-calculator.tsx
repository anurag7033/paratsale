import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Search, Truck } from "lucide-react";
import { lookupPincode, type PincodeResult } from "@/lib/shipping.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";

type Props = {
  /** When given, each charge becomes a pick button that reports the amount back. */
  onPick?: (amount: number, result: PincodeResult) => void;
  selectedAmount?: number | null;
  initialPincode?: string;
  compact?: boolean;
};

export function ShippingCalculator({ onPick, selectedAmount, initialPincode = "", compact = false }: Props) {
  const lookup = useServerFn(lookupPincode);
  const [pincode, setPincode] = useState(initialPincode);
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
      if (!res.ok) setError(res.message || "This pincode was not found.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed. Please try again.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter delivery pincode"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Check</span>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result?.ok && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {result.district ?? "—"}, {result.state ?? "—"}
            </span>
            <Badge variant={result.serviceable ? "default" : "secondary"}>
              {result.serviceable ? "India Post delivers here" : "Non-delivery pincode"}
            </Badge>
            <Badge variant="outline">{result.zone}</Badge>
            <span className="text-xs text-muted-foreground">
              {result.count} post office{result.count === 1 ? "" : "s"}
            </span>
          </div>

          {!compact && result.offices.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.offices
                .slice(0, 6)
                .map((o) => `${o.name ?? "—"} (${o.branchType ?? "—"})`)
                .join(" · ")}
              {result.offices.length > 6 ? " …" : ""}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {result.options.map((o) => {
              const active = selectedAmount != null && selectedAmount === o.amount;
              return (
                <div
                  key={o.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    active ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.eta}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{o.amount === 0 ? "Free" : inr(o.amount)}</span>
                    {onPick && (
                      <Button
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() => onPick(o.amount, result)}
                      >
                        {active ? "Chosen" : "Choose"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (compact) return body;

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-primary" /> Shipment charge calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Check any Indian pincode against India Post data and see the shipment charge for that zone.
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
