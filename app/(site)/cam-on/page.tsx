import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đặt hàng thành công | DECOCO",
};

interface PageProps {
  searchParams: Promise<{ id?: string; num?: string; pay?: string }>;
}

export default async function ThankYouPage({ searchParams }: PageProps) {
  const { id, num, pay } = await searchParams;

  const isPayFailed = pay === "failed" || pay === "invalid";
  const isPaySuccess = pay === "success";

  return (
    <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
      <div className="flex justify-center mb-6">
        {isPayFailed ? (
          <AlertTriangle className="h-16 w-16 text-destructive" strokeWidth={1.5} />
        ) : (
          <CheckCircle className="h-16 w-16 text-primary" strokeWidth={1.5} />
        )}
      </div>

      <h1 className="font-heading text-3xl md:text-4xl font-semibold mb-3">
        {isPayFailed ? "Thanh toán chưa thành công" : "Cảm ơn bạn đã đặt hàng!"}
      </h1>

      {num && (
        <p className="text-lg font-medium text-primary mb-2">
          Mã đơn: <span className="font-bold">{num}</span>
        </p>
      )}

      {isPaySuccess ? (
        <div className="rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 px-4 py-3 text-sm max-w-md mx-auto mb-4 flex items-center gap-2 justify-center">
          <Clock className="h-4 w-4" />
          <span>
            Chúng tôi đang xác nhận giao dịch — bạn sẽ nhận thông báo khi hoàn tất.
          </span>
        </div>
      ) : isPayFailed ? (
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto mb-2">
          Giao dịch VNPAY chưa hoàn tất. Bạn có thể thử lại hoặc chọn hình thức
          thanh toán khác.
        </p>
      ) : (
        <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto mb-2">
          Chúng tôi sẽ liên hệ xác nhận đơn trong vòng{" "}
          <strong>2 giờ</strong>. Vui lòng để ý điện thoại nhé!
        </p>
      )}

      {id && (
        <p className="text-xs text-muted-foreground/60 mb-8">
          Mã tham chiếu: {id}
        </p>
      )}

      <div className="flex gap-3 flex-wrap justify-center mt-8">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-full px-8"
          )}
        >
          Về trang chủ
        </Link>
        <Link
          href="/san-pham"
          className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}
        >
          {isPayFailed ? "Đặt lại đơn khác" : "Xem thêm sản phẩm"}
        </Link>
      </div>
    </div>
  );
}
