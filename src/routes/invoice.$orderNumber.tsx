import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import logo from "@/assets/parat-haben-logo.jpg.asset.json";
import { getOrderSummary } from "@/lib/commerce.functions";
import { Button } from "@/components/ui/button";

const summaryQuery = (orderNumber: string) =>
  queryOptions({
    queryKey: ["order-summary", orderNumber],
    queryFn: () => getOrderSummary({ data: { orderNumber } }),
  });

export const Route = createFileRoute("/invoice/$orderNumber")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(summaryQuery(params.orderNumber)),
  head: ({ params }) => ({
    meta: [
      { title: `Tax Invoice ${params.orderNumber} | Parat Haben Systems` },
      { name: "description", content: "Downloadable GST tax invoice for your Parat Haben Systems order." },
      { property: "og:title", content: `Tax Invoice ${params.orderNumber} | Parat Haben Systems` },
      { property: "og:description", content: "GST tax invoice with item details, tax breakup and grand total." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicePage,
});

const GST_RATE = 0.18;

const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = TENS[Math.floor(n / 10)] ?? "";
  const o = ONES[n % 10] ?? "";
  return o ? `${t} ${o}` : t;
}

function inWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (crore) parts.push(`${inWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const main = `Rupees ${inWords(rupees)}`;
  return paise ? `${main} and ${twoDigits(paise)} Paise Only` : `${main} Only`;
}

function InvoicePage() {
  const { orderNumber } = Route.useParams();
  const { data } = useSuspenseQuery(summaryQuery(orderNumber));

  if (!data.found) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Invoice not found</h1>
          <p className="mt-2 text-muted-foreground">Check the order number in your confirmation message.</p>
        </div>
      </div>
    );
  }

  const { order, product, customer } = data;
  const gross = Number(order.final_amount);
  const taxable = gross / (1 + GST_RATE);
  const halfTax = (gross - taxable) / 2;
  const unitPrice = Number(order.total_amount) / Math.max(1, Number(order.quantity));
  const paid = order.payment_status === "paid";
  const methodLabel = order.payment_method === "cod" ? "Cash on Delivery" : "Online / UPI";
  const invoiceDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:min-h-0 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body {
            background: #fff !important;
            width: 210mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .invoice-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .invoice-sheet, .invoice-sheet * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .invoice-body { padding-top: 6mm !important; padding-bottom: 6mm !important; }
          .invoice-spacer { display: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-5 flex w-full max-w-[210mm] items-center justify-between px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/order/$orderNumber" params={{ orderNumber }}>
            <ArrowLeft className="h-4 w-4" /> Back to order
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Download invoice
        </Button>
      </div>

      <div className="invoice-sheet mx-auto flex w-[210mm] min-h-[297mm] max-w-full flex-col bg-card shadow-[var(--shadow-elevated)]">

        {/* Header band */}
        <div className="relative overflow-hidden bg-[hsl(219,63%,17%)] text-white">
          <div className="absolute inset-y-0 right-0 w-[46%] bg-[hsl(6,30%,26%)]" />
          <div
            className="absolute inset-y-0 right-[38%] w-[12%] bg-[hsl(19,92%,52%)]"
            style={{ clipPath: "polygon(38% 0, 100% 0, 62% 100%, 0 100%)" }}
          />
          <div className="relative flex items-start justify-between gap-6 px-10 py-8">
            <div className="flex items-start gap-4">
              <img
                src={logo.url}
                alt="Parat Haben Systems"
                className="h-16 w-16 rounded-lg bg-white object-contain p-1"
              />
              <div>
                <p className="text-2xl font-bold tracking-tight">Parat Haben Systems</p>
                <p className="mt-1 text-sm text-white/75">Lucknow</p>
                <p className="mt-2 text-xs text-white/75">
                  +91 9598888369&nbsp;&nbsp;&nbsp;GSTIN: 09AAAPH1234A1Z5
                </p>
              </div>
            </div>
            <div className="pt-1 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
                Original for recipient
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">TAX INVOICE</p>
            </div>
          </div>
          <div className="h-[6px] w-full bg-[hsl(19,92%,52%)]" />
        </div>

        <div className="invoice-body flex flex-1 flex-col px-10 pb-8 pt-9">
          {/* Bill to + meta */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(19,92%,52%)]">Bill to</p>
              <p className="mt-3 text-xl font-bold text-[hsl(219,63%,17%)]">{customer?.name ?? "Customer"}</p>
              {customer?.phone && <p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>}
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {order.shipping_address}, {order.shipping_city}, {order.shipping_state} — {order.shipping_pincode}
              </p>
              {order.shipping_latitude != null && order.shipping_longitude != null && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  GPS {Number(order.shipping_latitude).toFixed(6)}, {Number(order.shipping_longitude).toFixed(6)}
                </p>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-2 gap-4 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Invoice number
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Invoice date
                  </p>
                  <p className="mt-1 text-base font-semibold">{invoiceDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t bg-muted/50 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Payment method
                  </p>
                  <p className="mt-1 text-base font-semibold">{methodLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Payment status
                  </p>
                  <p
                    className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                      paid
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    ● {order.payment_status.replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mt-8 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[40px_1fr_60px_120px_130px] gap-2 bg-[hsl(219,63%,17%)] px-6 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              <span>#</span>
              <span>Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="grid grid-cols-[40px_1fr_60px_120px_130px] items-center gap-2 px-6 py-5 text-sm">
              <span className="font-semibold text-muted-foreground">01</span>
              <span className="font-semibold">{product?.name ?? "Product"}</span>
              <span className="text-center">{order.quantity}</span>
              <span className="text-right">{money(unitPrice)}</span>
              <span className="text-right font-semibold">{money(Number(order.total_amount))}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="grid grid-cols-[40px_1fr_60px_120px_130px] items-center gap-2 border-t px-6 py-4 text-sm text-[hsl(19,92%,52%)]">
                <span />
                <span className="font-medium">Coupon discount</span>
                <span />
                <span />
                <span className="text-right font-semibold">-{money(Number(order.discount_amount))}</span>
              </div>
            )}
          </div>

          {/* Words + totals */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/50 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(19,92%,52%)]">
                Amount in words
              </p>
              <p className="mt-3 text-base font-bold text-[hsl(219,63%,17%)]">{amountInWords(gross)}</p>
              <div className="my-5 border-t" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Payment details
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Method</p>
                  <p className="mt-1 font-semibold">{methodLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <p className="mt-1 font-semibold capitalize">{order.payment_status.replace("_", " ")}</p>
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-0 text-sm">
                <div className="flex justify-between border-b py-3">
                  <span className="text-muted-foreground">Taxable Value</span>
                  <span className="font-semibold">{money(taxable)}</span>
                </div>
                <div className="flex justify-between border-b py-3">
                  <span className="text-muted-foreground">CGST @ 9.0%</span>
                  <span className="font-semibold">{money(halfTax)}</span>
                </div>
                <div className="flex justify-between border-b py-3">
                  <span className="text-muted-foreground">SGST @ 9.0%</span>
                  <span className="font-semibold">{money(halfTax)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[hsl(219,63%,17%)] px-6 py-5 text-white">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Grand total</span>
                <span className="text-2xl font-bold">{money(gross)}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="mt-8 border-l-4 border-[hsl(19,92%,52%)] bg-[hsl(19,92%,52%)]/5 px-5 py-4 text-sm">
            <p>Thank you for choosing Parat Haben Systems.</p>
            <p className="mt-1 text-muted-foreground">
              Taxes are shown separately wherever applicable. For interstate supply, IGST replaces CGST and SGST.
            </p>
          </div>

          <div className="invoice-spacer flex-1" />
        </div>

        {/* Footer band */}
        <div className="relative">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="block h-8 w-full">
            <path d="M0,40 L0,18 C300,-8 900,44 1200,10 L1200,40 Z" fill="hsl(219,63%,17%)" />
          </svg>
          <div className="grid gap-6 bg-[hsl(19,92%,52%)] px-10 py-7 text-white sm:grid-cols-[1.6fr_1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em]">Parat Haben Systems</p>
              <p className="mt-2 text-xs leading-relaxed text-white/90">
                546-547, Hind Nagar Crossing, Kanpur Road, Lucknow, Uttar Pradesh 226012, India · www.parathaben.com ·
                +91 9598888369 · contact@parathaben.com
              </p>
              <p className="mt-4 text-[11px] text-white/85">
                This is a computer-generated tax invoice and does not require a physical signature.
              </p>
            </div>
            <div className="flex flex-col items-center justify-start">
              <div className="mt-2 w-full border-t border-white/70" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em]">Authorized signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
