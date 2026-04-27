"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import Image from "next/image";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import type { FeedbackItem } from "@/lib/supabase/types";

interface FeedbackCarouselProps {
  items: Pick<FeedbackItem, "id" | "image_url" | "alt_text">[];
}

export default function FeedbackCarousel({ items }: FeedbackCarouselProps) {
  if (!items.length) return null;

  return (
    <div className="w-full [--swiper-pagination-color:theme(colors.primary)] [--swiper-navigation-color:theme(colors.primary)]">
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        spaceBetween={16}
        slidesPerView={1}
        breakpoints={{
          640: { slidesPerView: 1 },
          768: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 3, spaceBetween: 24 },
        }}
        autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
        loop={items.length >= 3}
        pagination={{ clickable: true }}
        navigation
        className="pb-10"
      >
        {items.map((item) => (
          <SwiperSlide key={item.id}>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/20 shadow-sm">
              <Image
                src={item.image_url}
                alt={item.alt_text ?? "Đánh giá của khách hàng"}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
