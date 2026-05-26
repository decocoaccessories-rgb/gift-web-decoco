import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách & Điều khoản | DECOCO",
  description:
    "Tổng hợp các chính sách hoạt động, bảo mật, đổi trả và thanh toán của DECOCO.",
};

const POLICIES = [
  {
    slug: "chinh-sach-bao-mat",
    title: "Chính sách bảo mật",
    description:
      "Quy định về cách chúng tôi thu thập, sử dụng và bảo mật tuyệt đối thông tin cá nhân của khách hàng.",
  },
  {
    slug: "dieu-khoan-su-dung",
    title: "Điều khoản sử dụng",
    description:
      "Các thỏa thuận pháp lý và điều kiện ràng buộc khi trải nghiệm, mua sắm dịch vụ trên website.",
  },
  {
    slug: "doi-tra",
    title: "Chính sách đổi trả",
    description:
      "Quy trình, thời hạn và điều kiện hỗ trợ đổi trả sản phẩm lỗi để đảm bảo quyền lợi tối đa cho bạn.",
  },
  {
    slug: "thanh-toan",
    title: "Phương thức thanh toán",
    description:
      "Hướng dẫn các hình thức thanh toán an toàn, linh hoạt (COD, cổng VNPAY QR, thẻ ngân hàng).",
  },
];

export default function PoliciesPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl min-h-[60vh]">
      <div className="text-center mb-12">
        <h1 className="font-heading text-3xl md:text-5xl font-semibold mb-4 text-primary">
          Chính sách & Điều khoản
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
          Chào mừng bạn đến với DECOCO. Dưới đây là các chính sách hoạt động chính
          thức của chúng tôi nhằm mang lại trải nghiệm mua sắm minh bạch và an tâm
          nhất.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {POLICIES.map((policy) => (
          <Link
            key={policy.slug}
            href={`/chinh-sach/${policy.slug}`}
            className="group relative flex flex-col justify-between p-6 rounded-2xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-sm"
          >
            <div>
              <h2 className="font-heading text-lg font-semibold mb-2 group-hover:text-primary transition-colors flex items-center justify-between">
                <span>{policy.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {policy.description}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 text-xs font-medium text-primary/80 group-hover:text-primary transition-colors flex items-center gap-1">
              Xem chi tiết chính sách
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
