"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { Download, Eye, Search, RefreshCw } from "lucide-react";
import type { Order } from "@/lib/supabase/types";
import OrderDetailDialog from "./OrderDetailDialog";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Mới", variant: "default" },
  confirmed: { label: "Xác nhận", variant: "secondary" },
  shipping: { label: "Đang giao", variant: "outline" },
  done: { label: "Hoàn thành", variant: "secondary" },
  cancelled: { label: "Huỷ", variant: "destructive" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Mới" },
  { value: "confirmed", label: "Xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "done", label: "Hoàn thành" },
  { value: "cancelled", label: "Huỷ" },
];

type OrderRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "province"
  | "address"
  | "note"
  | "status"
  | "price_at_order"
  | "design_image_url"
  | "variant_name"
  | "payment_method"
  | "payment_status"
  | "paid_at"
  | "created_at"
>;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "COD",
  vnpay: "VNPAY",
};

const PAYMENT_STATUS_LABEL: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Chờ", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Đã trả", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Lỗi", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Huỷ", className: "bg-zinc-100 text-zinc-700" },
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      ...(statusFilter !== "all" && { status: statusFilter }),
      ...(search && { search }),
    });
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders((data.orders ?? []) as OrderRow[]);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: status as Order["status"] } : o))
      );
      toast.success("Đã cập nhật trạng thái đơn hàng");
    } else {
      toast.error("Lỗi khi cập nhật trạng thái");
    }
  }

  const totalPages = Math.ceil(total / 20);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Đơn hàng</h1>
          <p className="text-sm text-muted-foreground">{total} đơn</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-1.5 self-start">
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Tên, SĐT, mã đơn..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setSearch(searchInput); setPage(1); }
            }}
            className="w-52 h-8"
          />
          <Button size="icon" variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Mã đơn</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Thời gian</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Khách hàng</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Giá trị</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Thanh toán</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Thiết kế</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground italic">
                    Không có đơn hàng nào
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const s = STATUS_LABELS[order.status] ?? STATUS_LABELS.new;
                  return (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{order.order_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary whitespace-nowrap">
                        {formatPrice(order.price_at_order)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium">
                            {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
                          </span>
                          {(() => {
                            const ps = PAYMENT_STATUS_LABEL[order.payment_status] ?? {
                              label: order.payment_status,
                              className: "bg-zinc-100 text-zinc-700",
                            };
                            return (
                              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${ps.className} w-fit`}>
                                {ps.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {order.design_image_url ? (
                          <a
                            href={order.design_image_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Tải về
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {Object.entries(STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedOrder(order)}
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Trang {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      {/* Order detail dialog */}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
