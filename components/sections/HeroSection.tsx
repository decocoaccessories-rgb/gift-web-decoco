import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_HEADLINE =
  "Tặng quà không chỉ là món đồ — tặng cả một kỷ niệm";
const DEFAULT_SUBTEXT =
  "Thiết kế hộp quà với ảnh của bạn chỉ trong 5 phút. Trang sức DECOCO kết hợp hộp in ảnh cá nhân hoá — món quà ý nghĩa nhất.";

interface HeroSectionProps {
  content: Record<string, string>;
}

export default function HeroSection({ content }: HeroSectionProps) {
  const headline = content.hero_headline ?? DEFAULT_HEADLINE;
  const subtext = content.hero_subtext ?? DEFAULT_SUBTEXT;
  const heroImage = content.hero_image ?? "";
  const hasImage = !!heroImage;

  const [before, after] = headline.includes("—")
    ? headline.split("—").map((s) => s.trim())
    : [headline, ""];

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
    >
      {hasImage ? (
        <>
          <div className="absolute inset-0 -z-10">
            <Image
              src={heroImage}
              alt="DECOCO Hero"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-black/50" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/40 to-background" />
      )}

      <p className={cn(
        "text-sm font-medium uppercase tracking-widest mb-4",
        hasImage ? "text-white/80" : "text-primary"
      )}>
        Hộp quà tặng cá nhân hoá
      </p>

      <h1 className={cn(
        "font-heading text-4xl md:text-6xl font-semibold leading-tight max-w-3xl",
        hasImage ? "text-white" : ""
      )}>
        {after ? (
          <>
            {before} —{" "}
            <span className={hasImage ? "text-white/90" : "text-primary"}>{after}</span>
          </>
        ) : (
          headline
        )}
      </h1>

      <p className={cn(
        "mt-6 text-lg max-w-xl leading-relaxed",
        hasImage ? "text-white/80" : "text-muted-foreground"
      )}>
        {subtext}
      </p>

      <div className="mt-8 flex gap-3 flex-wrap justify-center">
        {hasImage ? (
          <>
            <Link
              href="/san-pham"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 bg-white text-foreground hover:bg-white/90!")}
            >
              Khám phá quà tặng
            </Link>
            <Link
              href="/#story"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full px-8 bg-transparent border-white text-white hover:bg-white/10 hover:text-white"
              )}
            >
              Tìm hiểu thêm
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/san-pham"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}
            >
              Khám phá quà tặng
            </Link>
            <Link
              href="/#story"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full px-8"
              )}
            >
              Tìm hiểu thêm
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
