"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { RefreshCw, Eye, EyeOff, Plus } from "lucide-react";
import type { Product } from "@/lib/supabase/types";
import ProductEditDialog from "./ProductEditDialog";

type ProductRow = Pick<
  Product,
  "id" | "name" | "slug" | "price" | "stock" | "is_visible" | "images" | "sort_order" | "description" | "highlights"
>;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  async function fetchProducts() {
    setLoading(true);
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      const data = await res.json();
      setProducts((data ?? []) as ProductRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, []);

  async function toggleVisibility(id: string, current: boolean) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_visible: !current } : p))
    );
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: !current }),
    });
    if (res.ok) {
      toast.success(current ? "Đã ẩn sản phẩm" : "Đã hiển thị sản phẩm");
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_visible: current } : p))
      );
      toast.error("Lỗi khi cập nhật");
    }
  }

  async function updateStock(id: string, stock: number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock } : p))
    );
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    if (res.ok) {
      toast.success("Đã cập nhật tồn kho");
    } else {
      toast.error("Lỗi khi cập nhật tồn kho");
    }
  }

  function onSaved(updated: ProductRow) {
    setProducts((prev) =>
      prev.some((p) => p.id === updated.id)
        ? prev.map((p) => (p.id === updated.id ? updated : p))
        : [updated, ...prev]
    );
    setEditProduct(null);
    setShowAddDialog(false);
    toast.success("Đã lưu sản phẩm");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Sản phẩm</h1>
          <p className="text-sm text-muted-foreground">{products.length} sản phẩm</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm sản phẩm
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sản phẩm</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Giá</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Tồn kho</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Hiển thị</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground italic">
                    Chưa có sản phẩm nào
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const img = (product.images as string[])[0];
                  return (
                    <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 rounded-md overflow-hidden bg-secondary/30 shrink-0">
                            {img ? (
                              <Image src={img} alt={product.name} fill sizes="40px" className="object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/30 font-heading italic">D</div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary whitespace-nowrap">
                        {formatPrice(product.price)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={product.stock}
                          onChange={(e) => updateStock(product.id, Number(e.target.value))}
                          className="w-20 h-7 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleVisibility(product.id, product.is_visible)}
                          className="flex items-center gap-1.5 text-xs"
                          title={product.is_visible ? "Ẩn sản phẩm" : "Hiển thị sản phẩm"}
                        >
                          {product.is_visible ? (
                            <><Eye className="h-4 w-4 text-primary" /><span className="text-primary">Hiện</span></>
                          ) : (
                            <><EyeOff className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Ẩn</span></>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditProduct(product)}
                        >
                          Sửa
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editProduct || showAddDialog) && (
        <ProductEditDialog
          product={editProduct}
          onClose={() => { setEditProduct(null); setShowAddDialog(false); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
