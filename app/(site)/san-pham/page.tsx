import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/ui/ProductCard";
import type { Product } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Sản phẩm | DECOCO",
  description: "Khám phá bộ sưu tập hộp quà tặng cá nhân hoá từ DECOCO. Thiết kế hộp quà với ảnh của bạn chỉ trong 5 phút.",
};

export const revalidate = 30;

async function getProducts(): Promise<
  Pick<Product, "slug" | "name" | "price" | "stock" | "images">[]
> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("slug, name, price, stock, images")
      .eq("is_visible", true)
      .order("sort_order");
    return (data ?? []) as Pick<Product, "slug" | "name" | "price" | "stock" | "images">[];
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
          Bộ sưu tập
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-semibold">
          Tất cả sản phẩm
        </h1>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="font-heading text-2xl text-muted-foreground italic">
            Sản phẩm đang được cập nhật
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Quay lại sớm nhé!
          </p>
        </div>
      )}
    </div>
  );
}
