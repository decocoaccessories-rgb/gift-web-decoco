// Lịch polling cho trang chờ thanh toán VietQR.
// Tách riêng để giới hạn số request bắn vào PostgREST (Supabase NANO) khi
// khách để tab mở: poll phải dừng khi mã QR hết hạn, khi đơn không còn
// pending, hoặc khi chạm giới hạn cứng.

export const POLL_MS = 4000;

/** Giới hạn cứng khi đơn không có `vietqr_expires_at`. */
export const MAX_POLL_MS = 15 * 60 * 1000;

export interface NextPollDelayInput {
  /** Thời điểm hiện tại (ms). */
  now: number;
  /** Thời điểm bắt đầu poll (ms). */
  startedAt: number;
  /** `vietqr_expires_at` của đơn, null nếu chưa/không có. */
  expiresAt?: string | null;
  /** Trạng thái thanh toán lần fetch gần nhất; undefined nếu fetch lỗi. */
  paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
  /** Đơn không tồn tại (API trả 404). */
  notFound?: boolean;
}

/**
 * Trả về số ms tới lần poll kế tiếp, hoặc `null` nghĩa là dừng hẳn.
 */
export function nextPollDelay({
  now,
  startedAt,
  expiresAt,
  paymentStatus,
  notFound,
}: NextPollDelayInput): number | null {
  if (notFound) return null;
  if (paymentStatus && paymentStatus !== "pending") return null;
  if (now - startedAt >= MAX_POLL_MS) return null;

  if (expiresAt) {
    const target = new Date(expiresAt).getTime();
    if (Number.isFinite(target) && now >= target) return null;
  }

  return POLL_MS;
}
