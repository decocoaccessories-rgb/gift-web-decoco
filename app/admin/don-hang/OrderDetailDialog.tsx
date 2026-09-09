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
  | "recipient_name"
  | "recipient_phone"
  | "discount_code"
  | "discount_amount"
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
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "referrer"
  | "landing_page"
  | "created_at"
>;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "COD — Thanh toán khi nhận",
  vnpay: "VNPAY",
  vietqr: "Chuyển khoản VietQR",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

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
  // Người nhận có thể khác người đặt (đơn tặng quà). Fallback về customer_* cho đơn cũ.
  const recipientName = order.recipient_name ?? order.customer_name;
  const recipientPhone = order.recipient_phone ?? order.customer_phone;
  const isGift =
    recipientName !== order.customer_name || recipientPhone !== order.customer_phone;

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

          {/* Người đặt — CSKH gọi xác nhận */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Người đặt · gọi xác nhận đơn
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
            </dl>
          </div>

          {/* Người nhận — shipper giao hàng */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Người nhận · shipper giao hàng
              {isGift && (
                <span className="ml-2 text-primary normal-case">🎁 đơn tặng quà</span>
              )}
            </p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Họ tên</dt>
              <dd className="font-medium">{recipientName}</dd>
              <dt className="text-muted-foreground">SĐT</dt>
              <dd>
                <a href={`tel:${recipientPhone}`} className="text-primary hover:underline">
                  {recipientPhone}
                </a>
              </dd>
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
              {order.variant_name && (
                <>
                  <dt className="text-muted-foreground">Phân loại</dt>
                  <dd className="font-medium">{order.variant_name}</dd>
                </>
              )}
              {order.discount_amount > 0 && (
                <>
                  <dt className="text-muted-foreground">Mã giảm giá</dt>
                  <dd>
                    <span className="font-mono">{order.discount_code}</span>{" "}
                    <span className="text-primary">− {formatPrice(order.discount_amount)}</span>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Giá trị</dt>
              <dd className="font-semibold text-primary">
                {order.discount_amount > 0 && (
                  <span className="mr-1.5 font-normal text-muted-foreground line-through">
                    {formatPrice(order.price_at_order + order.discount_amount)}
                  </span>
                )}
                {formatPrice(order.price_at_order)}
              </dd>
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd>{STATUS_LABELS[order.status] ?? order.status}</dd>
              <dt className="text-muted-foreground">Phương thức TT</dt>
              <dd>{PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}</dd>
              <dt className="text-muted-foreground">TT trạng thái</dt>
              <dd>
                {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
                {order.paid_at && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({new Date(order.paid_at).toLocaleString("vi-VN")})
                  </span>
                )}
              </dd>
            </dl>
          </div>

          {/* Nguồn marketing (first-touch) — chỉ hiện khi có dữ liệu */}
          {(order.utm_source ||
            order.utm_medium ||
            order.utm_campaign ||
            order.referrer) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nguồn đơn · marketing
              </p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                {order.utm_source && (
                  <>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-medium">{order.utm_source}</dd>
                  </>
                )}
                {order.utm_medium && (
                  <>
                    <dt className="text-muted-foreground">Medium</dt>
                    <dd>{order.utm_medium}</dd>
                  </>
                )}
                {order.utm_campaign && (
                  <>
                    <dt className="text-muted-foreground">Campaign</dt>
                    <dd>{order.utm_campaign}</dd>
                  </>
                )}
                {order.utm_content && (
                  <>
                    <dt className="text-muted-foreground">Content</dt>
                    <dd>{order.utm_content}</dd>
                  </>
                )}
                {order.utm_term && (
                  <>
                    <dt className="text-muted-foreground">Term</dt>
                    <dd>{order.utm_term}</dd>
                  </>
                )}
                {order.referrer && (
                  <>
                    <dt className="text-muted-foreground">Referrer</dt>
                    <dd className="break-all">{order.referrer}</dd>
                  </>
                )}
                {order.landing_page && (
                  <>
                    <dt className="text-muted-foreground">Landing</dt>
                    <dd className="break-all">{order.landing_page}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
