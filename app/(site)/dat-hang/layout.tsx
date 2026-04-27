import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đặt hàng | DECOCO",
  description: "Hoàn tất đặt hàng hộp quà tặng cá nhân hoá từ DECOCO.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
