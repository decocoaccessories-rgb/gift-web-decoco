import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DECOCO — Hộp Quà Tặng Cá Nhân Hoá",
    short_name: "DECOCO",
    description: "Thiết kế hộp quà tặng độc đáo với ảnh của bạn chỉ trong 5 phút",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#E91E8C",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
