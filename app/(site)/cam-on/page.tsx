import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đặt hàng thành công | DECOCO",
};

interface PageProps {
  searchParams: Promise<{ id?: string; num?: string }>;
}

export default async function ThankYouPage({ searchParams }: PageProps) {
  const { id, num } = await searchParams;

  return (
    <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
      <div className="flex justify-center mb-6">
        <CheckCircle className="h-16 w-16 text-primary" strokeWidth={1.5} />
      </div>

      <h1 className="font-heading text-3xl md:text-4xl font-semibold mb-3">
        Cảm ơn bạn đã đặt hàng!
      </h1>

      {num && (
        <p className="text-lg font-medium text-primary mb-2">
          Mã đơn: <span className="font-bold">{num}</span>
        </p>
      )}

      <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto mb-2">
        Chúng tôi sẽ liên hệ xác nhận đơn trong vòng{" "}
        <strong>2 giờ</strong>. Vui lòng để ý điện thoại nhé!
      </p>

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
          Xem thêm sản phẩm
        </Link>
      </div>
    </div>
  );
}
