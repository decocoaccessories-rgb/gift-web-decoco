import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { Product, Frame } from "@/lib/supabase/types";
import ImageSlider from "@/components/ui/ImageSlider";
import DesignTool from "@/components/DesignTool/DesignTool";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    .select("id, name, slug, description, highlights, price, stock, images, is_visible")
    .eq("slug", slug)
    .single();
  return data as Pick<
    Product,
    "id" | "name" | "slug" | "description" | "highlights" | "price" | "stock" | "images" | "is_visible"
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

  const images = (product!.images ?? []) as string[];
  const stock = product!.stock;
  const outOfStock = stock === 0;
  const lowStock = stock > 0 && stock <= 5;

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      {/* Product info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: image slider */}
        <ImageSlider images={images} alt={product!.name} />

        {/* Right: info */}
        <div className="space-y-5">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold leading-snug">
              {product!.name}
            </h1>
            <p className="mt-2 text-2xl font-semibold text-primary">
              {formatPrice(product!.price)}
            </p>
          </div>

          {/* Stock status */}
          {outOfStock ? (
            <Badge variant="secondary" className="text-sm">
              Hết hàng
            </Badge>
          ) : lowStock ? (
            <p className="text-sm font-medium text-destructive">
              Chỉ còn {stock} sản phẩm!
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Còn hàng</p>
          )}

          {/* Description */}
          {product!.description && (
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product!.description }}
            />
          )}

          {/* CTA */}
          {!outOfStock && (
            <a
              href="#design-tool"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Bắt đầu thiết kế ngay
            </a>
          )}

          <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-4 py-3 space-y-1">
            {parseHighlights(product!.highlights).map((line, i) => (
              <p key={i}>✓ {line}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Design tool */}
      {!outOfStock && (
        <section id="design-tool" className="mt-16">
          <div className="mb-6">
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-1">
              Công cụ thiết kế
            </p>
            <h2 className="font-heading text-2xl md:text-3xl font-semibold">
              Tạo thiết kế của bạn
            </h2>
          </div>
          <DesignTool
            productId={product!.id}
            productName={product!.name}
            productPrice={product!.price}
            frames={frames}
          />
        </section>
      )}
    </div>
  );
}
