import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const variantSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  image_url: z.string().url(),
  stock: z.number().int().min(0).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  highlights: z.string().nullable().optional(),
  variants: z.array(variantSchema).max(20).optional(),
  price: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  is_visible: z.boolean().optional(),
  images: z.array(z.string()).max(20).optional(),
  sort_order: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  }

  const admin = createAdminClient();

  // Lưu lại slug cũ nếu có để revalidate cả đường dẫn cũ trường hợp admin đổi slug
  let oldSlug: string | null = null;
  if (parsed.data.slug) {
    const { data: currentProduct } = await admin
      .from("products")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    oldSlug = currentProduct?.slug ?? null;
  }

  const { data, error } = await admin
    .from("products")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Xóa cache ISR / Data Cache để cập nhật hiển thị ngay trên website
  if (data?.slug) {
    revalidatePath(`/san-pham/${data.slug}`);
  }
  if (oldSlug && oldSlug !== data?.slug) {
    revalidatePath(`/san-pham/${oldSlug}`);
  }
  revalidatePath("/san-pham");
  revalidatePath("/");

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: currentProduct } = await admin
    .from("products")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Xóa cache các trang liên quan sau khi xóa sản phẩm
  if (currentProduct?.slug) {
    revalidatePath(`/san-pham/${currentProduct.slug}`);
  }
  revalidatePath("/san-pham");
  revalidatePath("/");

  return NextResponse.json({ success: true });
}
