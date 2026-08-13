"use client";

import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

type FallbackImageProps = ImageProps & {
  /** Extra classes applied to the fallback placeholder container. */
  fallbackClassName?: string;
};

/**
 * Drop-in replacement for next/image that renders a graceful DECOCO-branded
 * placeholder instead of the browser's broken-image icon when the source fails
 * to load (e.g. Supabase Storage timeout / 5xx) or when `src` is empty.
 */
export default function FallbackImage({
  src,
  alt,
  className,
  fallbackClassName,
  onError,
  ...rest
}: FallbackImageProps) {
  const [errored, setErrored] = useState(false);

  // Reset the error state whenever the source changes so a recovered/updated
  // image can load again.
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (errored || !src) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-secondary/30 ${fallbackClassName ?? ""}`}
        aria-label={typeof alt === "string" ? alt : undefined}
        role="img"
      >
        <ImageOff className="h-1/4 w-1/4 max-h-8 max-w-8 min-h-3.5 min-w-3.5 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        setErrored(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
