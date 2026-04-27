import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/ui/ProductCard";
import type { Product } from "@/lib/supabase/types";

interface ProductsShowcaseSectionProps {
  products: Pick<Product, "slug" | "name" | "price" | "stock" | "images">[];
}

export default function ProductsShowcaseSection({
  products,
}: ProductsShowcaseSectionProps) {
  return (
    <section id="products" className="py-20 px-4 bg-secondary/20">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
            Bộ sưu tập
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold">
            Sản phẩm nổi bật
          </h2>
        </div>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/san-pham"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full px-8"
                )}
              >
                Xem tất cả sản phẩm
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground italic">
              Sản phẩm đang được cập nhật — quay lại sớm nhé!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
