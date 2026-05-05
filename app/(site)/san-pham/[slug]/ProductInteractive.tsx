"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import ImageSlider from "@/components/ui/ImageSlider";
import DesignTool from "@/components/DesignTool/DesignTool";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { Frame, Product, ProductVariant } from "@/lib/supabase/types";

interface Props {
  product: Pick<
    Product,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "highlights"
    | "variants"
    | "price"
    | "stock"
    | "images"
  >;
  frames: Pick<Frame, "id" | "name" | "thumbnail_url" | "config" | "sort_order">[];
  highlights: string[];
}

export default function ProductInteractive({ product, frames, highlights }: Props) {
  const variants: ProductVariant[] = (product.variants ?? []) as ProductVariant[];
  const hasVariants = variants.length > 0;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId]
  );

  const images = useMemo(() => {
    const base = (product.images ?? []) as string[];
    if (!selectedVariant) return base;
    const filtered = base.filter((u) => u !== selectedVariant.image_url);
    return [selectedVariant.image_url, ...filtered];
  }, [product.images, selectedVariant]);

  const variantManagedStock = variants.some((v) => typeof v.stock === "number");
  const effectiveStock = variantManagedStock
    ? selectedVariant && typeof selectedVariant.stock === "number"
      ? selectedVariant.stock
      : null
    : product.stock;
  const requiresVariantSelection = variantManagedStock && !selectedVariant;
  const outOfStock = effectiveStock === 0;
  const lowStock = typeof effectiveStock === "number" && effectiveStock > 0 && effectiveStock <= 5;

  return (
    <>
      {/* Product info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: image slider */}
        <ImageSlider images={images} alt={product.name} />

        {/* Right: info */}
        <div className="space-y-5">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold leading-snug">
              {product.name}
            </h1>
            <p className="mt-2 text-2xl font-semibold text-primary">
              {formatPrice(product.price)}
            </p>
          </div>

          {/* Stock status */}
          {requiresVariantSelection ? (
            <p className="text-sm text-muted-foreground">
              Chọn phân loại để xem tồn kho
            </p>
          ) : outOfStock ? (
            <Badge variant="secondary" className="text-sm">
              Hết hàng
            </Badge>
          ) : lowStock ? (
            <p className="text-sm font-medium text-destructive">
              Chỉ còn {effectiveStock} sản phẩm!
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Còn hàng</p>
          )}

          {/* Variants */}
          {hasVariants && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Phân loại màu{" "}
                {selectedVariant ? (
                  <span className="text-muted-foreground font-normal">— {selectedVariant.name}</span>
                ) : (
                  <span className="text-destructive font-normal">(chưa chọn)</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="relative h-7 w-7 rounded-md overflow-hidden bg-secondary/20 shrink-0">
                        <Image src={v.image_url} alt={v.name} fill sizes="28px" className="object-cover" />
                      </span>
                      <span>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.description }}
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
            {highlights.map((line, i) => (
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
            productId={product.id}
            productName={product.name}
            productPrice={product.price}
            frames={frames}
            hasVariants={hasVariants}
            selectedVariant={selectedVariant ? { id: selectedVariant.id, name: selectedVariant.name } : null}
          />
        </section>
      )}
    </>
  );
}
