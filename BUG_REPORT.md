# Báo cáo Lỗi: Bổ sung trang tổng hợp /chinh-sach, sửa liên kết và thêm ô tích bắt buộc tại trang đặt hàng

## Trạng thái
ĐÃ SỬA XONG — THÀNH CÔNG ✅

## Tiêu đề Lỗi
Thiếu trang tổng hợp chính sách `/chinh-sach`, liên kết điều khoản ở chân nút đặt hàng chưa trỏ đúng địa chỉ và thiếu checkbox đồng ý điều khoản bắt buộc.

## Mô tả Lỗi
Hiện tại trên website:
1. **Thiếu trang `/chinh-sach`**: Khi truy cập trực tiếp đường dẫn `/chinh-sach` hoặc liên kết từ nút khác, hệ thống sẽ trả về lỗi 404 do chưa có file `page.tsx` ở cấp thư mục `app/(site)/chinh-sach/`. Người dùng mong muốn trang này sẽ là trang tổng hợp hiển thị tên của cả 4 chính sách hiện có của website, nhấp vào tên mỗi chính sách sẽ dẫn sang link chi tiết tương ứng.
2. **Dòng consent text dưới nút "Đặt hàng" bị sai nội dung và thiếu liên kết**:
   - Nội dung hiện tại: *"Bằng cách đặt hàng, bạn đồng ý với điều khoản sử dụng của chúng tôi."*
   - Text *"điều khoản sử dụng"* chỉ là thẻ `<span>` tĩnh với gạch chân giả lập (`underline cursor-pointer`), không có liên kết thực sự dẫn đi đâu cả.
3. **Thiếu Checkbox bắt buộc đồng ý chính sách**:
   - Khách hàng có thể bấm nút Đặt hàng trực tiếp mà không cần xác nhận đã đọc chính sách.
   - Mong muốn: Có một ô tích (Checkbox) bắt buộc đứng trước dòng chữ consent: *"Tôi đã đọc và đồng ý với các chính sách trên website của chúng tôi."*.
   - Ràng buộc: Nút "Đặt hàng" chỉ khả dụng (không bị `disabled`) và cho phép click sau khi khách hàng đã tích chọn ô này.

## Các bước tái hiện
1. Truy cập trực tiếp đường dẫn `/chinh-sach` trên trình duyệt → Kết quả: **Lỗi 404 (Không tìm thấy trang)**.
2. Truy cập trang đặt hàng `/dat-hang`, cuộn xuống dưới nút **"Đặt hàng - Thanh toán..."** → Thấy dòng chữ *"Bằng cách đặt hàng, bạn đồng ý với điều khoản sử dụng của chúng tôi."* nhưng không có checkbox lựa chọn.
3. Nhấp trực tiếp vào nút **"Đặt hàng"** mà không cần tích chọn bất kỳ điều khoản nào → Hệ thống vẫn tiến hành submit form bình thường (nếu các trường thông tin khác hợp lệ).

## Kết quả Thực tế vs Kết quả Mong đợi

| Hạng mục | Kết quả Thực tế | Kết quả Mong đợi |
| :--- | :--- | :--- |
| **Đường dẫn `/chinh-sach`** | Lỗi 404 Not Found | Hiển thị trang tổng hợp 4 chính sách (Bảo mật, Điều khoản, Đổi trả, Thanh toán) với giao diện cao cấp. |
| **Dòng chữ dưới nút Đặt hàng** | "Bằng cách đặt hàng, bạn đồng ý với điều khoản sử dụng của chúng tôi." (Không có checkbox) | Checkbox + "Tôi đã đọc và đồng ý với các chính sách trên website của chúng tôi." |
| **Trạng thái nút Đặt hàng** | Luôn cho phép bấm đặt hàng | Bị vô hiệu hóa (`disabled`) cho đến khi ô checkbox đồng ý chính sách được tích chọn. |
| **Liên kết của dòng consent** | Cụm "điều khoản sử dụng" là text tĩnh không có link | Cụm "các chính sách" có gạch chân và liên kết tới `/chinh-sach` qua Next.js `Link`. |

## Ngữ cảnh & Môi trường
- **Môi trường**: Next.js (App Router), React, Tailwind CSS.
- **Thư mục liên quan**:
  - `app/(site)/chinh-sach/` (Chưa có `page.tsx` cấp ngoài).
  - `app/(site)/chinh-sach/[slug]/page.tsx` (Chứa định nghĩa `POLICY_MAP` cho 4 chính sách chi tiết).
  - `app/(site)/dat-hang/page.tsx` (Chứa form đặt hàng, nút đặt hàng và dòng consent text).

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

### 1. Vấn đề trang `/chinh-sach`
Trong Next.js App Router, cấu trúc thư mục hiện tại chỉ có `app/(site)/chinh-sach/[slug]/page.tsx` để phục vụ các trang động. Việc thiếu file `app/(site)/chinh-sach/page.tsx` tĩnh làm Next.js trả về lỗi 404 khi truy cập `/chinh-sach`.

### 2. Vấn đề dòng text và thiếu Checkbox ở trang Đặt hàng
Trong file `app/(site)/dat-hang/page.tsx` (Dòng 307 - 313), đoạn code đang render dạng text tĩnh bọc trong thẻ `<p>` thông thường, không tích hợp phần tử `<input type="checkbox">` cũng như state để quản lý việc bật/tắt thuộc tính `disabled` của nút Submit:
```tsx
<p className="text-xs text-muted-foreground text-center">
  Bằng cách đặt hàng, bạn đồng ý với{" "}
  <span className="underline cursor-pointer">
    điều khoản sử dụng
  </span>{" "}
  của chúng tôi.
</p>
```

### Sơ đồ Luồng Điều hướng & Trạng thái Hoạt động (ASCII Art)

```
[Trang Đặt Hàng] (/dat-hang)
      │
      ├─► [ ] Ô Checkbox Đồng Ý (Chưa tích) ──► Nút [Đặt Hàng] bị [DISABLED] (Không click được)
      │
      ├─► [x] Ô Checkbox Đồng Ý (Đã tích)   ──► Nút [Đặt Hàng] trở nên [ENABLED] (Có thể click)
      │
      └─► Click vào "các chính sách" (Link)
                │
                ▼
      ┌────────────────────────────────────────────────────────┐
      │  [Trang Tổng Hợp Chính Sách] (/chinh-sach)              │
      │  Hiển thị danh sách 4 chính sách dạng Card cao cấp     │
      └────────────────────────────────────────────────────────┘
                │
                ├─► 1. Chính sách bảo mật    ──► (/chinh-sach/chinh-sach-bao-mat)
                ├─► 2. Điều khoản sử dụng    ──► (/chinh-sach/dieu-khoan-su-dung)
                ├─► 3. Chính sách đổi trả    ──► (/chinh-sach/doi-tra)
                └─► 4. Phương thức thanh toán ──► (/chinh-sach/thanh-toan)
```

---

## Đề xuất Sửa lỗi (Proposed Fixes)

### Phương án: Tạo trang tổng hợp `/chinh-sach/page.tsx` mới và cập nhật logic Checkbox + Link trang Đặt hàng ⭐ KHUYẾN NGHỊ

#### Bước 1: Tạo file mới `app/(site)/chinh-sach/page.tsx`
Tạo một trang tĩnh tuyệt đẹp theo style cao cấp, tối giản của DECOCO:
- Tiêu đề sang trọng: `"Chính sách & Điều khoản dịch vụ"` dùng font chữ Playfair Display (`font-heading`).
- Grid 2 cột (hoặc 1 cột trên điện thoại) hiển thị 4 Card tương ứng 4 chính sách.
- Mỗi Card có:
  - Tên chính sách đậm nét, tinh tế.
  - Mô tả ngắn đầy đủ ý nghĩa (cụ thể hóa nội dung thay vì placeholder rỗng).
  - Hover micro-animation: Card dịch chuyển nhẹ lên trên (`-translate-y-1`), viền sáng nhẹ, mũi tên góc phải chuyển động trượt ngang.

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách & Điều khoản | DECOCO",
  description: "Tổng hợp các chính sách hoạt động, bảo mật, đổi trả và thanh toán của DECOCO.",
};

const POLICIES = [
  {
    slug: "chinh-sach-bao-mat",
    title: "Chính sách bảo mật",
    description: "Quy định về cách chúng tôi thu thập, sử dụng và bảo mật tuyệt đối thông tin cá nhân của khách hàng.",
  },
  {
    slug: "dieu-khoan-su-dung",
    title: "Điều khoản sử dụng",
    description: "Các thỏa thuận pháp lý và điều kiện ràng buộc khi trải nghiệm, mua sắm dịch vụ trên website.",
  },
  {
    slug: "doi-tra",
    title: "Chính sách đổi trả",
    description: "Quy trình, thời hạn và điều kiện hỗ trợ đổi trả sản phẩm lỗi để đảm bảo quyền lợi tối đa cho bạn.",
  },
  {
    slug: "thanh-toan",
    title: "Phương thức thanh toán",
    description: "Hướng dẫn các hình thức thanh toán an toàn, linh hoạt (COD, cổng VNPAY QR, thẻ ngân hàng).",
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
          Chào mừng bạn đến với DECOCO. Dưới đây là các chính sách hoạt động chính thức của chúng tôi nhằm mang lại trải nghiệm mua sắm minh bạch và an tâm nhất.
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
```

#### Bước 2: Cập nhật file `app/(site)/dat-hang/page.tsx`
1. Thêm import `Link` ở đầu file (nếu chưa có):
   ```tsx
   import Link from "next/link";
   ```
2. Thêm state quản lý việc tích chọn điều khoản ở trong `CheckoutPage` component:
   ```tsx
   const [policyAgreed, setPolicyAgreed] = useState(false);
   ```
3. Cập nhật nút Đặt hàng để bị disable khi chưa tích chọn checkbox hoặc khi đang submit:
   ```tsx
   <Button
     type="submit"
     size="lg"
     className="w-full"
     disabled={submitting || !policyAgreed}
   >
     {submitting
       ? "Đang xử lý..."
       : paymentMethod === "vnpay"
       ? "Đặt hàng — Thanh toán VNPAY"
       : "Đặt hàng — Thanh toán khi nhận hàng"}
   </Button>
   ```
4. Thay thế đoạn text tĩnh ở dưới nút bằng UI Checkbox + Link như sau:
   ```tsx
   <div className="flex items-start gap-2.5 justify-center py-2">
     <input
       type="checkbox"
       id="policy-agree-checkbox"
       checked={policyAgreed}
       onChange={(e) => setPolicyAgreed(e.target.checked)}
       className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
     />
     <label htmlFor="policy-agree-checkbox" className="text-xs text-muted-foreground select-none cursor-pointer leading-normal">
       Tôi đã đọc và đồng ý với{" "}
       <Link href="/chinh-sach" target="_blank" className="underline hover:text-primary transition-colors font-medium">
         các chính sách
       </Link>{" "}
       trên website của chúng tôi.
     </label>
   </div>
   ```

---

## Kế hoạch Xác minh

### 1. Kiểm tra trên Browser (Trang `/chinh-sach`)
- Điều hướng trực tiếp tới `/chinh-sach` để kiểm tra độ hiển thị của giao diện tổng hợp.
- Kiểm tra tính năng Responsive (trên thiết bị di động và máy tính) xem grid hiển thị ổn định không.
- Di chuyển chuột qua các card chính sách (hover) để xác nhận chuyển động mượt mà của micro-animations.
- Click thử vào từng card để xác nhận đường link chuyển tiếp sang `/chinh-sach/[slug]` hoạt động đúng.

### 2. Kiểm tra trên trang Đặt hàng `/dat-hang` (Trải nghiệm người dùng & Logic Checkbox)
- **Kiểm tra trạng thái mặc định**:
  - Khi mới truy cập trang, ô checkbox chưa được tích chọn.
  - Xác minh xem nút **"Đặt hàng - Thanh toán..."** có bị vô hiệu hóa (disabled - không thể tương tác/click) hay không.
- **Kiểm tra tương tác Checkbox**:
  - Click vào dòng chữ hoặc ô vuông checkbox để tích chọn.
  - Xác minh nút **"Đặt hàng"** lập tức được chuyển sang trạng thái kích hoạt (enabled) có thể click.
  - Bỏ tích chọn checkbox, nút **"Đặt hàng"** phải bị vô hiệu hóa trở lại.
- **Kiểm tra liên kết chính sách**:
  - Di chuột vào cụm từ *"các chính sách"* để xem hiệu ứng gạch chân và đổi màu.
  - Click vào cụm từ *"các chính sách"* để đảm bảo nó mở trang `/chinh-sach` trong tab mới (`target="_blank"`) để tránh làm mất dữ liệu form khách hàng đang điền dở trên trang đặt hàng.

---

## Kết quả Sửa lỗi (Fix Result)

**Trạng thái: THÀNH CÔNG ✅**

### Các thay đổi đã áp dụng (Minimal changes)
1. **Tạo mới** `app/(site)/chinh-sach/page.tsx` — trang tổng hợp 4 chính sách dạng grid card, slug khớp chính xác với `POLICY_MAP` trong `app/(site)/chinh-sach/[slug]/page.tsx` (`chinh-sach-bao-mat`, `dieu-khoan-su-dung`, `doi-tra`, `thanh-toan`).
2. **Cập nhật** `app/(site)/dat-hang/page.tsx`:
   - Thêm `import Link from "next/link";`.
   - Thêm state `const [policyAgreed, setPolicyAgreed] = useState(false);`.
   - Nút Đặt hàng: `disabled={submitting || !policyAgreed}`.
   - Thay đoạn `<p>` text tĩnh bằng checkbox bắt buộc + `<Link>` trỏ tới `/chinh-sach` (mở tab mới `target="_blank"`).

### Xác minh (Verification)
- Chạy `npm run build` → **PASS**. Cả 2 route `/chinh-sach` và `/chinh-sach/[slug]` xuất hiện trong bảng route, `/dat-hang` biên dịch không lỗi.

```
├ ƒ /cam-on
├ ƒ /chinh-sach
├ ƒ /chinh-sach/[slug]
├ ƒ /dat-hang
...
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

- Không có lỗi TypeScript / ESLint trong quá trình build.
