import { createClient } from "@/lib/supabase/server";
import ExitIntentOffer from "./ExitIntentOffer";

const DEFAULTS = {
  exit_offer_enabled: "true",
  exit_offer_code: "GIAM50K",
  exit_offer_title: "Khoan đã! Tặng bạn 50.000₫",
  exit_offer_body:
    "Nhập mã bên dưới khi đặt hàng để được giảm ngay 50.000₫ cho đơn đầu tiên.",
  exit_offer_cta: "Dùng mã & đặt hàng",
};

async function getConfig() {
  try {
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

export default async function ExitIntentOfferGate() {
  const cfg = await getConfig();
  if (cfg.exit_offer_enabled !== "true" || !cfg.exit_offer_code) return null;

  return (
    <ExitIntentOffer
      code={cfg.exit_offer_code.trim().toUpperCase()}
      title={cfg.exit_offer_title}
      body={cfg.exit_offer_body}
      cta={cfg.exit_offer_cta}
    />
  );
}
