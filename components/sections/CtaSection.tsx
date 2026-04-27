import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CtaSectionProps {
  content: Record<string, string>;
}

export default function CtaSection({ content }: CtaSectionProps) {
  const headline =
    content.cta_headline ?? "Bắt đầu thiết kế ngay hôm nay";
  const subtext =
    content.cta_subtext ?? "Chỉ mất 5 phút để tạo ra một món quà sẽ được nhớ mãi";
  const buttonText = content.cta_button_text ?? "Mua ngay";

  return (
    <section
      id="cta"
      className="py-20 px-4 bg-primary text-primary-foreground text-center"
    >
      <div className="container mx-auto max-w-2xl">
        <h2 className="font-heading text-3xl md:text-4xl font-semibold">
          {headline}
        </h2>
        <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto">
          {subtext}
        </p>
        <div className="mt-8">
          <Link
            href="/san-pham"
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "rounded-full px-8"
            )}
          >
            {buttonText}
          </Link>
        </div>
      </div>
    </section>
  );
}
