/**
 * Ghi nhận nguồn marketing (UTM / gclid / fbclid / referrer) theo kiểu
 * **first-touch** vào localStorage, để khi khách đặt hàng ta đính kèm được
 * "đơn này đến từ đâu" vào bản ghi order — độc lập với phiên GA4.
 *
 * Vì sao cần: khách vào từ link bio TikTok (in-app browser) thường bị đẩy
 * sang trình duyệt ngoài giữa chừng → phiên GA4 đứt, đơn bị tính về
 * (direct). Lưu nguồn ở tầng ứng dụng + gửi lên server giúp có "nguồn đơn"
 * đáng tin trong Admin, không phụ thuộc GA4.
 *
 * First-touch: chỉ ghi MỘT lần cho mỗi trình duyệt (trong 30 ngày), lần
 * chạm đầu tiên có tham số nguồn thắng. Không ghi đè bằng lần ghé sau.
 */

const STORAGE_KEY = "decoco_attribution";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const MAX_LEN = 200;

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  /** epoch ms — để tự hết hạn sau 30 ngày. */
  first_seen_at: number;
}

function clip(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
}

/** Đọc nguồn đã lưu (bỏ qua nếu quá hạn hoặc hỏng). */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (
      !parsed ||
      typeof parsed.first_seen_at !== "number" ||
      Date.now() - parsed.first_seen_at > MAX_AGE_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Chạy ở client mỗi lần vào trang. Nếu URL có tham số nguồn (utm_* / gclid /
 * fbclid) hoặc có referrer khác domain, và CHƯA có bản ghi first-touch còn
 * hạn → lưu lại. Không làm gì nếu đã có.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  // Đã có first-touch còn hạn → giữ nguyên, không ghi đè.
  if (getAttribution()) return;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }

  const utm_source = clip(params.get("utm_source"));
  const utm_medium = clip(params.get("utm_medium"));
  const utm_campaign = clip(params.get("utm_campaign"));
  const utm_term = clip(params.get("utm_term"));
  const utm_content = clip(params.get("utm_content"));
  const gclid = clip(params.get("gclid"));
  const fbclid = clip(params.get("fbclid"));
  const ttclid = clip(params.get("ttclid"));

  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const refHost = new URL(document.referrer).host;
      if (refHost && refHost !== window.location.host) {
        referrer = clip(document.referrer);
      }
    }
  } catch {
    /* referrer không parse được — bỏ qua */
  }

  const hasClickId = Boolean(gclid || fbclid || ttclid);
  const hasUtm = Boolean(
    utm_source || utm_medium || utm_campaign || utm_term || utm_content
  );

  // Không có tín hiệu nguồn nào → không tạo bản ghi (đơn sẽ là direct/none).
  if (!hasUtm && !hasClickId && !referrer) return;

  // Suy ra source/medium khi chỉ có click-id (không kèm utm).
  let derivedSource = utm_source;
  let derivedMedium = utm_medium;
  if (!derivedSource && gclid) {
    derivedSource = "google";
    derivedMedium = derivedMedium ?? "cpc";
  }
  if (!derivedSource && fbclid) {
    derivedSource = "facebook";
    derivedMedium = derivedMedium ?? "paid-social";
  }
  if (!derivedSource && ttclid) {
    derivedSource = "tiktok";
    derivedMedium = derivedMedium ?? "paid-social";
  }
  if (!derivedSource && referrer) {
    try {
      derivedSource = clip(new URL(referrer).host);
      derivedMedium = derivedMedium ?? "referral";
    } catch {
      /* ignore */
    }
  }

  const record: Attribution = {
    utm_source: derivedSource,
    utm_medium: derivedMedium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
    landing_page: clip(window.location.pathname + window.location.search),
    first_seen_at: Date.now(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* localStorage bị chặn (chế độ riêng tư) — đành bỏ qua */
  }
}
