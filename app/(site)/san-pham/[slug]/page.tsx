import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { Product, Frame } from "@/lib/supabase/types";
import ProductInteractive from "./ProductInteractive";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("name, description")
      .eq("slug", slug)
      .single();
    const product = data as Pick<Product, "name" | "description"> | null;
    if (!product) return { title: "Sản phẩm không tồn tại" };
    return {
      title: `${product.name} | DECOCO`,
      description: product.description ?? "Hộp quà tặng cá nhân hoá từ DECOCO",
    };
  } catch {
    return { title: "DECOCO" };
  }
}

async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, description, highlights, variants, price, stock, images, is_visible")
    .eq("slug", slug)
    .single();
  return data as Pick<
    Product,
    "id" | "name" | "slug" | "description" | "highlights" | "variants" | "price" | "stock" | "images" | "is_visible"
  > | null;
}

const DEFAULT_HIGHLIGHTS = [
  "In UV độ nét cao, màu sắc trung thực",
  "Thiết kế hoàn toàn theo ý bạn",
  "Thanh toán khi nhận hàng (COD)",
];

function parseHighlights(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_HIGHLIGHTS;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines : DEFAULT_HIGHLIGHTS;
}

async function getFrames(productId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("frames")
    .select("id, name, thumbnail_url, config, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  return (data ?? []) as Pick<
    Frame,
    "id" | "name" | "thumbnail_url" | "config" | "sort_order"
  >[];
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  let product: Awaited<ReturnType<typeof getProduct>> = null;
  let frames: Awaited<ReturnType<typeof getFrames>> = [];

  try {
    product = await getProduct(slug);
    if (!product || !product.is_visible) notFound();
    frames = await getFrames(product.id);
  } catch {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <ProductInteractive
        product={product!}
        frames={frames}
        highlights={parseHighlights(product!.highlights)}
      />
    </div>
  );
}
