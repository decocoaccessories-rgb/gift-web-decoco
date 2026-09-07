import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isCodeOfferable } from "@/lib/discounts";
import ExitIntentOffer from "./ExitIntentOffer";

const DEFAULTS = {
  exit_offer_enabled: "true",
  exit_offer_code: "",
  exit_offer_title: "Khoan đã! Tặng bạn 50.000₫",
  exit_offer_body:
    "Nhập mã bên dưới khi đặt hàng để được giảm ngay 50.000₫ cho đơn đầu tiên.",
  exit_offer_cta: "Dùng mã & đặt hàng",
};

async function getConfig() {
  try {
    // Dùng createClient() (đọc cookies) chứ không phải admin client: cookies ép
    // route render dynamic, nhờ đó mã popup luôn đọc mới từ DB. Đổi sang client
    // không-cookie sẽ khiến layout được cache tĩnh và popup kẹt mã cũ.
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_content")
      .select("key, value")
      .eq("section", "exit_offer");
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of (data ?? []) as Array<{ key: string | null; value: string | null }>) {
      if (row.key && row.value != null) map[row.key] = row.value;
    }
    return map;
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Mã popup có dùng được không? Popup quảng bá một mã đã tắt/hết hạn/hết lượt là
 * tệ hơn không có popup: khách bấm vào rồi mới biết mã hỏng.
 * `discount_codes` bật RLS không policy public nên phải đọc bằng admin client.
 */
async function isCodeUsable(code: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("discount_codes")
      .select("is_active, starts_at, expires_at, usage_limit, usage_count")
      .eq("code", code)
      .maybeSingle();

    if (error) return false;
    return isCodeOfferable(data);
  } catch {
    return false;
  }
}

export default async function ExitIntentOfferGate() {
  const cfg = await getConfig();
  if (cfg.exit_offer_enabled !== "true" || !cfg.exit_offer_code) return null;

  const code = cfg.exit_offer_code.trim().toUpperCase();
  if (!(await isCodeUsable(code))) return null;

  return (
    <ExitIntentOffer
      code={code}
      title={cfg.exit_offer_title}
      body={cfg.exit_offer_body}
      cta={cfg.exit_offer_cta}
    />
  );
}
