"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Thumbs, FreeMode } from "swiper/modules";
import { useEffect, useState } from "react";
import FallbackImage from "@/components/ui/FallbackImage";
import type { SwiperClass } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/thumbs";
import "swiper/css/free-mode";

interface ImageSliderProps {
  images: string[];
  alt: string;
  variantClickTrigger?: number;
}

export default function ImageSlider({ images, alt, variantClickTrigger }: ImageSliderProps) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);
  const [mainSwiper, setMainSwiper] = useState<SwiperClass | null>(null);

  // Khi phân loại được chọn/đổi, mảng ảnh đưa ảnh phân loại lên đầu (index 0).
  // Buộc slider chính trượt về index 0 để hiển thị đúng ảnh phân loại.
  useEffect(() => {
    if (mainSwiper && !mainSwiper.destroyed) {
      mainSwiper.slideTo(0);
    }
  }, [images, variantClickTrigger, mainSwiper]);

  if (!images.length) {
    return (
      <div className="aspect-square rounded-xl bg-secondary/30 flex items-center justify-center">
        <p className="font-heading text-4xl italic text-primary/20">DECOCO</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main slider */}
      <Swiper
        modules={[Navigation, Thumbs]}
        onSwiper={setMainSwiper}
        thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
        navigation={images.length > 1}
        className="aspect-square rounded-xl overflow-hidden border border-border [--swiper-navigation-color:theme(colors.primary)]"
      >
        {images.map((src, i) => (
          <SwiperSlide key={i}>
            <div className="relative w-full h-full">
              <FallbackImage
                src={src}
                alt={`${alt} - ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Thumbnails */}
      {images.length > 1 && (
        <Swiper
          modules={[FreeMode, Thumbs]}
          onSwiper={setThumbsSwiper}
          spaceBetween={8}
          slidesPerView={Math.min(images.length, 5)}
          freeMode
          watchSlidesProgress
          className="h-16"
        >
          {images.map((src, i) => (
            <SwiperSlide key={i} className="cursor-pointer opacity-50 [&.swiper-slide-thumb-active]:opacity-100 transition-opacity">
              <div className="relative w-full h-full rounded-md overflow-hidden border border-border">
                <FallbackImage
                  src={src}
                  alt={`${alt} thumbnail ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
