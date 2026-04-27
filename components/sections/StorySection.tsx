import Image from "next/image";

const DEFAULT_TEXT_1 =
  "DECOCO ra đời năm 2019 tại Hà Nội với một sứ mệnh đơn giản: biến từng món quà thành một kỷ niệm không thể nào quên. Chúng tôi tin rằng trang sức đẹp nhất không phải là đắt nhất, mà là cái mang theo câu chuyện của bạn.";
const DEFAULT_TEXT_2 =
  "Với hộp quà in ảnh cá nhân hoá độc quyền, bạn có thể đưa những khoảnh khắc quý giá nhất lên mặt hộp — biến món quà thành một tác phẩm nghệ thuật mang dấu ấn riêng. Chỉ cần 5 phút thiết kế, DECOCO sẽ lo phần còn lại.";

interface StorySectionProps {
  content: Record<string, string>;
}

export default function StorySection({ content }: StorySectionProps) {
  const text1 = content.story_text_1 ?? DEFAULT_TEXT_1;
  const text2 = content.story_text_2 ?? DEFAULT_TEXT_2;
  const storyImage = content.story_image ?? "";

  return (
    <section id="story" className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="space-y-5">
            <p className="text-sm font-medium text-primary uppercase tracking-widest">
              Về chúng tôi
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold leading-snug">
              Câu chuyện <span className="text-primary italic">DECOCO</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">{text1}</p>
            <p className="text-muted-foreground leading-relaxed">{text2}</p>
          </div>

          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary/30">
            {storyImage ? (
              <Image
                src={storyImage}
                alt="DECOCO Story"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-heading text-6xl font-semibold italic text-primary/20">
                  DECOCO
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
