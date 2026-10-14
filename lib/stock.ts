import type { Product, ProductVariant } from "@/lib/supabase/types";

/**
 * Tồn kho của một sản phẩm có thể được quản lý theo 2 cách (xem PRD F1):
 *  - theo từng phân loại: ít nhất một variant có field `stock` -> `product.stock` bị BỎ QUA;
 *  - theo tổng: không variant nào có `stock` -> dùng `product.stock`.
 *
 * Các helper dưới đây là nguồn sự thật duy nhất cho câu hỏi "còn hàng hay không",
 * để thẻ sản phẩm, trang danh sách và trang chi tiết không tự suy luận khác nhau.
 */
export type StockSource = Pick<Product, "stock"> & {
  variants?: Product["variants"] | null;
};

function variantsOf(product: StockSource): ProductVariant[] {
  return (product.variants ?? []) as ProductVariant[];
}

/** true nếu sản phẩm quản lý tồn kho theo từng phân loại. */
export function isVariantManaged(product: StockSource): boolean {
  return variantsOf(product).some((v) => typeof v.stock === "number");
}

/**
 * Tổng số lượng còn bán được.
 * Với sản phẩm quản lý theo phân loại: tổng tồn của tất cả variant.
 * Variant thiếu `stock` trong một sản phẩm đã quản lý theo phân loại được coi
 * là 0 — an toàn hơn là coi như còn hàng rồi để khách đặt phải đơn không giao được.
 */
export function getAvailableStock(product: StockSource): number {
  if (!isVariantManaged(product)) return product.stock;
  return variantsOf(product).reduce((sum, v) => sum + (v.stock ?? 0), 0);
}

/** true khi không còn gì để bán (mọi phân loại đều hết, hoặc tổng kho = 0). */
export function isOutOfStock(product: StockSource): boolean {
  return getAvailableStock(product) <= 0;
}

/** true khi một phân loại cụ thể đã hết hàng (chỉ xét sản phẩm quản lý theo phân loại). */
export function isVariantOutOfStock(
  product: StockSource,
  variant: ProductVariant
): boolean {
  if (!isVariantManaged(product)) return false;
  return (variant.stock ?? 0) <= 0;
}
