import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int(),
      })
    )
    .min(1),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 422 });
  }

  // Một câu lệnh duy nhất (RPC reorder_products, migration 014) thay cho N lần
  // UPDATE rời rạc. Trước đây Promise.all phát N request độc lập: hai lần kéo thả
  // liên tiếp chồng nhau thì các UPDATE xen kẽ và trộn hai snapshot vào nhau, sinh
  // sort_order trùng + có lỗ. Giờ request hoặc áp dụng trọn vẹn, hoặc không gì cả.
  const admin = createAdminClient();
  const { data: updated, error } = await admin.rpc("reorder_products", {
    items: parsed.data.items,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (updated !== parsed.data.items.length) {
    return NextResponse.json(
      { error: `Chỉ cập nhật được ${updated}/${parsed.data.items.length} sản phẩm` },
      { status: 422 }
    );
  }

  // Xoá cache ISR để thứ tự mới hiện ra ngoài website ngay, không chờ 30-60s.
  revalidatePath("/");
  revalidatePath("/san-pham");

  return NextResponse.json({ success: true });
}
