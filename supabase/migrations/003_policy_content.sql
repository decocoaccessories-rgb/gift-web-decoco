-- ============================================================
-- DECOCO — Add Policy / Legal Pages content
-- ============================================================
INSERT INTO site_content (key, value, type, section, label) VALUES
  ('policy_privacy',
   '<p>Nội dung chính sách bảo mật đang được cập nhật.</p>',
   'richtext', 'policy', 'Chính sách bảo mật'),
  ('policy_terms',
   '<p>Nội dung điều khoản sử dụng đang được cập nhật.</p>',
   'richtext', 'policy', 'Điều khoản sử dụng'),
  ('policy_return',
   '<div class="policy-content">
    <!-- GIỚI THIỆU CHUNG -->
    <p style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 2.5rem;">
        Chào mừng bạn đến với DECOCO. Để đảm bảo quyền lợi tốt nhất và minh bạch trong quá trình mua sắm, chúng tôi xin gửi đến quý khách chi tiết chính sách giao nhận và đổi trả hàng hóa. Đây cũng là cam kết của chúng tôi về chất lượng dịch vụ.
    </p>

    <!-- PHẦN 1: CHÍNH SÁCH GIAO HÀNG & KIỂM HÀNG -->
    <section style="margin-bottom: 4rem;">
        <h2 style="font-size: 1.6rem; margin-bottom: 1.5rem; border-left: 4px solid #333; padding-left: 1rem;">1. CHÍNH SÁCH GIAO HÀNG & KIỂM HÀNG</h2>
        
        <div style="border: 1px solid #eee; border-radius: 12px; overflow: hidden; margin-bottom: 2rem;">
            <div style="background: #333; color: #fff; padding: 1.2rem 1.5rem; font-weight: 600;">
                TÓM TẮT THÔNG TIN GIAO NHẬN
            </div>
            <div style="padding: 1.5rem;">
                <table style="width: 100%; border-collapse: collapse; line-height: 2;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; width: 40%;">Phạm vi giao hàng</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">Toàn quốc (63 tỉnh thành)</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666;">Thời gian xử lý</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">Đơn hàng được xác nhận trong vòng 24h</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666;">Thời gian giao hàng</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">Nội thành: 1-2 ngày | Tỉnh thành: 3-5 ngày</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666;">Phí vận chuyển</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500; color: #22c55e;">Miễn phí (Freeship cho tất cả đơn hàng trên website)</td>
                    </tr>
                </table>
            </div>
        </div>

        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.2rem; margin-bottom: 0.8rem; color: #1e293b;">Quy định kiểm hàng (Đồng kiểm)</h3>
            <p style="color: #475569; line-height: 1.6;">
                DECOCO áp dụng chính sách <strong>cho phép kiểm tra hàng</strong> trước khi nhận. Khi shipper giao tới, bạn vui lòng kiểm tra ngoại quan gói hàng và sản phẩm bên trong. 
                <br><br>
                - Nếu sản phẩm đúng mẫu mã, không hư hỏng: Bạn tiến hành nhận hàng và thanh toán.
                <br>
                - Nếu sản phẩm có dấu hiệu hư hỏng, sai mẫu: Bạn có quyền từ chối nhận hàng và liên hệ ngay Hotline để được hỗ trợ gửi lại đơn mới.
            </p>
        </div>

        <p style="font-size: 0.95rem; color: #666; font-style: italic;">
            * Lưu ý: Trong trường hợp giao hàng chậm trễ do lỗi khách quan (thời tiết, dịch bệnh...), DECOCO sẽ chủ động thông báo và hỗ trợ khách hàng hủy đơn nếu không còn nhu cầu.
        </p>
    </section>

    <!-- PHẦN 2: CHÍNH SÁCH ĐỔI TRẢ -->
    <section style="margin-bottom: 4rem;">
        <h2 style="font-size: 1.6rem; margin-bottom: 1.5rem; border-left: 4px solid #333; padding-left: 1rem;">2. CHÍNH SÁCH ĐỔI TRẢ</h2>

        <div style="border: 1px solid #eee; border-radius: 12px; overflow: hidden; margin-bottom: 3rem;">
            <div style="background: #333; color: #fff; padding: 1.2rem 1.5rem; font-weight: 600;">
                TÓM TẮT ĐIỀU KIỆN ĐỔI TRẢ
            </div>
            <div style="padding: 1.5rem;">
                <table style="width: 100%; border-collapse: collapse; line-height: 2;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666; width: 40%;">Thời gian áp dụng</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">48 giờ kể từ khi nhận hàng</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666;">Tình trạng sản phẩm</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">Nguyên tem mác, chưa qua sử dụng</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #666;">Bằng chứng cần thiết</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: 500;">Video khui hàng (unboxing)</td>
                    </tr>
                </table>
            </div>
        </div>

        <div style="margin-bottom: 3rem;">
            <h3 style="font-size: 1.3rem; margin-bottom: 1.5rem;">Quy trình 3 bước đổi hàng</h3>
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
                    <div style="background: #000; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">1</div>
                    <div>
                        <h4 style="font-size: 1.1rem; margin: 0 0 0.4rem 0;">Gửi yêu cầu</h4>
                        <p style="color: #555; line-height: 1.6; margin: 0;">Liên hệ Fanpage hoặc Hotline, gửi kèm video khui hàng và mô tả lỗi/nhu cầu đổi mẫu.</p>
                    </div>
                </div>
                <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
                    <div style="background: #000; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">2</div>
                    <div>
                        <h4 style="font-size: 1.1rem; margin: 0 0 0.4rem 0;">Gửi hàng về kho</h4>
                        <p style="color: #555; line-height: 1.6; margin: 0;">Sau khi được xác nhận, bạn đóng gói và gửi hàng về địa chỉ được hướng dẫn. Lưu ý giữ lại vận đơn.</p>
                    </div>
                </div>
                <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
                    <div style="background: #000; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">3</div>
                    <div>
                        <h4 style="font-size: 1.1rem; margin: 0 0 0.4rem 0;">Kiểm tra & Xử lý</h4>
                        <p style="color: #555; line-height: 1.6; margin: 0;">DECOCO kiểm tra sản phẩm và gửi hàng mới hoặc hoàn tiền trong vòng 3-5 ngày làm việc.</p>
                    </div>
                </div>
            </div>
        </div>

        <div style="background: #fff8f0; padding: 2.2rem; border-radius: 12px; border: 1px solid #fee2e2;">
            <h3 style="font-size: 1.4rem; color: #9a3412; margin-top: 0; margin-bottom: 1.2rem; border-bottom: 1px solid #ffedd5; padding-bottom: 0.5rem; font-weight: 600;">Lưu ý quan trọng về Hoàn trả & Đổi mới</h3>
            <ul style="line-height: 1.8; color: #7c2d12; margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 1rem;">
                <li>
                    <strong>Quy định về Sản phẩm Cá nhân hóa:</strong> 
                    Vì tất cả các đơn hàng tại DECOCO đều được thiết kế và in ảnh cá nhân hóa theo yêu cầu riêng biệt của quý khách, đây là các sản phẩm độc bản và không thể tái sử dụng. Do đó, DECOCO <strong>không áp dụng chính sách trả hàng và hoàn tiền</strong> cho các trường hợp thay đổi nhu cầu cá nhân sau khi đơn hàng đã được đưa vào sản xuất. Kính mong quý khách cân nhắc kỹ lưỡng và kiểm tra kỹ thông tin thiết kế trước khi xác nhận đặt hàng và thanh toán.
                </li>
                <li>
                    <strong>Cam kết Chất lượng (Trường hợp phát sinh lỗi):</strong> 
                    Đối với các trường hợp sản phẩm bị lỗi do phía nhà sản xuất (hộp quà in mờ, sai thiết kế so với bản duyệt, sản phẩm đứt gãy, hỏng chốt...) hoặc hư hại trong quá trình vận chuyển, DECOCO cam kết hỗ trợ chính sách <strong>đổi mới 1-đổi-1 hoàn toàn miễn phí</strong>. Trong trường hợp này, DECOCO sẽ chịu 100% chi phí vận chuyển 2 chiều.
                </li>
                <li>
                    <strong>Đổi mẫu theo nhu cầu (Sản phẩm chưa in ảnh, chưa sử dụng):</strong> 
                    Hỗ trợ đổi mẫu mã hoặc màu sắc sản phẩm trang sức trong vòng 48 giờ kể từ khi nhận hàng. Quý khách vui lòng thanh toán chi phí vận chuyển 2 chiều theo biểu giá thực tế của đối tác vận chuyển.
                </li>
                <li>
                    <strong>Trách nhiệm Hàng hóa:</strong> 
                    DECOCO cam kết chịu trách nhiệm đối với mọi rủi ro về mất mát hoặc hư hỏng của sản phẩm trong suốt hành trình vận chuyển từ kho đến tận tay quý khách.
                </li>
            </ul>
        </div>
    </section>
</div>',
   'richtext', 'policy', 'Chính sách đổi trả')
ON CONFLICT (key) DO NOTHING;
