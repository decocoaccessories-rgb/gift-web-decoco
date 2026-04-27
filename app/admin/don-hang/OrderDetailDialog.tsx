"use client";

import Image from "next/image";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/supabase/types";

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
  | "created_at"
>;

const STATUS_LABELS: Record<string, string> = {
  new: "Mới",
  confirmed: "Xác nhận",
  shipping: "Đang giao",
  done: "Hoàn thành",
  cancelled: "Huỷ",
};

interface Props {
  order: OrderRow;
  onClose: () => void;
}

export default function OrderDetailDialog({ order, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">{order.order_number}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Design image */}
          {order.design_image_url && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ảnh thiết kế
              </p>
              <div className="relative aspect-square w-48 rounded-lg overflow-hidden border border-border mx-auto">
                <Image
                  src={order.design_image_url}
                  alt="Thiết kế"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-center">
                <a
                  href={order.design_image_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  Tải ảnh thiết kế
                </a>
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin khách hàng
            </p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Họ tên</dt>
              <dd className="font-medium">{order.customer_name}</dd>
              <dt className="text-muted-foreground">SĐT</dt>
              <dd>
                <a href={`tel:${order.customer_phone}`} className="text-primary hover:underline">
                  {order.customer_phone}
                </a>
              </dd>
              {order.customer_email && (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{order.customer_email}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Tỉnh/TP</dt>
              <dd>{order.province}</dd>
              <dt className="text-muted-foreground">Địa chỉ</dt>
              <dd>{order.address}</dd>
              {order.note && (
                <>
                  <dt className="text-muted-foreground">Ghi chú</dt>
                  <dd className="italic">{order.note}</dd>
                </>
              )}
            </dl>
          </div>

          {/* Order info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin đơn
            </p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Giá trị</dt>
              <dd className="font-semibold text-primary">{formatPrice(order.price_at_order)}</dd>
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd>{STATUS_LABELS[order.status] ?? order.status}</dd>
              <dt className="text-muted-foreground">Thanh toán</dt>
              <dd>COD — Thanh toán khi nhận</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
