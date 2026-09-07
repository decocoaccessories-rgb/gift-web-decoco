"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import type { DiscountCode } from "@/lib/supabase/types";
import DiscountEditDialog from "./DiscountEditDialog";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminDiscountsPage() {
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DiscountCode | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<DiscountCode | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Mã được popup exit-intent quảng bá. Lưu ở site_content (key `exit_offer_code`),
  // KHÔNG phải trong discount_codes — nên phải chọn tường minh ở đây, nếu không
  // popup sẽ tiếp tục in mã cũ sau khi admin đổi mã.
  const [popupCode, setPopupCode] = useState("");
  const [savingPopup, setSavingPopup] = useState(false);

  const fetchPopupCode = useCallback(async () => {
    const res = await fetch("/api/admin/site-content");
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ key: string; value: string | null }>;
    setPopupCode(rows.find((r) => r.key === "exit_offer_code")?.value ?? "");
  }, []);

  async function savePopupCode(value: string) {
    setPopupCode(value);
    setSavingPopup(true);
    const res = await fetch("/api/admin/site-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ key: "exit_offer_code", value }] }),
    });
    setSavingPopup(false);
    if (res.ok) {
      toast.success(value ? `Popup sẽ hiện mã ${value}` : "Đã tắt mã trên popup");
    } else {
      toast.error("Không lưu được mã popup");
      fetchPopupCode();
    }
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/discounts");
    if (res.ok) setItems((await res.json()) as DiscountCode[]);
    else toast.error("Không tải được danh sách mã");
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
    fetchPopupCode();
  }, [fetchItems, fetchPopupCode]);

  async function toggleActive(d: DiscountCode) {
    const res = await fetch(`/api/admin/discounts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !d.is_active }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x))
      );
      toast.success(d.is_active ? "Đã tắt mã" : "Đã bật mã");
    } else {
      toast.error("Không cập nhật được");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/discounts/${toDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
      toast.success("Đã xoá mã");
    } else {
      toast.error("Không xoá được mã");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Mã giảm giá</h1>
          <p className="text-sm text-muted-foreground">{items.length} mã</p>
        </div>
        <div className="flex gap-2 self-start">
          <Button variant="outline" size="sm" onClick={fetchItems} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
          <Button size="sm" onClick={() => setEditing(null)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Tạo mã
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
        <Label htmlFor="popup_code">Mã hiển thị trên popup rời trang</Label>
        <div className="flex items-center gap-2">
          <select
            id="popup_code"
            value={popupCode}
            disabled={savingPopup || loading}
            onChange={(e) => savePopupCode(e.target.value)}
            className="flex h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value="">— Không hiện popup —</option>
            {items
              .filter((d) => d.is_active)
              .map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code}
                </option>
              ))}
            {popupCode && !items.some((d) => d.is_active && d.code === popupCode) && (
              <option value={popupCode}>{popupCode} (không còn hiệu lực)</option>
            )}
          </select>
          {savingPopup && (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Popup ưu đãi khi khách rời trang sẽ quảng bá mã này. Nếu mã bị tắt hoặc hết hạn,
          popup tự động không hiện.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Mã</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Giảm</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Đơn tối thiểu</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Đã dùng</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Hạn dùng</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground italic">
                    Chưa có mã giảm giá nào
                  </td>
                </tr>
              ) : (
                items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{d.code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.discount_type === "percent"
                        ? `${d.discount_value}%${d.max_discount_amount ? ` (tối đa ${formatPrice(d.max_discount_amount)})` : ""}`
                        : formatPrice(d.discount_value)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.min_order_amount > 0 ? formatPrice(d.min_order_amount) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.usage_count}
                      {d.usage_limit != null ? ` / ${d.usage_limit}` : " / ∞"}
                      {d.per_customer_limit != null && (
                        <span className="text-xs text-muted-foreground"> ({d.per_customer_limit}/khách)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(d.starts_at)} → {fmtDate(d.expires_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleActive(d)} title="Bật/tắt">
                        <Badge variant={d.is_active ? "default" : "secondary"}>
                          {d.is_active ? "Đang bật" : "Đã tắt"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(d)} title="Sửa">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(d)}
                          title="Xoá"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== undefined && (
        <DiscountEditDialog
          discount={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            fetchItems();
          }}
        />
      )}

      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (!deleting && e.target === e.currentTarget) setToDelete(null);
          }}
        >
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded-full bg-destructive/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 space-y-1">
                  <h2 className="font-semibold text-base">Xoá mã giảm giá?</h2>
                  <p className="text-sm text-muted-foreground">
                    Mã <span className="font-mono font-medium">{toDelete.code}</span> sẽ bị xoá vĩnh
                    viễn. Lịch sử sử dụng của mã cũng bị xoá theo.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setToDelete(null)} disabled={deleting}>
                  Huỷ
                </Button>
                <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Đang xoá..." : "Xoá vĩnh viễn"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
