"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  title: string;
  body: string;
  cta: string;
}

const LS_KEY = "decoco_exit_offer_v1";
const SS_SHOWN = "decoco_exit_offer_shown";
const SS_CODE = "decoco_discount_code";
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const ARM_DELAY_MS = 3000;
// Cho phép popup ở /dat-hang (exit-intent lúc rời trang thanh toán chuyển đổi cao).
// Vẫn chặn ở trang QR và trang cảm ơn (sau khi đã đặt/thanh toán).
const SUPPRESSED_PATHS = ["/thanh-toan", "/cam-on"];
const APPLY_EVENT = "decoco:apply-discount";

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function ExitIntentOffer({ code, title, body, cta }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const suppressed =
    SUPPRESSED_PATHS.some((p) => pathname?.startsWith(p)) ||
    !!safeGet(typeof window !== "undefined" ? window.sessionStorage : undefined, SS_CODE);

  const markDismissed = useCallback(() => {
    safeSet(window.localStorage, LS_KEY, String(Date.now()));
    safeSet(window.sessionStorage, SS_SHOWN, "1");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    markDismissed();
  }, [markDismissed]);

  const accept = useCallback(() => {
    safeSet(window.sessionStorage, SS_CODE, code);
    safeSet(window.localStorage, LS_KEY, String(Date.now()));
    setOpen(false);

    if (pathname?.startsWith("/dat-hang")) {
      // Đã ở trang thanh toán — không điều hướng, chỉ báo cho form áp mã.
      window.dispatchEvent(new CustomEvent(APPLY_EVENT, { detail: code }));
      return;
    }

    // /dat-hang cần sessionStorage['decoco_design'] (được set bởi công cụ thiết
    // kế) để biết sản phẩm + giá. Chưa có thì đừng đẩy khách tới đó — sẽ gặp
    // trang trống "Chưa có thông tin thiết kế" và mã không áp được. Giữ mã lại,
    // nó tự động áp khi khách hoàn tất thiết kế và vào /dat-hang qua luồng thường.
    const hasDesign = !!safeGet(window.sessionStorage, "decoco_design");
    if (hasDesign) {
      router.push(`/dat-hang?code=${encodeURIComponent(code)}`);
    } else {
      toast.success(`Đã lưu mã ${code} — tự động áp khi bạn hoàn tất thiết kế và đặt hàng.`);
    }
  }, [code, router, pathname]);

  // Vũ trang lại MỖI KHI đổi trang (dep có `pathname`) để bẫy Back luôn nhắm
  // đúng trang hiện tại: entry lịch sử giả trỏ chính URL đang đứng, nên cú Back
  // đầu tiên chỉ gỡ nó ra — URL không đổi, không điều hướng — rồi mở popup.
  useEffect(() => {
    if (suppressed) return;
    if (safeGet(window.sessionStorage, SS_SHOWN)) return;

    const last = Number(safeGet(window.localStorage, LS_KEY) ?? 0);
    if (last && Date.now() - last < SUPPRESS_MS) return;

    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer:fine)").matches;

    let disarm = () => {};

    const trigger = () => {
      safeSet(window.sessionStorage, SS_SHOWN, "1");
      setOpen(true);
      disarm();
    };

    const armTimer = window.setTimeout(() => {
      if (finePointer) {
        const onMouseOut = (e: MouseEvent) => {
          if (!e.relatedTarget && e.clientY <= 0) trigger();
        };
        document.addEventListener("mouseout", onMouseOut);
        disarm = () => document.removeEventListener("mouseout", onMouseOut);
      } else {
        // Mobile: chèn 1 nấc lịch sử giả = ĐÚNG URL trang hiện tại.
        const trapUrl = window.location.href;
        history.pushState(null, "", trapUrl);
        const onPopState = () => {
          // `popstate` cũng bắn khi khách bấm 1 link cùng trang có "#hash" (vd
          // nút "Bắt đầu thiết kế ngay" trỏ "#design-tool") — đó là điều hướng
          // TIẾN, không phải ý định rời trang. Chỉ coi là bấm Back thật khi URL
          // đã quay đúng về URL lúc đặt bẫy (không thêm/đổi hash hay path).
          if (window.location.href === trapUrl) trigger();
        };
        window.addEventListener("popstate", onPopState);
        disarm = () => window.removeEventListener("popstate", onPopState);
      }
    }, ARM_DELAY_MS);

    return () => {
      window.clearTimeout(armTimer);
      disarm();
    };
  }, [suppressed, pathname]);

  // Lock scroll + focus + ESC/Tab trap while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ctaRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-offer-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl text-center"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
          Ưu đãi dành riêng cho bạn
        </p>
        <h2 id="exit-offer-title" className="font-heading text-2xl font-semibold mb-2">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{body}</p>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              },
              () => {}
            );
          }}
          className="mx-auto mb-4 flex items-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-5 py-2.5 font-mono text-lg font-bold tracking-wider text-primary"
        >
          {code}
          <span className="text-[11px] font-sans font-normal text-muted-foreground">
            {copied ? "Đã sao chép" : "Bấm để sao chép"}
          </span>
        </button>

        <button
          ref={ctaRef}
          type="button"
          onClick={accept}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {cta}
        </button>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
