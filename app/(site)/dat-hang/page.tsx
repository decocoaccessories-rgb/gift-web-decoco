"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import provinces from "@/public/data/provinces.json";

const schema = z.object({
  customer_name: z.string().min(2, "Vui lòng nhập họ tên (tối thiểu 2 ký tự)"),
  customer_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  customer_email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),
  province: z.string().min(1, "Vui lòng chọn tỉnh/thành phố"),
  address: z.string().min(10, "Địa chỉ cần tối thiểu 10 ký tự"),
  note: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface DesignInfo {
  productId: string;
  productName: string;
  productPrice: number;
  designImageUrl?: string;
  frameId?: string;
  canvasJSON?: string;
  variantName?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [designInfo, setDesignInfo] = useState<DesignInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "vnpay">("cod");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("decoco_design");
      if (raw) setDesignInfo(JSON.parse(raw));
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  async function onSubmit(values: FormValues) {
    if (!designInfo) {
      setServerError("Không tìm thấy thông tin thiết kế. Vui lòng quay lại chọn sản phẩm.");
      return;
    }

    setSubmitting(true);
    setServerError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: designInfo.productId,
          frame_id: designInfo.frameId ?? undefined,
          design_image_url: designInfo.designImageUrl ?? undefined,
          design_data: designInfo.canvasJSON
            ? JSON.parse(designInfo.canvasJSON)
            : undefined,
          variant_name: designInfo.variantName ?? null,
          payment_method: paymentMethod,
          ...values,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setServerError("Rất tiếc, sản phẩm vừa hết hàng. Vui lòng chọn sản phẩm khác.");
        } else {
          setServerError(data.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
        }
        return;
      }

      sessionStorage.removeItem("decoco_design");

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }

      router.push(`/cam-on?id=${data.orderId}&num=${data.orderNumber}`);
    } catch {
      setServerError("Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary uppercase tracking-widest mb-1">
          Bước cuối cùng
        </p>
        <h1 className="font-heading text-3xl font-semibold">Đặt hàng</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="customer_name">Họ và tên *</Label>
              <Input
                id="customer_name"
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                {...register("customer_name")}
                aria-invalid={!!errors.customer_name}
              />
              {errors.customer_name && (
                <p className="text-xs text-destructive">
                  {errors.customer_name.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="customer_phone">Số điện thoại *</Label>
              <Input
                id="customer_phone"
                type="tel"
                placeholder="0901234567"
                autoComplete="tel"
                {...register("customer_phone")}
                aria-invalid={!!errors.customer_phone}
              />
              {errors.customer_phone && (
                <p className="text-xs text-destructive">
                  {errors.customer_phone.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="customer_email">
                Email{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (không bắt buộc)
                </span>
              </Label>
              <Input
                id="customer_email"
                type="email"
                placeholder="example@email.com"
                autoComplete="email"
                {...register("customer_email")}
                aria-invalid={!!errors.customer_email}
              />
              {errors.customer_email && (
                <p className="text-xs text-destructive">
                  {errors.customer_email.message}
                </p>
              )}
            </div>

            {/* Province */}
            <div className="space-y-1.5">
              <Label htmlFor="province">Tỉnh/Thành phố *</Label>
              <select
                id="province"
                {...register("province")}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                aria-invalid={!!errors.province}
                defaultValue=""
              >
                <option value="" disabled>
                  Chọn tỉnh/thành phố
                </option>
                {(provinces as string[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {errors.province && (
                <p className="text-xs text-destructive">
                  {errors.province.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address">Địa chỉ chi tiết *</Label>
              <Input
                id="address"
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện"
                autoComplete="street-address"
                {...register("address")}
                aria-invalid={!!errors.address}
              />
              {errors.address && (
                <p className="text-xs text-destructive">
                  {errors.address.message}
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note">
                Ghi chú{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (không bắt buộc)
                </span>
              </Label>
              <textarea
                id="note"
                rows={3}
                placeholder="Yêu cầu đặc biệt, thời gian giao hàng..."
                {...register("note")}
                className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label>Phương thức thanh toán *</Label>
              <div className="grid gap-2">
                <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Thanh toán khi nhận hàng (COD)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Nhân viên sẽ xác nhận đơn trước khi giao.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                  <input
                    type="radio"
                    name="payment_method"
                    value="vnpay"
                    checked={paymentMethod === "vnpay"}
                    onChange={() => setPaymentMethod("vnpay")}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">VNPAY (QR / ATM / Visa)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Chuyển sang cổng VNPAY để thanh toán an toàn.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {serverError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting
                ? "Đang xử lý..."
                : paymentMethod === "vnpay"
                ? "Đặt hàng — Thanh toán VNPAY"
                : "Đặt hàng — Thanh toán khi nhận hàng"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Bằng cách đặt hàng, bạn đồng ý với{" "}
              <span className="underline cursor-pointer">
                điều khoản sử dụng
              </span>{" "}
              của chúng tôi.
            </p>
          </form>
        </div>

        {/* Order summary */}
        <div className="md:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 sticky top-24">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Đơn hàng
            </h2>

            {designInfo ? (
              <>
                {designInfo.designImageUrl && (
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-secondary/20">
                    <Image
                      src={designInfo.designImageUrl}
                      alt="Thiết kế của bạn"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium leading-snug">
                    {designInfo.productName}
                  </p>
                  {designInfo.variantName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Phân loại: {designInfo.variantName}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {formatPrice(designInfo.productPrice)}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Vận chuyển</span>
                    <span>Miễn phí</span>
                  </div>
                  <div className="flex justify-between font-semibold text-sm text-foreground mt-1">
                    <span>Tổng</span>
                    <span>{formatPrice(designInfo.productPrice)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2">
                  {paymentMethod === "vnpay"
                    ? "Thanh toán qua VNPAY (QR / ATM / Visa)"
                    : "Thanh toán khi nhận hàng (COD)"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Chưa có thông tin thiết kế
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
