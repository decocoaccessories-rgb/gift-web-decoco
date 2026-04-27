import FaqAccordion from "@/components/ui/FaqAccordion";
import type { FaqItem } from "@/lib/supabase/types";

const DEFAULT_FAQ: Pick<FaqItem, "id" | "question" | "answer">[] = [
  {
    id: "1",
    question: "Thời gian sản xuất và giao hàng bao lâu?",
    answer:
      "Sau khi xác nhận đơn hàng, chúng tôi sản xuất trong 3–5 ngày làm việc. Thời gian giao hàng thêm 1–3 ngày tùy khu vực.",
  },
  {
    id: "2",
    question: "Chất lượng in ảnh lên hộp như thế nào?",
    answer:
      "Chúng tôi sử dụng công nghệ in UV độ nét cao, màu sắc trung thực, bền đẹp và không phai màu theo thời gian.",
  },
  {
    id: "3",
    question: "Tôi có thể chỉnh sửa đơn hàng sau khi đặt không?",
    answer:
      "Bạn có thể liên hệ chúng tôi trong vòng 2 giờ sau khi đặt để chỉnh sửa. Sau thời gian này, đơn hàng đã được đưa vào sản xuất.",
  },
  {
    id: "4",
    question: "Chính sách đổi trả như thế nào?",
    answer:
      "Chúng tôi hoàn trả 100% nếu lỗi từ phía sản xuất. Sản phẩm cá nhân hoá không áp dụng đổi trả vì lý do cá nhân.",
  },
  {
    id: "5",
    question: "Bên trong hộp quà có gì?",
    answer:
      "Mỗi sản phẩm đi kèm bộ trang sức DECOCO được mô tả trong trang sản phẩm, đặt trong hộp in ảnh cá nhân hoá theo thiết kế của bạn.",
  },
  {
    id: "6",
    question: "Có giao hàng toàn quốc không?",
    answer:
      "Có, chúng tôi giao hàng toàn quốc qua các đối tác vận chuyển Giao Hàng Nhanh và J&T Express.",
  },
  {
    id: "7",
    question: "Bảo quản trang sức như thế nào?",
    answer:
      "Tránh tiếp xúc với nước, hóa chất và mồ hôi. Lau sạch bằng vải mềm sau khi đeo và bảo quản trong hộp khi không sử dụng.",
  },
];

interface FaqSectionProps {
  items: Pick<FaqItem, "id" | "question" | "answer">[];
}

export default function FaqSection({ items }: FaqSectionProps) {
  const displayItems = items.length > 0 ? items : DEFAULT_FAQ;

  return (
    <section id="faq" className="py-20 px-4 bg-secondary/20">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
            Giải đáp thắc mắc
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold">
            Câu hỏi thường gặp
          </h2>
        </div>
        <FaqAccordion items={displayItems} />
      </div>
    </section>
  );
}
