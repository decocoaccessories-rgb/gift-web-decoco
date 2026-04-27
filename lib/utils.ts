import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format Vietnamese Dong: 299000 → "299.000 đ" */
export function formatPrice(price: number): string {
  return price.toLocaleString("vi-VN") + " đ";
}

/** Generate order number: DCO-20240427-A3B2 */
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DCO-${dateStr}-${random}`;
}

/** Convert base64 data URL to Blob */
export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}
