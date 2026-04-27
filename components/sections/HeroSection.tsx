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

  const [before, after] = headline.includes("—")
    ? headline.split("—").map((s) => s.trim())
    : [headline, ""];

  return (
    <section
      id="hero"
      className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-secondary/40 to-background overflow-hidden"
    >
      {heroImage && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={heroImage}
            alt="DECOCO Hero"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-20"
          />
        </div>
      )}
      <p className="text-sm font-medium text-primary uppercase tracking-widest mb-4">
        Hộp quà tặng cá nhân hoá
      </p>
      <h1 className="font-heading text-4xl md:text-6xl font-semibold leading-tight max-w-3xl">
        {after ? (
          <>
            {before} —{" "}
            <span className="text-primary">{after}</span>
          </>
        ) : (
          headline
        )}
      </h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
        {subtext}
      </p>
      <div className="mt-8 flex gap-3 flex-wrap justify-center">
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
      </div>
    </section>
  );
}
