import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Image Optimization quota (gói free) đã hết -> optimizer trả 402
    // khiến toàn bộ next/image không hiển thị. Phục vụ ảnh trực tiếp từ Supabase
    // (bucket public, đã healthy) để không phụ thuộc optimizer và không tốn phí.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
