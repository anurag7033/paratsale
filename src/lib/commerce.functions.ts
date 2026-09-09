import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { couponDiscount, isCodEligible } from "./format";

const checkoutSchema = z.object({
  token: z.string().min(4).max(120),
  couponCode: z.string().trim().max(40).optional().nullable(),
  quantity: z.number().int().min(1).max(20).default(1),
  paymentMethod: z.enum(["razorpay", "cod"]),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().max(160).optional().nullable(),
  address: z.string().trim().min(5).max(400),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6 digit pincode"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationAccuracy: z.number().min(0).max(100000).optional().nullable(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Creates the order server-side after re-validating price, stock, coupon and COD rules. */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link } = await supabaseAdmin
      .from("purchase_links")
      .select("id, agent_id, customer_id, product_id, status")
      .eq("unique_token", data.token)
      .maybeSingle();
    if (!link || link.status !== "active") throw new Error("This purchase link is no longer valid.");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, name, selling_price, stock, status")
      .eq("id", link.product_id)
      .maybeSingle();
    if (!product || product.status !== "active") throw new Error("This product is unavailable.");
    if (product.stock < data.quantity) throw new Error("Not enough stock available.");

    if (data.paymentMethod === "cod" && !isCodEligible(data.city, data.pincode)) {
      throw new Error("Cash on Delivery is currently available only in Lucknow.");
    }

    const total = Number(product.selling_price) * data.quantity;
    let discount = 0;
    let couponId: string | null = null;

    if (data.couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", data.couponCode.toUpperCase())
        .maybeSingle();
      if (!coupon) throw new Error("Invalid coupon code.");
      const result = couponDiscount(coupon, total);
      if (result.error) throw new Error(result.error);
      discount = result.discount ?? 0;
      couponId = coupon.id;
    }

    const final = total - discount;

    await supabaseAdmin
      .from("customers")
      .update({
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        location_accuracy: data.locationAccuracy ?? null,
        location_captured_at: data.latitude != null ? new Date().toISOString() : null,
      })
      .eq("id", link.customer_id);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: link.customer_id,
        agent_id: link.agent_id,
        product_id: product.id,
        purchase_link_id: link.id,
        coupon_id: couponId,
        quantity: data.quantity,
        total_amount: total,
        discount_amount: discount,
        final_amount: final,
        payment_method: data.paymentMethod,
        payment_status: "pending",
        order_status: data.paymentMethod === "cod" ? "confirmed" : "pending",
        shipping_address: data.address,
        shipping_city: data.city,
        shipping_state: data.state,
        shipping_pincode: data.pincode,
        shipping_latitude: data.latitude ?? null,
        shipping_longitude: data.longitude ?? null,
        shipping_location_accuracy: data.locationAccuracy ?? null,
      })
      .select("id, order_number, final_amount")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Could not create the order.");

    if (couponId) {

      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("used_count")
        .eq("id", couponId)
        .single();
      await supabaseAdmin
        .from("coupons")
        .update({ used_count: (c?.used_count ?? 0) + 1 })
        .eq("id", couponId);
    }

    if (data.paymentMethod === "cod") {
      await supabaseAdmin.from("products").update({ stock: product.stock - data.quantity }).eq("id", product.id);
      await supabaseAdmin
        .from("purchase_links")
        .update({ status: "converted" })
        .eq("id", link.id);
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.final_amount),
        mode: "cod" as const,
      };
    }

    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) {
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.final_amount),
        mode: "razorpay_unconfigured" as const,
      };
    }

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: Math.round(Number(order.final_amount) * 100),
        currency: "INR",
        receipt: order.order_number,
        notes: { order_id: order.id },
      }),
    });
    const rzpBody = await rzpRes.text();
    if (!rzpRes.ok) {
      console.error(`Razorpay order failed [${rzpRes.status}]: ${rzpBody}`);
      throw new Error("Payment gateway error. Please try again.");
    }
    const rzpOrder = JSON.parse(rzpBody) as { id: string };

    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      razorpay_order_id: rzpOrder.id,
      amount: Number(order.final_amount),
      payment_status: "created",
    });

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      amount: Number(order.final_amount),
      mode: "razorpay" as const,
      razorpayOrderId: rzpOrder.id,
      keyId,
    };
  });

const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(4).max(120),
  razorpay_payment_id: z.string().min(4).max(120),
  razorpay_signature: z.string().min(10).max(300),
});

/** Server-side HMAC signature verification — payment is only trusted here. */
export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keySecret) throw new Error("Payment gateway is not configured.");
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpay_signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Payment verification failed.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, product_id, quantity, purchase_link_id, order_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");

    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", order_status: "confirmed" })
      .eq("id", order.id);
    await supabaseAdmin
      .from("payments")
      .update({
        payment_status: "paid",
        razorpay_payment_id: data.razorpay_payment_id,
      })
      .eq("razorpay_order_id", data.razorpay_order_id);

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

    return { orderNumber: order.order_number };
  });

/** Public checkout payload for a purchase link (also counts the visit). */
export const getCheckout = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(3).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("purchase_links")
      .select("id, status, visits, product_id, customer_id, agent_id")
      .eq("unique_token", data.token)
      .maybeSingle();
    if (!link) return { found: false as const };

    const [{ data: product }, { data: customer }, { data: agentRow }, { data: coupons }] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, name, slug, description, images, original_price, selling_price, category, stock, specifications, status")
        .eq("id", link.product_id)
        .maybeSingle(),
      supabaseAdmin
        .from("customers")
        .select("name, phone, email, address, city, state, pincode")
        .eq("id", link.customer_id)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select(
          "name, phone, bpo_name, bpo_contact_person, bpo_address, bpo_city, bpo_state, bpo_pincode, admin_id",
        )
        .eq("id", link.agent_id)
        .maybeSingle(),
      supabaseAdmin
        .from("coupons")
        .select("code, discount_type, discount_value, minimum_purchase, usage_limit, used_count, expiry_date, status")
        .eq("status", "active"),
    ]);

    let agent = agentRow;
    if (agentRow && !agentRow.bpo_name && agentRow.admin_id) {
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("bpo_name, bpo_contact_person, bpo_address, bpo_city, bpo_state, bpo_pincode")
        .eq("id", agentRow.admin_id)
        .maybeSingle();
      if (adminProfile) {
        agent = { ...agentRow, ...adminProfile };
      }
    }

    await supabaseAdmin.from("purchase_links").update({ visits: link.visits + 1 }).eq("id", link.id);

    return {
      found: true as const,
      status: link.status,
      product,
      customer,
      agent,
      coupons: coupons ?? [],
    };
  });

/** Public order confirmation lookup by order number. */
export const getOrderSummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ orderNumber: z.string().min(4).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, quantity, total_amount, discount_amount, final_amount, payment_method, payment_status, order_status, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_latitude, shipping_longitude, created_at, product_id, agent_id, customer_id",
      )
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();
    if (!order) return { found: false as const };
    const [{ data: product }, { data: agent }, { data: customer }] = await Promise.all([
      supabaseAdmin.from("products").select("name, images").eq("id", order.product_id).maybeSingle(),
      order.agent_id
        ? supabaseAdmin.from("profiles").select("name, phone").eq("id", order.agent_id).maybeSingle()
        : Promise.resolve({ data: null }),
      order.customer_id
        ? supabaseAdmin.from("customers").select("name, phone").eq("id", order.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { found: true as const, order, product, agent, customer };
  });
