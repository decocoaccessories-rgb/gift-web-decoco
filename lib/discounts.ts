import type { DiscountType } from "@/lib/supabase/types";

/** Định dạng mã hợp lệ: 3–32 ký tự, chữ HOA / số / gạch. */
export const DISCOUNT_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/;

/** Chuẩn hoá mã người dùng nhập: bỏ khoảng trắng + viết HOA. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCodeFormat(raw: string): boolean {
  return DISCOUNT_CODE_REGEX.test(normalizeCode(raw));
}

/**
 * Tính số tiền giảm (VND) — mirror hàm Postgres `_discount_amount`.
 * Không âm, không vượt quá `orderAmount`.
 */
export function computeDiscountAmount(
  type: DiscountType,
  value: number,
  maxCap: number | null,
  orderAmount: number
): number {
  let amount: number;
  if (type === "fixed") {
    amount = value;
  } else {
    amount = Math.floor((orderAmount * value) / 100);
    if (maxCap != null) amount = Math.min(amount, maxCap);
  }
  amount = Math.min(amount, orderAmount);
  return amount < 0 ? 0 : amount;
}

/** Các cột cần để quyết định một mã có đáng quảng bá trên popup hay không. */
export interface OfferableCode {
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
}

/**
 * Mã có đáng đưa lên popup exit-intent không?
 * Chỉ xét các điều kiện độc lập với giỏ hàng — bỏ qua `min_order_amount` và
 * `per_customer_limit` vì lúc popup hiện chưa biết đơn hàng lẫn khách là ai.
 */
export function isCodeOfferable(
  code: OfferableCode | null | undefined,
  now: number = Date.now()
): boolean {
  if (!code) return false;
  if (!code.is_active) return false;
  if (code.starts_at && new Date(code.starts_at).getTime() > now) return false;
  if (code.expires_at && new Date(code.expires_at).getTime() < now) return false;
  if (code.usage_limit != null && code.usage_count >= code.usage_limit) return false;
  return true;
}

/** Lý do từ chối (từ RPC) → câu tiếng Việt cho khách. */
export function discountReasonMessage(reason: string): string {
  switch (reason) {
    case "not_found":
      return "Mã giảm giá không tồn tại.";
    case "inactive":
      return "Mã giảm giá đã ngừng áp dụng.";
    case "not_started":
      return "Mã giảm giá chưa đến thời gian sử dụng.";
    case "expired":
      return "Mã giảm giá đã hết hạn.";
    case "min_order":
      return "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã này.";
    case "usage_limit":
      return "Mã giảm giá đã hết lượt sử dụng.";
    case "per_customer_limit":
      return "Bạn đã sử dụng mã giảm giá này rồi.";
    default:
      return "Mã giảm giá không hợp lệ.";
  }
}
