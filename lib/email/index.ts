import { Resend } from "resend";
import type { Order, Product } from "@/lib/supabase/types";
import { renderNewOrderEmail, type NewOrderEmailData } from "./templates/new-order";

let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "placeholder_resend_key" || key.startsWith("re_your-")) {
    return null;
  }
  if (cached) return cached;
  cached = new Resend(key);
  return cached;
}

export type NewOrderEmailInput = {
  order: Pick<
    Order,
    | "id"
    | "order_number"
    | "customer_name"
    | "customer_phone"
    | "customer_email"
    | "province"
    | "address"
    | "note"
    | "price_at_order"
    | "variant_name"
    | "design_image_url"
    | "payment_method"
    | "payment_status"
    | "created_at"
  >;
  product?: Pick<Product, "name"> | null;
};

export async function sendNewOrderEmail(input: NewOrderEmailInput): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not configured; skipping new-order email"
    );
    return;
  }

  const to = process.env.NOTIFICATION_EMAIL ?? "decoco.cskh@gmail.com";
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const data: NewOrderEmailData = {
    order: input.order,
    productName: input.product?.name ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };

  const { subject, html } = renderNewOrderEmail(data);

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("[email] Resend error:", error);
    }
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
