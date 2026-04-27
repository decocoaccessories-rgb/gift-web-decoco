"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Thumbs, FreeMode } from "swiper/modules";
import { useState } from "react";
import Image from "next/image";
import type { SwiperClass } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/thumbs";
import "swiper/css/free-mode";

interface ImageSliderProps {
  images: string[];
  alt: string;
}

export default function ImageSlider({ images, alt }: ImageSliderProps) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);

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
        thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
        navigation={images.length > 1}
        className="aspect-square rounded-xl overflow-hidden border border-border [--swiper-navigation-color:theme(colors.primary)]"
      >
        {images.map((src, i) => (
          <SwiperSlide key={i}>
            <div className="relative w-full h-full">
              <Image
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
                <Image
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
