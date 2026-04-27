import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["vietnamese", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DECOCO — Hộp Quà Tặng Cá Nhân Hoá",
    template: "%s | DECOCO",
  },
  description:
    "Thiết kế hộp quà tặng độc đáo với ảnh của bạn. Set trang sức DECOCO kết hợp hộp in ảnh cá nhân hoá — món quà ý nghĩa nhất.",
  keywords: ["quà tặng", "hộp quà", "cá nhân hoá", "trang sức", "DECOCO", "in ảnh"],
  authors: [{ name: "DECOCO" }],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "DECOCO",
    title: "DECOCO — Hộp Quà Tặng Cá Nhân Hoá",
    description:
      "Thiết kế hộp quà tặng độc đáo với ảnh của bạn. Set trang sức DECOCO kết hợp hộp in ảnh cá nhân hoá.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
