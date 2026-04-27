import FeedbackCarousel from "@/components/ui/FeedbackCarousel";
import type { FeedbackItem } from "@/lib/supabase/types";

interface FeedbackSectionProps {
  items: Pick<FeedbackItem, "id" | "image_url" | "alt_text">[];
}

export default function FeedbackSection({ items }: FeedbackSectionProps) {
  return (
    <section id="feedback" className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
            Khách hàng nói gì
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold">
            Cảm nhận thực tế
          </h2>
        </div>

        {items.length > 0 ? (
          <FeedbackCarousel items={items} />
        ) : (
          <p className="text-center text-muted-foreground italic">
            Đánh giá đang được cập nhật.
          </p>
        )}
      </div>
    </section>
  );
}
