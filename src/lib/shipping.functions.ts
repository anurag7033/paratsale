import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * India Post pincode lookup — free and keyless (postalpincode.in).
 * Validates a pincode, returns its post offices, district/state and delivery
 * status, then turns that into ready-to-pick shipment charges.
 */

const BASE_URL = "https://api.postalpincode.in/pincode";

export type PostOffice = {
  name: string | null;
  branchType: string | null;
  delivery: string | null;
  district: string | null;
  division: string | null;
  circle: string | null;
  state: string | null;
};

export type ShippingOption = {
  id: string;
  label: string;
  eta: string;
  amount: number;
};

export type PincodeResult = {
  pincode: string;
  ok: boolean;
  serviceable: boolean;
  count: number;
  message: string;
  district: string | null;
  state: string | null;
  zone: string;
  offices: PostOffice[];
  options: ShippingOption[];
};

const LOCAL_STATES = ["uttar pradesh"];
const REGIONAL_STATES = [
  "delhi",
  "haryana",
  "punjab",
  "uttarakhand",
  "rajasthan",
  "madhya pradesh",
  "bihar",
  "chandigarh",
  "himachal pradesh",
];
const REMOTE_STATES = [
  "jammu and kashmir",
  "ladakh",
  "arunachal pradesh",
  "assam",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "sikkim",
  "tripura",
  "andaman and nicobar islands",
  "lakshadweep",
];

/** Base freight per shipment, derived from the India Post circle/state. */
function zoneFor(state: string | null, serviceable: boolean) {
  const s = (state ?? "").trim().toLowerCase();
  if (!s) return { zone: "Unknown", base: 149 };
  if (REMOTE_STATES.includes(s)) return { zone: "Remote / North-East", base: 199 };
  if (LOCAL_STATES.includes(s)) return { zone: serviceable ? "Local (UP)" : "Local (extended)", base: 59 };
  if (REGIONAL_STATES.includes(s)) return { zone: "North / Regional", base: 89 };
  return { zone: "Rest of India", base: 119 };
}

function optionsFor(base: number, serviceable: boolean): ShippingOption[] {
  const surcharge = serviceable ? 0 : 40; // out-of-network pincodes go by private courier
  const round = (n: number) => Math.round((n + surcharge) / 10) * 10;
  return [
    { id: "standard", label: "Standard surface", eta: "4-6 days", amount: round(base) },
    { id: "express", label: "Express air", eta: "2-3 days", amount: round(base * 1.6) },
    { id: "priority", label: "Priority next-day", eta: "1-2 days", amount: round(base * 2.2) },
  ];
}

/** Public: anyone signed in (or a customer at checkout) can price a pincode. */
export const lookupPincode = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6 digit pincode") }).parse(data),
  )
  .handler(async ({ data }): Promise<PincodeResult> => {
    let body: unknown;
    try {
      const res = await fetch(`${BASE_URL}/${data.pincode}`, {
        headers: { Accept: "application/json", "User-Agent": "parat-haben-shipping/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.json();
    } catch (err) {
      console.error("pincode lookup failed", err);
      throw new Error("Could not reach the pincode service. Please try again.");
    }

    const rec = (Array.isArray(body) && body.length ? body[0] : {}) as {
      Status?: string;
      Message?: string;
      PostOffice?: Array<Record<string, string | null>> | null;
    };
    const offices: PostOffice[] = (rec.PostOffice ?? []).map((po) => ({
      name: po["Name"] ?? null,
      branchType: po["BranchType"] ?? null,
      delivery: po["DeliveryStatus"] ?? null,
      district: po["District"] ?? null,
      division: po["Division"] ?? null,
      circle: po["Circle"] ?? null,
      state: po["State"] ?? null,
    }));

    const ok = rec.Status === "Success";
    const serviceable = ok && offices.some((o) => (o.delivery ?? "").toLowerCase().startsWith("deliver"));
    const first = offices[0];
    const { zone, base } = zoneFor(first?.state ?? null, serviceable);

    return {
      pincode: data.pincode,
      ok,
      serviceable,
      count: offices.length,
      message: rec.Message ?? rec.Status ?? "no data",
      district: first?.district ?? null,
      state: first?.state ?? null,
      zone,
      offices,
      options: ok ? optionsFor(base, serviceable) : [],
    };
  });
