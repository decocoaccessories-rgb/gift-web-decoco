"use client";

import { usePathname } from "next/navigation";
import { GoogleTagManager } from "@next/third-parties/google";
import { GTM_CONTAINER_ID } from "@/lib/analytics/gtm";

/**
 * Nạp container Google Tag Manager cho toàn site.
 *
 * - Không đo ở môi trường dev (`next dev`) để số liệu không lẫn dữ liệu test.
 *   Muốn thử tại local thì tạm bỏ điều kiện này hoặc chạy `npm run build && npm start`.
 * - Bỏ qua /admin để lưu lượng nội bộ không lẫn vào số liệu khách hàng.
 * - Đặt `NEXT_PUBLIC_GTM_ID=` (rỗng) ở môi trường Preview trên Vercel nếu không
 *   muốn bản preview bắn dữ liệu vào container thật.
 */
export default function Analytics() {
  const pathname = usePathname();

  if (!GTM_CONTAINER_ID) return null;
  if (process.env.NODE_ENV !== "production") return null;
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <GoogleTagManager gtmId={GTM_CONTAINER_ID} />
      {/* Dự phòng cho trình duyệt tắt JavaScript (bước 2 của snippet GTM). */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
