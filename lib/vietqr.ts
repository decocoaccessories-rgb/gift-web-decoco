// ============================================================
// VietQR auto-confirm payment — provider adapter (SePay).
//
// Tách lớp provider riêng để sau này đổi sang payOS/Casso chỉ cần
// thay file này, phần API route/frontend không đổi.
//
// Tạo ảnh QR: dùng URL tĩnh của SePay (qr.sepay.vn) — KHÔNG cần API key.
// API key chỉ dùng để verify webhook server-to-server.
// ============================================================

const SEPAY_QR_BASE = "https://qr.sepay.vn/img";
const DEFAULT_EXPIRE_MINUTES = 15;

/** True nếu đã cấu hình đủ env để tạo QR + nhận webhook. */
export function isVietqrConfigured(): boolean {
  return Boolean(
    process.env.SEPAY_BANK_ACCOUNT_NUMBER &&
      process.env.SEPAY_BANK_NAME &&
      process.env.SEPAY_WEBHOOK_SECRET
  );
}

/**
 * Chuẩn hoá order_number ("DCO-20240427-A3B2") thành dạng alphanumeric
 * ("DCO20240427A3B2") để nhúng vào nội dung chuyển khoản — ngân hàng hay
 * loại bỏ dấu gạch nối / ký tự đặc biệt trong memo.
 */
export function normalizeOrderRef(orderNumber: string): string {
  return orderNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Trích mã đơn (DCO + 8 số ngày + 4 ký tự) từ nội dung chuyển khoản nhận
 * được từ webhook. Trả về null nếu không tìm thấy. Không "đoán" theo số
 * tiền — chỉ match khi có mã đơn rõ ràng trong content.
 */
export function extractOrderRef(content: string | null | undefined): string | null {
  if (!content) return null;
  const normalized = content.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/DCO\d{8}[A-Z0-9]{4}/);
  return match ? match[0] : null;
}

/** Thời điểm QR hết hạn (countdown UI). */
export function vietqrExpiresAt(from: Date = new Date()): Date {
  const minutes = Number(process.env.VIETQR_DEFAULT_EXPIRE_MINUTES) || DEFAULT_EXPIRE_MINUTES;
  return new Date(from.getTime() + minutes * 60_000);
}

/**
 * Dựng URL ảnh QR SePay cho 1 đơn.
 * @throws nếu chưa cấu hình env (gọi sau khi đã check isVietqrConfigured).
 */
export function buildVietqrImageUrl(args: { amount: number; content: string }): string {
  const account = process.env.SEPAY_BANK_ACCOUNT_NUMBER;
  const bank = process.env.SEPAY_BANK_NAME;
  if (!account || !bank) {
    throw new Error(
      "VietQR not configured: set SEPAY_BANK_ACCOUNT_NUMBER and SEPAY_BANK_NAME"
    );
  }
  const params = new URLSearchParams({
    acc: account,
    bank,
    amount: String(args.amount),
    des: args.content,
  });
  return `${SEPAY_QR_BASE}?${params.toString()}`;
}

/**
 * Verify webhook đến từ SePay qua header Authorization: "Apikey <secret>".
 * So sánh hằng-thời-gian để tránh timing attack.
 */
export function verifySepayWebhook(authHeader: string | null): boolean {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Apikey ${secret}`;
  if (authHeader.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Payload webhook SePay (https://docs.sepay.vn). */
export interface SepayWebhookPayload {
  id?: number | string;          // id giao dịch SePay (dùng cho idempotency)
  gateway?: string;              // tên ngân hàng
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;          // mã SePay tự parse (nếu cấu hình pattern)
  content?: string | null;       // nội dung chuyển khoản
  transferType?: "in" | "out";
  transferAmount?: number;       // số tiền (VND, KHÔNG nhân 100)
  referenceCode?: string | null;
  description?: string | null;
}
