"use client";

import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { getAvailableStock, isOutOfStock } from "@/lib/stock";
import type { Product } from "@/lib/supabase/types";

interface ProductCardProps {
  product: Pick<Product, "slug" | "name" | "price" | "stock" | "images"> &
    Partial<Pick<Product, "variants">>;
}

export default function ProductCard({ product }: ProductCardProps) {
  const images = product.images as string[];
  const primaryImage = images[0] ?? null;
  const hoverImage = images[1] ?? images[0] ?? null;
  // Tính qua helper để sản phẩm quản lý tồn theo phân loại (mọi variant = 0)
  // cũng được nhận ra là hết hàng, thay vì chỉ nhìn product.stock.
  const availableStock = getAvailableStock(product);
  const outOfStock = isOutOfStock(product);

  const cardRef = useRef<HTMLAnchorElement>(null);
  const [showSecond, setShowSecond] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !hoverImage || hoverImage === primaryImage) return;
    const SWAP_MS = 1800;
    let intervalId: number | null = null;
    const startCycle = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        setShowSecond((prev) => !prev);
      }, SWAP_MS);
    };
    const stopCycle = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) startCycle();
        else stopCycle();
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      stopCycle();
    };
  }, [hoverImage, primaryImage]);

  return (
    <Link
      ref={cardRef}
      href={`/san-pham/${product.slug}`}
      className="group relative flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow duration-300"
    >
      {/* Image container */}
      <div className="relative aspect-square overflow-hidden bg-secondary/30">
        {primaryImage ? (
          /* Chỉ lớp ẢNH bị làm mờ. Nhãn "Hết hàng" nằm ngoài wrapper này để giữ
             nguyên độ tương phản — hạ opacity của nhãn sẽ làm chữ khó đọc. */
          <div
            className={
              outOfStock
                ? "absolute inset-0 grayscale opacity-40 transition-opacity"
                : "absolute inset-0"
            }
          >
            <FallbackImage
              src={primaryImage}
              alt={product.name}
              cdnWidth={640}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-opacity duration-500 group-hover:opacity-0 ${showSecond ? "opacity-0" : ""}`}
            />
            {hoverImage && (
              <FallbackImage
                src={hoverImage}
                alt={`${product.name} - alternate`}
                cdnWidth={640}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${showSecond ? "opacity-100" : ""}`}
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            <span className="font-heading italic text-4xl text-primary/20">
              DECOCO
            </span>
          </div>
        )}

        {/* Nhãn hết hàng. Dùng nhãn CHỮ chứ không chỉ làm mờ: WCAG 1.4.1 không
            cho phép truyền đạt trạng thái chỉ bằng màu/hiệu ứng thị giác. */}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="rounded-md bg-foreground/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-background shadow-sm">
              Hết hàng
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <h3
          className={`text-sm font-medium leading-snug line-clamp-2 transition-colors ${
            outOfStock ? "text-muted-foreground" : "group-hover:text-primary"
          }`}
        >
          {product.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p
            className={`text-sm font-semibold ${
              outOfStock ? "text-muted-foreground" : "text-primary"
            }`}
          >
            {formatPrice(product.price)}
          </p>
          {outOfStock ? (
            <span className="text-[11px] font-medium text-muted-foreground">
              Hết hàng
            </span>
          ) : (
            availableStock > 0 &&
            availableStock <= 5 && (
              <span className="text-[11px] text-destructive font-medium">
                Còn {availableStock}
              </span>
            )
          )}
        </div>
      </div>
    </Link>
  );
}
