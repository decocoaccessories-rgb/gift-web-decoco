"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiscountCode } from "@/lib/supabase/types";

interface Props {
  discount: DiscountCode | null;
  onClose: () => void;
  onSaved: () => void;
}

/** ISO (có offset) -> value cho <input type="datetime-local"> theo giờ local. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export default function DiscountEditDialog({ discount, onClose, onSaved }: Props) {
  const isNew = !discount;
  const [form, setForm] = useState({
    code: discount?.code ?? "",
    description: discount?.description ?? "",
    discount_type: (discount?.discount_type ?? "fixed") as "fixed" | "percent",
    discount_value: discount?.discount_value?.toString() ?? "",
    max_discount_amount: discount?.max_discount_amount?.toString() ?? "",
    min_order_amount: discount?.min_order_amount?.toString() ?? "0",
    starts_at: isoToLocalInput(discount?.starts_at ?? null),
    expires_at: isoToLocalInput(discount?.expires_at ?? null),
    usage_limit: discount?.usage_limit?.toString() ?? "",
    per_customer_limit: discount?.per_customer_limit?.toString() ?? "",
    is_active: discount?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPercent = form.discount_type === "percent";

  async function handleSave() {
    setSaving(true);
    setError("");

    const value = parseInt(form.discount_value, 10);
    if (!Number.isFinite(value) || value < 0) {
      setError("Giá trị giảm không hợp lệ");
      setSaving(false);
      return;
    }
    if (isPercent && (value < 1 || value > 100)) {
      setError("Phần trăm giảm phải trong khoảng 1–100");
      setSaving(false);
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: value,
      max_discount_amount: isPercent ? numOrNull(form.max_discount_amount) : null,
      min_order_amount: numOrNull(form.min_order_amount) ?? 0,
      starts_at: localInputToIso(form.starts_at),
      expires_at: localInputToIso(form.expires_at),
      usage_limit: numOrNull(form.usage_limit),
      per_customer_limit: numOrNull(form.per_customer_limit),
      is_active: form.is_active,
    };

    const url = isNew ? "/api/admin/discounts" : `/api/admin/discounts/${discount!.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Lỗi không xác định");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{isNew ? "Tạo mã giảm giá" : "Sửa mã giảm giá"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Mã *</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="GIAM50K"
              className="uppercase font-mono"
            />
            <p className="text-[11px] text-muted-foreground">Chữ HOA, số, gạch — 3 đến 32 ký tự.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả (nội bộ)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ưu đãi đơn đầu tiên"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="discount_type">Loại giảm *</Label>
              <select
                id="discount_type"
                value={form.discount_type}
                onChange={(e) =>
                  setForm({ ...form, discount_type: e.target.value as "fixed" | "percent" })
                }
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="fixed">Cố định (VND)</option>
                <option value="percent">Phần trăm (%)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount_value">
                {isPercent ? "Phần trăm giảm (1–100) *" : "Số tiền giảm (VND) *"}
              </Label>
              <Input
                id="discount_value"
                type="number"
                min={0}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                placeholder={isPercent ? "10" : "50000"}
              />
            </div>
          </div>

          {isPercent && (
            <div className="space-y-1.5">
              <Label htmlFor="max_discount_amount">Trần giảm tối đa (VND)</Label>
              <Input
                id="max_discount_amount"
                type="number"
                min={0}
                value={form.max_discount_amount}
                onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                placeholder="Để trống = không giới hạn"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="min_order_amount">Đơn tối thiểu (VND)</Label>
            <Input
              id="min_order_amount"
              type="number"
              min={0}
              value={form.min_order_amount}
              onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="starts_at">Bắt đầu</Label>
              <Input
                id="starts_at"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires_at">Hết hạn</Label>
              <Input
                id="expires_at"
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="usage_limit">Tổng lượt tối đa</Label>
              <Input
                id="usage_limit"
                type="number"
                min={0}
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                placeholder="Để trống = không giới hạn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="per_customer_limit">Lượt / khách (theo SĐT)</Label>
              <Input
                id="per_customer_limit"
                type="number"
                min={0}
                value={form.per_customer_limit}
                onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })}
                placeholder="Để trống = không giới hạn"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Đang áp dụng</span>
          </label>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Tạo mã" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
