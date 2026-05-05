"use client";

import { useRef, useState } from "react";
import { X, Loader2, Upload, GripVertical } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Product, ProductVariant } from "@/lib/supabase/types";

type ProductRow = Pick<
  Product,
  "id" | "name" | "slug" | "price" | "stock" | "is_visible" | "images" | "sort_order" | "description" | "highlights" | "variants"
>;

interface Props {
  product: ProductRow | null;
  onClose: () => void;
  onSaved: (product: ProductRow) => void;
}

const MAX_IMAGES = 10;

export default function ProductEditDialog({ product, onClose, onSaved }: Props) {
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    price: product?.price?.toString() ?? "",
    stock: product?.stock?.toString() ?? "0",
    description: product?.description ?? "",
    highlights: product?.highlights ?? "",
    is_visible: product?.is_visible ?? true,
    sort_order: product?.sort_order?.toString() ?? "0",
  });
  const [images, setImages] = useState<string[]>((product?.images as string[]) ?? []);
  const [variants, setVariants] = useState<ProductVariant[]>(
    (product?.variants as ProductVariant[] | undefined) ?? []
  );
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imgInputRef = useRef<HTMLInputElement>(null);

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: "",
        image_url: images[0] ?? "",
        stock: 0,
      },
    ]);
  }

  const variantManagedStock = variants.some((v) => typeof v.stock === "number");

  function updateVariant(index: number, patch: Partial<ProductVariant>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/\p{M}/gu, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  async function handleUploadFiles(files: FileList) {
    const remaining = MAX_IMAGES - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingImg(true);
    const uploaded: string[] = [];
    for (const file of toUpload) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "products");
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        uploaded.push(data.url as string);
      } else {
        toast.error(`Lỗi upload: ${data.error ?? "unknown"}`);
      }
    }
    if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
    setUploadingImg(false);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const cleanedVariants = variants
      .map((v) => {
        const stockValue =
          typeof v.stock === "number" && Number.isFinite(v.stock) && v.stock >= 0
            ? Math.floor(v.stock)
            : undefined;
        return {
          id: v.id,
          name: v.name.trim(),
          image_url: v.image_url,
          ...(stockValue !== undefined ? { stock: stockValue } : {}),
        };
      })
      .filter((v) => v.name && v.image_url);

    const payload = {
      name: form.name,
      slug: form.slug,
      price: parseInt(form.price),
      stock: parseInt(form.stock),
      description: form.description || undefined,
      highlights: form.highlights.trim() ? form.highlights : null,
      variants: cleanedVariants,
      is_visible: form.is_visible,
      sort_order: parseInt(form.sort_order),
      images,
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
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                value={variantManagedStock ? "" : form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                disabled={variantManagedStock}
                placeholder={variantManagedStock ? "Quản lý theo phân loại" : ""}
              />
              {variantManagedStock && (
                <p className="text-[11px] text-muted-foreground">
                  Đã quản lý tồn kho theo phân loại bên dưới.
                </p>
              )}
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

          <div className="space-y-1.5">
            <Label htmlFor="highlights">Điểm nổi bật</Label>
            <textarea
              id="highlights"
              rows={4}
              value={form.highlights}
              onChange={(e) => setForm({ ...form, highlights: e.target.value })}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
              placeholder={"Mỗi dòng là một điểm nổi bật, ví dụ:\nIn UV độ nét cao, màu sắc trung thực\nThiết kế hoàn toàn theo ý bạn\nThanh toán khi nhận hàng (COD)"}
            />
            <p className="text-xs text-muted-foreground">Mỗi dòng sẽ hiển thị thành một dấu tích (✓) trên trang sản phẩm. Để trống để dùng giá trị mặc định.</p>
          </div>

          {/* Variants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Phân loại màu <span className="text-muted-foreground font-normal">({variants.length})</span></Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
                disabled={images.length === 0}
                className="gap-1"
              >
                + Thêm phân loại
              </Button>
            </div>
            {images.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Cần upload ít nhất 1 ảnh trước khi thêm phân loại.</p>
            )}
            {variants.length > 0 && (
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <div className="relative h-10 w-10 rounded-md overflow-hidden border border-border bg-secondary/20 shrink-0">
                      {v.image_url ? (
                        <Image src={v.image_url} alt={v.name || `Phân loại ${i + 1}`} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                      )}
                    </div>
                    <Input
                      value={v.name}
                      onChange={(e) => updateVariant(i, { name: e.target.value })}
                      placeholder="Tên phân loại (vd: Vàng hồng)"
                      className="flex-1 h-8"
                    />
                    <select
                      value={v.image_url}
                      onChange={(e) => updateVariant(i, { image_url: e.target.value })}
                      className="h-8 max-w-[120px] rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" disabled>Chọn ảnh</option>
                      {images.map((url, idx) => (
                        <option key={url} value={url}>Ảnh {idx + 1}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={0}
                      value={typeof v.stock === "number" ? v.stock : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateVariant(i, { stock: undefined });
                        } else {
                          const n = parseInt(raw, 10);
                          updateVariant(i, { stock: Number.isFinite(n) && n >= 0 ? n : 0 });
                        }
                      }}
                      placeholder="Kho"
                      title="Tồn kho phân loại"
                      className="h-8 w-16"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                      title="Xoá phân loại"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Khách sẽ thấy các nút phân loại màu trên trang sản phẩm. Phải có cả tên và ảnh thì phân loại mới được lưu.</p>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ảnh sản phẩm <span className="text-muted-foreground font-normal">({images.length}/{MAX_IMAGES})</span></Label>
              <span className="text-xs text-muted-foreground">Khuyến nghị: 800×800px</span>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((url, i) => (
                  <div key={url + i} className="relative aspect-square group">
                    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border bg-secondary/20">
                      <Image
                        src={url}
                        alt={`Ảnh ${i + 1}`}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                      {/* Ảnh chính badge */}
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-primary-foreground px-1 py-0.5 rounded font-medium leading-none">
                          Chính
                        </span>
                      )}
                    </div>
                    {/* Controls overlay */}
                    <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => moveImage(i, i - 1)}
                          className="rounded bg-white/90 p-1 text-xs text-foreground hover:bg-white"
                          title="Lên"
                        >←</button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="rounded-full bg-destructive p-1 text-white hover:bg-destructive/80"
                        title="Xoá"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {i < images.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveImage(i, i + 1)}
                          className="rounded bg-white/90 p-1 text-xs text-foreground hover:bg-white"
                          title="Xuống"
                        >→</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImg}
                  onClick={() => imgInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploadingImg
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />
                  }
                  {uploadingImg ? "Đang tải..." : "Thêm ảnh"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, WebP • Có thể chọn nhiều ảnh
                </span>
              </div>
            )}

            <input
              ref={imgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleUploadFiles(e.target.files);
                e.target.value = "";
              }}
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
