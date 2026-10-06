/**
 * Gửi sự kiện chuẩn của TikTok Pixel.
 *
 * Pixel (ttq) được nạp qua thẻ Custom HTML trong GTM, không gắn trực tiếp ở
 * đây. Các sự kiện xem sản phẩm / thêm vào giỏ được đặt bằng Event Builder của
 * TikTok; riêng InitiateCheckout và CompletePayment bắn từ code vì cần giá trị
 * đơn chính xác và phải khớp logic khử trùng lặp / chờ thanh toán của GA4.
 */
import { CURRENCY, type GaItem } from "./gtm";

interface TtqLike {
  track: (
    event: string,
    params: Record<string, unknown>,
    options?: { event_id?: string }
  ) => void;
}

function getTtq(): TtqLike | null {
  if (typeof window === "undefined") return null;
  const ttq = (window as unknown as { ttq?: TtqLike }).ttq;
  return ttq && typeof ttq.track === "function" ? ttq : null;
}

function toContents(item: GaItem) {
  return [
    {
      content_id: item.item_id,
      content_type: "product",
      content_name: item.item_variant
        ? `${item.item_name} - ${item.item_variant}`
        : item.item_name,
      quantity: item.quantity ?? 1,
      price: item.price ?? 0,
    },
  ];
}

export function ttqTrack(
  event: "InitiateCheckout" | "CompletePayment",
  item: GaItem,
  value: number,
  eventId?: string
): void {
  const ttq = getTtq();
  if (!ttq) return;
  try {
    ttq.track(
      event,
      { contents: toContents(item), content_type: "product", value, currency: CURRENCY },
      eventId ? { event_id: eventId } : undefined
    );
  } catch {
    // Pixel lỗi không được làm hỏng luồng đặt hàng.
  }
}
