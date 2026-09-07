export const inr = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const COD_CITY = "lucknow";
export const isCodEligible = (city: string, pincode?: string) =>
  city.trim().toLowerCase() === COD_CITY || (pincode ?? "").trim().startsWith("226");

export type DiscountInput = {
  discount_type: string;
  discount_value: number | string;
  minimum_purchase: number | string;
  usage_limit: number | null;
  used_count: number;
  expiry_date: string | null;
  status: string;
};

export function couponDiscount(coupon: DiscountInput, amount: number) {
  if (coupon.status !== "active") return { error: "This coupon is not active." };
  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date(new Date().toDateString()))
    return { error: "This coupon has expired." };
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)
    return { error: "This coupon has reached its usage limit." };
  if (amount < Number(coupon.minimum_purchase))
    return { error: `Minimum order of ${inr(coupon.minimum_purchase)} required.` };
  const raw =
    coupon.discount_type === "percentage"
      ? (amount * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);
  return { discount: Math.min(Math.round(raw), amount) };
}
