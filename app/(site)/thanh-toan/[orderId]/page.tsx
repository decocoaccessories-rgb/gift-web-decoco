"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { Loader2, CheckCircle, Clock, Copy, Check } from "lucide-react";

interface VietqrStatus {
  orderNumber: string;
  paymentStatus: "pending" | "paid" | "failed" | "cancelled";
  amount: number;
  content: string | null;
  qrUrl: string | null;
  expiresAt: string | null;
}

const POLL_MS = 4000;

export default function VietqrPaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<VietqrStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/vietqr/status/${orderId}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return null;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as VietqrStatus;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, [orderId]);

  // Polling trạng thái thanh toán.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      const data = await fetchStatus();
      if (!active) return;
      if (data?.paymentStatus === "paid") {
        router.push(
          `/cam-on?id=${orderId}&num=${encodeURIComponent(data.orderNumber)}&pay=success`
        );
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchStatus, orderId, router]);

  // Đồng hồ đếm ngược.
  useEffect(() => {
    if (!status?.expiresAt) return;
    const target = new Date(status.expiresAt).getTime();
    const update = () => setRemaining(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [status?.expiresAt]);

  function copyContent() {
    if (!status?.content) return;
    navigator.clipboard?.writeText(status.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <h1 className="font-heading text-2xl font-semibold mb-3">
          Không tìm thấy đơn hàng
        </h1>
        <p className="text-muted-foreground mb-6">
          Liên kết thanh toán không hợp lệ hoặc đã hết hạn.
        </p>
        <Link href="/san-pham" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}>
          Xem sản phẩm
        </Link>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p>Đang tạo mã thanh toán…</p>
      </div>
    );
  }

  if (status.paymentStatus === "paid") {
    return (
      <div className="container mx-auto px-4 py-32 flex flex-col items-center text-center">
        <CheckCircle className="h-14 w-14 text-emerald-500 mb-3" strokeWidth={1.5} />
        <p className="text-lg font-medium">Đã nhận thanh toán! Đang chuyển trang…</p>
      </div>
    );
  }

  const expired = remaining !== null && remaining <= 0;
  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, "0") : "--";
  const ss = remaining !== null ? String(remaining % 60).padStart(2, "0") : "--";

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="text-center mb-6">
        <p className="text-sm font-medium text-primary uppercase tracking-widest mb-1">
          Chuyển khoản VietQR
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          Quét mã để thanh toán
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mã đơn: <span className="font-semibold">{status.orderNumber}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        {/* QR */}
        <div className="relative mx-auto w-60 h-60 rounded-xl overflow-hidden border border-border bg-white flex items-center justify-center">
          {status.qrUrl && !expired ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.qrUrl} alt="Mã QR thanh toán" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-sm text-muted-foreground px-4">
              {expired ? "Mã QR đã hết hạn" : "Không tải được mã QR"}
            </div>
          )}
        </div>

        {/* Countdown */}
        {!expired ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Mã hết hạn sau{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {mm}:{ss}
              </span>
            </span>
          </div>
        ) : (
          <div className="text-center">
            <Link
              href="/san-pham"
              className={cn(buttonVariants({ size: "sm" }), "rounded-full px-6")}
            >
              Đặt lại đơn mới
            </Link>
          </div>
        )}

        {/* Amount + content */}
        <div className="space-y-2 text-sm border-t border-border pt-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Số tiền</span>
            <span className="font-semibold text-primary">{formatPrice(status.amount)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground shrink-0">Nội dung CK</span>
            <button
              type="button"
              onClick={copyContent}
              className="flex items-center gap-1.5 font-mono font-semibold text-foreground hover:text-primary transition-colors"
              title="Sao chép nội dung"
            >
              {status.content}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <ol className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-4 py-3 space-y-1 list-decimal list-inside">
          <li>Mở app ngân hàng, chọn quét QR.</li>
          <li>
            Giữ <strong>nguyên số tiền</strong> và <strong>nội dung chuyển khoản</strong>.
          </li>
          <li>Trang sẽ tự chuyển khi nhận được thanh toán (vài giây).</li>
        </ol>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang chờ thanh toán…
        </div>
      </div>
    </div>
  );
}
