"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import provinces from "@/public/data/provinces.json";
import {
  stashPendingPurchase,
  trackBeginCheckout,
  trackPurchase,
} from "@/lib/analytics/gtm";

const schema = z.object({
  customer_name: z.string().min(2, "Vui lòng nhập họ tên người đặt (tối thiểu 2 ký tự)"),
  customer_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  customer_email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),
  recipient_name: z
    .string()
    .min(2, "Vui lòng nhập họ tên người nhận (tối thiểu 2 ký tự)"),
  recipient_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại người nhận không hợp lệ (10 số, bắt đầu bằng 0)"),
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
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "vnpay" | "vietqr">("vietqr");
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [selfReceive, setSelfReceive] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<
    { code: string; discount_amount: number; final_amount: number } | null
  >(null);
  const [discountError, setDiscountError] = useState("");
  const [discountChecking, setDiscountChecking] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const customerName = watch("customer_name");
  const customerPhone = watch("customer_phone");

  // "Tôi là người nhận hàng": đồng bộ thông tin người đặt sang người nhận.
  useEffect(() => {
    if (!selfReceive) return;
    setValue("recipient_name", customerName ?? "", { shouldValidate: true });
    setValue("recipient_phone", customerPhone ?? "", { shouldValidate: true });
  }, [selfReceive, customerName, customerPhone, setValue]);

  function toggleSelfReceive(checked: boolean) {
    setSelfReceive(checked);
    if (!checked) {
      setValue("recipient_name", "");
      setValue("recipient_phone", "");
    }
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("decoco_design");
      if (!raw) return;
      const parsed: DesignInfo = JSON.parse(raw);
      setDesignInfo(parsed);
      // GA4 begin_checkout — khách đã có thiết kế và đang ở bước điền thông tin.
      trackBeginCheckout({
        item_id: parsed.productId,
        item_name: parsed.productName,
        item_variant: parsed.variantName,
        price: parsed.productPrice,
      });
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const subtotal = designInfo?.productPrice ?? 0;
  const orderTotal = discountApplied ? discountApplied.final_amount : subtotal;

  const applyDiscount = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code || !designInfo) return;
      setDiscountChecking(true);
      setDiscountError("");
      try {
        const res = await fetch("/api/discounts/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, order_amount: designInfo.productPrice }),
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          setDiscountApplied({
            code: data.code,
            discount_amount: data.discount_amount,
            final_amount: data.final_amount,
          });
          setDiscountInput(data.code);
        } else {
          setDiscountApplied(null);
          setDiscountError(data.message ?? "Mã giảm giá không hợp lệ.");
        }
      } catch {
        setDiscountApplied(null);
        setDiscountError("Không kiểm tra được mã, vui lòng thử lại.");
      } finally {
        setDiscountChecking(false);
      }
    },
    [designInfo]
  );

  function removeDiscount() {
    setDiscountApplied(null);
    setDiscountError("");
    setDiscountInput("");
    try {
      sessionStorage.removeItem("decoco_discount_code");
    } catch {
      /* ignore */
    }
  }

  // Prefill mã từ ?code= hoặc sessionStorage (popup exit-intent) rồi tự áp.
  useEffect(() => {
    if (!designInfo || discountApplied) return;
    let prefill = "";
    try {
      prefill =
        new URLSearchParams(window.location.search).get("code") ??
        sessionStorage.getItem("decoco_discount_code") ??
        "";
    } catch {
      /* ignore */
    }
    if (prefill) {
      setDiscountInput(prefill);
      applyDiscount(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designInfo]);

  // Popup exit-intent hiện ngay trên trang này → áp mã mà không điều hướng.
  useEffect(() => {
    function onApply(e: Event) {
      const code = (e as CustomEvent<string>).detail;
      if (code) {
        setDiscountInput(code);
        applyDiscount(code);
      }
    }
    window.addEventListener("decoco:apply-discount", onApply);
    return () => window.removeEventListener("decoco:apply-discount", onApply);
  }, [applyDiscount]);

  // Khi đã có mã áp vào đơn, đánh dấu để popup không làm phiền nữa.
  useEffect(() => {
    if (!discountApplied) return;
    try {
      sessionStorage.setItem("decoco_discount_code", discountApplied.code);
    } catch {
      /* ignore */
    }
  }, [discountApplied]);

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
          discount_code: discountApplied?.code ?? undefined,
          ...values,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setServerError("Rất tiếc, sản phẩm vừa hết hàng. Vui lòng chọn sản phẩm khác.");
        } else if (res.status === 422 && data.discount_error) {
          setDiscountApplied(null);
          setDiscountError(data.discount_error);
          setServerError("Mã giảm giá không còn hợp lệ. Vui lòng bỏ mã hoặc nhập mã khác rồi đặt lại.");
        } else {
          setServerError(data.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
        }
        return;
      }

      sessionStorage.removeItem("decoco_design");
      try {
        sessionStorage.removeItem("decoco_discount_code");
      } catch {
        /* ignore */
      }

      // GA4 purchase. Đơn COD tính là chuyển đổi ngay khi đặt; đơn cần chuyển
      // khoản thì cất lại, chờ trang /thanh-toan xác nhận SePay đã nhận tiền —
      // để đơn bỏ dở không thổi phồng doanh thu trong báo cáo.
      const purchasePayload = {
        transactionId: String(data.orderNumber ?? data.orderId),
        value: orderTotal,
        coupon: discountApplied?.code,
        paymentMethod,
        item: {
          item_id: designInfo.productId,
          item_name: designInfo.productName,
          item_variant: designInfo.variantName,
          price: designInfo.productPrice,
        },
      };
      if (data.vietqr) {
        stashPendingPurchase(String(data.orderId), purchasePayload);
      } else {
        trackPurchase(purchasePayload);
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }

      if (data.vietqr) {
        router.push(`/thanh-toan/${data.orderId}`);
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
            {/* ===== Section 1: Người đặt hàng ===== */}
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Thông tin người đặt
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  DECOCO sẽ liên hệ số này để xác nhận đơn trước khi giao. Thông
                  tin người nhận quà nằm ở mục bên dưới.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="customer_name">Họ và tên người đặt *</Label>
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
                <Label htmlFor="customer_phone">Số điện thoại người đặt *</Label>
                <Input
                  id="customer_phone"
                  type="tel"
                  placeholder="0901234567"
                  autoComplete="tel"
                  {...register("customer_phone")}
                  aria-invalid={!!errors.customer_phone}
                />
                <p className="text-xs text-muted-foreground">
                  DECOCO sẽ gọi số này để xác nhận đơn (không gọi người nhận quà).
                </p>
                {errors.customer_phone && (
                  <p className="text-xs text-destructive">
                    {errors.customer_phone.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="customer_email">
                  Email người đặt{" "}
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
                <p className="text-xs text-muted-foreground">
                  Nhận email biên nhận và cập nhật tiến độ đơn hàng.
                </p>
                {errors.customer_email && (
                  <p className="text-xs text-destructive">
                    {errors.customer_email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Self-receive shortcut */}
            <label className="flex items-start gap-2.5 rounded-lg border border-input p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={selfReceive}
                onChange={(e) => toggleSelfReceive(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                Tôi là người nhận hàng (tự mua cho bản thân)
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Tự động dùng tên và SĐT người đặt làm thông tin người nhận.
                </span>
              </span>
            </label>

            {/* ===== Section 2: Người nhận hàng ===== */}
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Thông tin người nhận hàng
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đơn vị vận chuyển sẽ giao tới địa chỉ và liên hệ số điện thoại
                  này.
                </p>
              </div>

              {!selfReceive && (
                <>
                  {/* Recipient name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="recipient_name">Họ và tên người nhận *</Label>
                    <Input
                      id="recipient_name"
                      placeholder="Trần Thị B"
                      {...register("recipient_name")}
                      aria-invalid={!!errors.recipient_name}
                    />
                    {errors.recipient_name && (
                      <p className="text-xs text-destructive">
                        {errors.recipient_name.message}
                      </p>
                    )}
                  </div>

                  {/* Recipient phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="recipient_phone">
                      Số điện thoại người nhận *
                    </Label>
                    <Input
                      id="recipient_phone"
                      type="tel"
                      placeholder="0909876543"
                      {...register("recipient_phone")}
                      aria-invalid={!!errors.recipient_phone}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shipper sẽ gọi số này khi phát hàng.
                    </p>
                    {errors.recipient_phone && (
                      <p className="text-xs text-destructive">
                        {errors.recipient_phone.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Province */}
              <div className="space-y-1.5">
                <Label htmlFor="province">Tỉnh/Thành phố *</Label>
              <select
                id="province"
                {...register("province")}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
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
            </div>
            {/* ===== End Section 2 ===== */}

            {/* Discount code */}
            <div className="space-y-1.5">
              <Label htmlFor="discount_code">
                Mã giảm giá{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (không bắt buộc)
                </span>
              </Label>
              {discountApplied ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                  <span>
                    ✓ Đã áp mã <strong>{discountApplied.code}</strong> — giảm{" "}
                    {formatPrice(discountApplied.discount_amount)}
                  </span>
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Bỏ
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="discount_code"
                    placeholder="Nhập mã (vd. GIAM50K)"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyDiscount(discountInput)}
                    disabled={discountChecking || !discountInput.trim()}
                  >
                    {discountChecking ? "Đang kiểm tra..." : "Áp dụng"}
                  </Button>
                </div>
              )}
              {discountError && (
                <p className="text-xs text-destructive">{discountError}</p>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label>Phương thức thanh toán *</Label>
              <div className="grid gap-2">
                <label className="flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                  <input
                    type="radio"
                    name="payment_method"
                    value="vietqr"
                    checked={paymentMethod === "vietqr"}
                    onChange={() => setPaymentMethod("vietqr")}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Chuyển khoản VietQR</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quét mã QR, đơn tự xác nhận sau khi chuyển khoản.
                    </p>
                  </div>
                </label>
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
                      Thanh toán bằng tiền mặt khi đơn vị vận chuyển giao hàng.
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
              disabled={submitting || !policyAgreed}
            >
              {submitting
                ? "Đang xử lý..."
                : paymentMethod === "vnpay"
                ? "Đặt hàng — Thanh toán VNPAY"
                : paymentMethod === "vietqr"
                ? "Đặt hàng — Chuyển khoản VietQR"
                : "Đặt hàng — Thanh toán khi nhận hàng"}
            </Button>

            <div className="flex items-start gap-2.5 justify-center py-2">
              <input
                type="checkbox"
                id="policy-agree-checkbox"
                checked={policyAgreed}
                onChange={(e) => setPolicyAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <label
                htmlFor="policy-agree-checkbox"
                className="text-xs text-muted-foreground select-none cursor-pointer leading-normal"
              >
                Tôi đã đọc và đồng ý với{" "}
                <Link
                  href="/chinh-sach"
                  target="_blank"
                  className="underline hover:text-primary transition-colors font-medium"
                >
                  các chính sách
                </Link>{" "}
                trên website của DECOCO.
              </label>
            </div>
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
                    <span>Tạm tính</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vận chuyển</span>
                    <span>Miễn phí</span>
                  </div>
                  {discountApplied && (
                    <div className="flex justify-between text-primary">
                      <span>Giảm giá ({discountApplied.code})</span>
                      <span>− {formatPrice(discountApplied.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-sm text-foreground mt-1">
                    <span>Tổng</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2">
                  {paymentMethod === "vnpay"
                    ? "Thanh toán qua VNPAY (QR / ATM / Visa)"
                    : paymentMethod === "vietqr"
                    ? "Chuyển khoản VietQR — tự xác nhận"
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
