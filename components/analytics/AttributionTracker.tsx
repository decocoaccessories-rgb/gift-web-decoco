"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/analytics/attribution";

/**
 * Ghi nhận nguồn marketing (first-touch) vào localStorage khi khách vào
 * storefront. Không render gì. Chỉ đặt trong `(site)` layout — không chạy ở
 * /admin. Chạy độc lập với <Analytics /> (vốn tắt ở môi trường dev), vì đây
 * là dữ liệu vận hành cần cả khi test.
 */
export default function AttributionTracker() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution();
  }, [pathname]);
  return null;
}
