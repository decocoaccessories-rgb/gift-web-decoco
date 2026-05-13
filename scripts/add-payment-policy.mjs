import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const HTML_CONTENT = `
<div class="policy-content">
    <p style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 2.5rem;">
        DECOCO hỗ trợ nhiều hình thức thanh toán linh hoạt để quý khách có trải nghiệm mua sắm thuận tiện nhất. Mọi giao dịch tại website đều được đảm bảo an toàn và bảo mật thông tin.
    </p>

    <section style="margin-bottom: 3rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">1. Thanh toán khi nhận hàng (COD)</h2>
        <p style="color: #555; line-height: 1.6;">
            Quý khách thanh toán bằng tiền mặt trực tiếp cho nhân viên giao hàng ngay khi nhận được sản phẩm. Đây là hình thức thanh toán đơn giản và an toàn nhất.
        </p>
    </section>

    <section style="margin-bottom: 3rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">2. Chuyển khoản Ngân hàng</h2>
        <p style="color: #555; line-height: 1.6; margin-bottom: 1rem;">
            Quý khách có thể chuyển khoản trước qua tài khoản ngân hàng của DECOCO. Sau khi chuyển khoản, vui lòng gửi ảnh màn hình giao dịch cho Fanpage hoặc Hotline để chúng tôi xác nhận đơn hàng nhanh nhất.
        </p>
        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin-bottom: 0.5rem;"><strong>Ngân hàng:</strong> Techcombank</p>
            <p style="margin-bottom: 0.5rem;"><strong>Số tài khoản:</strong> [Vui lòng cập nhật số tài khoản]</p>
            <p style="margin-bottom: 0.5rem;"><strong>Chủ tài khoản:</strong> [Vui lòng cập nhật tên chủ tài khoản]</p>
            <p><strong>Nội dung chuyển khoản:</strong> [Số điện thoại] - [Mã đơn hàng]</p>
        </div>
    </section>

    <section style="margin-bottom: 3rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">3. Thanh toán trực tuyến</h2>
        <p style="color: #555; line-height: 1.6;">
            Chúng tôi hiện đang tích hợp các cổng thanh toán trực tuyến (VNPAY, Thẻ nội địa, Thẻ quốc tế). Quý khách có thể lựa chọn thanh toán ngay tại bước thanh toán để đơn hàng được xử lý tự động và nhanh chóng.
        </p>
    </section>

    <section style="background: #f0fff4; padding: 2rem; border-radius: 8px; border: 1px solid #c6f6d5;">
        <h2 style="font-size: 1.4rem; color: #276749; margin-bottom: 1rem;">Cam kết bảo mật</h2>
        <p style="line-height: 1.8; color: #22543d; margin: 0;">
            Hệ thống thanh toán của DECOCO được bảo vệ bởi các tiêu chuẩn bảo mật quốc tế. Chúng tôi cam kết không lưu giữ thông tin thẻ của khách hàng và mọi dữ liệu truyền tải đều được mã hóa SSL/TLS tuyệt đối an toàn.
        </p>
    </section>
</div>
`

async function main() {
  const { data, error } = await supabase
    .from('site_content')
    .upsert({
      key: 'policy_payment',
      value: HTML_CONTENT,
      section: 'policy',
      type: 'richtext',
      label: 'Chính sách thanh toán'
    }, { onConflict: 'key' })

  if (error) {
    console.error('Error inserting policy:', error)
  } else {
    console.log('Successfully inserted/updated payment policy.')
  }
}

main()
