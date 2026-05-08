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
      <head>
        {/* Design-tool fonts (used by canvas IText, listed in TextPropsPanel) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Dancing+Script&family=Great+Vibes&family=Lobster&family=Montserrat:wght@400;700&family=Nunito:wght@400;700&family=Oswald&family=Pacifico&family=Raleway:wght@400;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
