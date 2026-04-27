import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/supabase/types";

interface ProductCardProps {
  product: Pick<Product, "slug" | "name" | "price" | "stock" | "images">;
}

export default function ProductCard({ product }: ProductCardProps) {
  const images = product.images as string[];
  const primaryImage = images[0] ?? null;
  const hoverImage = images[1] ?? images[0] ?? null;
  const outOfStock = product.stock === 0;

  return (
    <Link
      href={`/san-pham/${product.slug}`}
      className="group relative flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow duration-300"
    >
      {/* Image container */}
      <div className="relative aspect-square overflow-hidden bg-secondary/30">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-opacity duration-500 group-hover:opacity-0"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={`${product.name} - alternate`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            <span className="font-heading italic text-4xl text-primary/20">
              DECOCO
            </span>
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs font-medium">
              Hết hàng
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm font-semibold text-primary">
            {formatPrice(product.price)}
          </p>
          {product.stock > 0 && product.stock <= 5 && (
            <span className="text-[11px] text-destructive font-medium">
              Còn {product.stock}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
