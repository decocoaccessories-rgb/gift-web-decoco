"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/supabase/types";

type ProductRow = Pick<
  Product,
  "id" | "name" | "slug" | "price" | "stock" | "is_visible" | "images" | "sort_order" | "description"
>;

interface Props {
  product: ProductRow | null;
  onClose: () => void;
  onSaved: (product: ProductRow) => void;
}

export default function ProductEditDialog({ product, onClose, onSaved }: Props) {
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    price: product?.price?.toString() ?? "",
    stock: product?.stock?.toString() ?? "0",
    description: product?.description ?? "",
    is_visible: product?.is_visible ?? true,
    sort_order: product?.sort_order?.toString() ?? "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/\p{M}/gu, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      slug: form.slug,
      price: parseInt(form.price),
      stock: parseInt(form.stock),
      description: form.description || undefined,
      is_visible: form.is_visible,
      sort_order: parseInt(form.sort_order),
    };

    const url = isNew ? "/api/admin/products" : `/api/admin/products/${product.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Lỗi không xác định");
      setSaving(false);
      return;
    }
    onSaved(data as ProductRow);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{isNew ? "Thêm sản phẩm mới" : "Sửa sản phẩm"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên sản phẩm *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, slug: isNew ? autoSlug(e.target.value) : form.slug })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="ten-san-pham"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Giá (VND) *</Label>
              <Input
                id="price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="299000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock">Tồn kho *</Label>
              <Input
                id="stock"
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả</Label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
              placeholder="Mô tả sản phẩm..."
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Hiển thị sản phẩm</span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Tạo sản phẩm" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
