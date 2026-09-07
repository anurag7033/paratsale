import { createFileRoute } from "@tanstack/react-router";

type PaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  method?: string;
  notes?: Record<string, string>;
};

type WebhookBody = {
  event?: string;
  payload?: { payment?: { entity?: PaymentEntity } };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      // Health check so the endpoint can be verified in a browser without leaking anything.
      GET: async () =>
        json({
          endpoint: "razorpay-webhook",
          ready: Boolean(process.env["RAZORPAY_WEBHOOK_SECRET"]),
          events: ["payment.captured", "payment.failed"],
        }),

      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return json({ error: "Webhook secret not configured" }, 503);

        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const expected = await hmacHex(secret, raw);
        if (!signature || !safeEqual(signature.toLowerCase(), expected)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let body: WebhookBody;
        try {
          body = JSON.parse(raw) as WebhookBody;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const event = body.event ?? "";
        const payment = body.payload?.payment?.entity;
        if (!payment?.order_id) return json({ ok: true, ignored: event });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: paymentRow } = await supabaseAdmin
          .from("payments")
          .select("id, order_id, payment_status")
          .eq("razorpay_order_id", payment.order_id)
          .maybeSingle();

        const orderId = paymentRow?.order_id ?? payment.notes?.["order_id"] ?? null;
        if (!orderId) return json({ ok: true, unmatched: payment.order_id });

        if (event === "payment.captured") {
          if (paymentRow?.payment_status === "paid") return json({ ok: true, duplicate: true });
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "paid", order_status: "confirmed" })
            .eq("id", orderId);
          await supabaseAdmin
            .from("payments")
            .update({ payment_status: "paid", razorpay_payment_id: payment.id ?? null })
            .eq("razorpay_order_id", payment.order_id);

          // Reduce stock once, only if this order has not already been counted.
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("product_id, quantity, purchase_link_id")
            .eq("id", orderId)
            .maybeSingle();
          if (order) {
            const { data: product } = await supabaseAdmin
              .from("products")
              .select("stock")
              .eq("id", order.product_id)
              .maybeSingle();
            if (product) {
              await supabaseAdmin
                .from("products")
                .update({ stock: Math.max(0, product.stock - order.quantity) })
                .eq("id", order.product_id);
            }
            if (order.purchase_link_id) {
              await supabaseAdmin
                .from("purchase_links")
                .update({ status: "converted" })
                .eq("id", order.purchase_link_id);
            }
          }
        } else if (event === "payment.failed") {
          await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
          await supabaseAdmin
            .from("payments")
            .update({ payment_status: "failed", razorpay_payment_id: payment.id ?? null })
            .eq("razorpay_order_id", payment.order_id);
        }

        return json({ ok: true, event });
      },
    },
  },
});
