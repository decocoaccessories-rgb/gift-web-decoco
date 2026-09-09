/**
 * Đẩy sự kiện lên dataLayer của Google Tag Manager.
 *
 * Container GTM được nạp bởi <Analytics /> (app/layout.tsx); GA4 được cấu hình
 * bên trong GTM chứ không gắn gtag trực tiếp — nếu gắn cả hai thì mỗi lượt xem
 * trang sẽ bị đếm hai lần.
 *
 * Các sự kiện dưới đây dùng đúng cấu trúc e-commerce GA4 của GTM, nên trong GTM
 * chỉ cần bật "Send Ecommerce data → Data Layer" là số liệu tự map sang GA4.
 */
import { sendGTMEvent } from "@next/third-parties/google";

/** ID container GTM. Ghi đè được bằng env; để trống env sẽ tắt đo lường. */
export const GTM_CONTAINER_ID =
  process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-MRZS9MCX";

/** Đơn vị tiền tệ cho mọi sự kiện e-commerce (VND không có phần thập phân). */
export const CURRENCY = "VND";

/** Một dòng hàng trong sự kiện e-commerce GA4. */
export interface GaItem {
  item_id: string;
  item_name: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
}

function pushEcommerce(
  event: string,
  ecommerce: Record<string, unknown>,
  /**
   * Thông số phụ đặt NGOÀI object `ecommerce`. GTM chỉ đọc các trường
   * e-commerce chuẩn bên trong `ecommerce`, nên tham số riêng của DECOCO phải
   * nằm ở cấp sự kiện thì mới lấy được bằng Biến lớp dữ liệu.
   */
  extra: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined" || !GTM_CONTAINER_ID) return;
  // GTM khuyến nghị xoá object ecommerce cũ trước mỗi lần push, tránh việc
  // sự kiện sau kế thừa nhầm items/value của sự kiện trước.
  sendGTMEvent({ ecommerce: null });
  sendGTMEvent({ event, ecommerce, ...extra });
}

/** Khách xem trang chi tiết một sản phẩm. */
export function trackViewItem(item: GaItem): void {
  pushEcommerce("view_item", {
    currency: CURRENCY,
    value: item.price ?? 0,
    items: [{ quantity: 1, ...item }],
  });
}

/** Khách vào trang đặt hàng với một thiết kế đã chọn. */
export function trackBeginCheckout(item: GaItem): void {
  pushEcommerce("begin_checkout", {
    currency: CURRENCY,
    value: item.price ?? 0,
    items: [{ quantity: 1, ...item }],
  });
}

/**
 * Đơn được tạo thành công.
 *
 * Khử trùng lặp theo `transaction_id` trong sessionStorage: khách có thể bấm
 * đặt hàng rồi quay lại, hoặc VNPAY/VietQR đưa họ trở về — doanh thu chỉ được
 * đếm một lần cho mỗi mã đơn.
 */
export interface PurchasePayload {
  transactionId: string;
  value: number;
  coupon?: string;
  /** cod | vnpay | vietqr — để tách đơn đã trả tiền và đơn COD trong báo cáo. */
  paymentMethod?: string;
  item: GaItem;
}

export function trackPurchase(params: PurchasePayload): void {
  if (typeof window === "undefined" || !GTM_CONTAINER_ID) return;

  const dedupeKey = `decoco_ga_purchase_${params.transactionId}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // sessionStorage bị chặn — vẫn gửi, thà đếm dư còn hơn mất đơn.
  }

  pushEcommerce(
    "purchase",
    {
      transaction_id: params.transactionId,
      currency: CURRENCY,
      value: params.value,
      shipping: 0,
      ...(params.coupon ? { coupon: params.coupon } : {}),
      items: [{ quantity: 1, ...params.item }],
    },
    params.paymentMethod ? { payment_method: params.paymentMethod } : {}
  );
}

const PENDING_KEY_PREFIX = "decoco_ga_pending_purchase_";

/**
 * Giữ tạm thông tin đơn VietQR chưa thanh toán.
 *
 * Đơn VietQR chỉ được tính là doanh thu khi SePay báo đã nhận tiền, nên lúc tạo
 * đơn ta chưa bắn `purchase` mà cất payload lại, chờ trang /thanh-toan xác nhận.
 */
export function stashPendingPurchase(
  orderId: string,
  payload: PurchasePayload
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PENDING_KEY_PREFIX + orderId,
      JSON.stringify(payload)
    );
  } catch {
    // sessionStorage bị chặn — đành bỏ qua, thà mất số liệu còn hơn chặn đặt hàng.
  }
}

/**
 * Bắn `purchase` cho đơn đã cất ở [stashPendingPurchase] khi đơn chuyển sang đã
 * thanh toán. An toàn khi gọi nhiều lần: bản thân trackPurchase đã khử trùng lặp.
 */
export function flushPendingPurchase(orderId: string): void {
  if (typeof window === "undefined") return;
  const key = PENDING_KEY_PREFIX + orderId;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
    if (raw) sessionStorage.removeItem(key);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    trackPurchase(JSON.parse(raw) as PurchasePayload);
  } catch {
    // payload hỏng — bỏ qua.
  }
}
