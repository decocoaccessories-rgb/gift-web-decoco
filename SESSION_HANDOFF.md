# Session Handoff — DECOCO Web V2

> Mục đích: file này tóm tắt mọi thứ đã làm trong session để bạn (hoặc Claude session khác) có thể đọc và **tiếp tục ngay** mà không cần đọc lại lịch sử chat.
>
> Cập nhật lần cuối: 2026-05-06.

---

## 1. Project context

- **Repo**: `decocoaccessories-rgb/gift-web-decoco` trên GitHub.
- **Local path**: `E:\decoco-web` (Windows, PowerShell).
- **Stack**: Next.js 16.2.4 (App Router, Turbopack), React 19, Tailwind CSS v4, Supabase SSR, Base UI, Resend, vnpay@2.5.0.
- **Branch**: `master` (trunk-based).
- **Auth GitHub**: hiện đang login bằng tài khoản `decocoaccessories-rgb` qua Windows Credential Manager (đã đổi từ `nguyentienhung2111-pixel`). Nếu push lỗi 403, chạy `cmdkey /delete:git:https://github.com` rồi push lại để re-login.
- **CLAUDE.md**: chứa PRD V2 (đã viết). Project rules nhập từ `AGENTS.md`.
- **IMPLEMENTATION_PLAN_V2.md**: checklist 5 phase, trạng thái cập nhật khi đi tới phase nào.

## 2. Trạng thái cao-tầng

| Phase | Mô tả | Status |
|-------|-------|--------|
| 0 | Setup (`vnpay` package, env example) | ✅ Done |
| 1 | Per-variant inventory | ✅ Code done & pushed; chưa smoke test trên Vercel |
| 2 | VNPAY QR payment | ✅ Code done & pushed; chưa set env, chưa test sandbox |
| 3 | Email Resend | ✅ Code done & pushed; chưa set RESEND_API_KEY thật |
| 4 | QA & Deploy | ⏳ Đang ở đây — chờ user cấu hình env Vercel |

**Bug fix riêng (đầu session)**: hero buttons readability — đã fix & push (commit `19c1444`).

## 3. Commits chính trên `master`

```
c34ded0 feat: order notification email via resend
9e1e0e6 feat: vnpay qr payment integration
aa4d76c feat: per-variant inventory tracking
19c1444 fix: hero buttons readable on image background
d12d105 fix: remove gray photo slot placeholders from design canvas
```

## 4. Database (Supabase project `xknkhczeuyjxtiljeaoz`)

Migrations đã apply (qua MCP tool):

- `005_decrement_variant_stock_rpc.sql` — RPC `decrement_variant_stock(p_product_id uuid, p_variant_id text)` dùng `FOR UPDATE` row lock + `jsonb_set`. Test 4 case đều pass.
- `006_add_payment_fields.sql` — thêm cols `payment_method`, `payment_status`, `vnp_txn_ref` (unique partial index), `vnp_transaction_no`, `paid_at` vào `orders`.

## 5. Schema thay đổi tóm tắt

**`products.variants` (JSONB)** — mỗi item:
```ts
{ id: string; name: string; image_url: string; stock?: number }
```

**`orders` (cột mới)**:
```sql
payment_method TEXT NOT NULL DEFAULT 'cod' CHECK IN ('cod','vnpay')
payment_status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','paid','failed','cancelled')
vnp_txn_ref TEXT (UNIQUE partial index where not null)
vnp_transaction_no TEXT
paid_at TIMESTAMPTZ
```

## 6. File map (mới + đụng tới)

**Phase 1 — variant inventory**
- `supabase/migrations/005_decrement_variant_stock_rpc.sql` (new)
- `lib/supabase/types.ts` — `ProductVariant` + Order Order type cho payment fields
- `app/api/admin/products/route.ts` + `[id]/route.ts` — Zod variant schema thêm `stock?`
- `app/admin/san-pham/ProductEditDialog.tsx` — input stock per variant; tổng `product.stock` auto-disable khi managed-by-variant
- `app/(site)/san-pham/[slug]/ProductInteractive.tsx` — hiện stock theo variant đã chọn
- `app/api/orders/route.ts` — variant-aware decrement, RPC call

**Phase 2 — VNPAY**
- `supabase/migrations/006_add_payment_fields.sql` (new)
- `lib/vnpay.ts` (new) — wrapper VNPay SDK (sandbox auto-detect, SHA512)
- `app/api/payments/vnpay/return/route.ts` (new) — verify return + redirect `/cam-on?pay=...`
- `app/api/payments/vnpay/ipn/route.ts` (new) — idempotent IPN: verify → amount check → flip paid → decrement stock
- `app/api/orders/route.ts` — accept `payment_method`, build paymentUrl cho VNPAY, defer stock decrement
- `app/(site)/dat-hang/page.tsx` — radio COD/VNPAY, redirect khi nhận `paymentUrl`
- `app/(site)/cam-on/page.tsx` — banner theo `?pay=success|failed|invalid`
- `app/admin/don-hang/page.tsx` + `OrderDetailDialog.tsx` — cột & dòng payment_method/payment_status/paid_at

**Phase 3 — Email**
- `lib/email/index.ts` (new) — `sendNewOrderEmail({ order, product })` với placeholder-key guard, fail-soft
- `lib/email/templates/new-order.ts` (new) — `renderNewOrderEmail(data)` HTML escaped
- `app/api/orders/route.ts` — gọi `sendNewOrderEmail` sau insert thành công

**Docs**
- `CLAUDE.md` — PRD V2 (3 features + env vars + acceptance criteria + out-of-scope)
- `IMPLEMENTATION_PLAN_V2.md` — checklist
- `BUG_REPORT.md` — bug fix hero buttons (đã đóng)
- `scripts/verify-hero-buttons.mjs` — test script cho bug fix

## 7. Env vars cần thiết

`.env.local.example` đã list (file local, `.gitignore` exclude). Đầy đủ:

```
# Supabase (đã có sẵn)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend
RESEND_API_KEY=               # cần lấy từ resend.com/api-keys
RESEND_FROM_EMAIL=onboarding@resend.dev
ADMIN_EMAIL=admin@decoco.vn   # legacy
NOTIFICATION_EMAIL=decoco.cskh@gmail.com

# App
NEXT_PUBLIC_APP_URL=          # production: URL Vercel; dev: http://localhost:3000

# VNPAY
VNPAY_TMN_CODE=               # cần đăng ký sandbox.vnpayment.vn
VNPAY_HASH_SECRET=            # cần đăng ký sandbox.vnpayment.vn
VNPAY_HOST=https://sandbox.vnpayment.vn
VNPAY_RETURN_PATH=/api/payments/vnpay/return
```

## 8. Đang chờ user (resume point)

User chọn **Cách A** để set env trên Vercel: dùng Vercel CLI.

**Đã làm**: cài `vercel@53.1.1` global qua npm.

**User cần làm tiếp** (chạy trong khung chat với prefix `!`):

```
! vercel login          # interactive, mở browser
! vercel link           # chọn project gift-web-decoco (hoặc tên trên Vercel)
```

Sau đó user phải **paste vào chat** các giá trị:

1. `VNPAY_TMN_CODE` — từ https://sandbox.vnpayment.vn (đăng ký merchant test free)
2. `VNPAY_HASH_SECRET` — đi cùng TMN code
3. `RESEND_API_KEY` — từ https://resend.com/api-keys
4. URL production Vercel (vd `https://gift-web-decoco.vercel.app`)

Khi đã có, Claude (session mới) sẽ chạy:
```bash
vercel env add VNPAY_TMN_CODE production
vercel env add VNPAY_TMN_CODE preview
vercel env add VNPAY_HASH_SECRET production
vercel env add VNPAY_HASH_SECRET preview
vercel env add VNPAY_HOST production            # value: https://sandbox.vnpayment.vn
vercel env add VNPAY_HOST preview               # value: https://sandbox.vnpayment.vn
vercel env add VNPAY_RETURN_PATH production     # value: /api/payments/vnpay/return
vercel env add VNPAY_RETURN_PATH preview        # value: /api/payments/vnpay/return
vercel env add NEXT_PUBLIC_APP_URL production   # value: <prod URL>
vercel env add NEXT_PUBLIC_APP_URL preview      # value: <preview URL>
vercel env add RESEND_API_KEY production
vercel env add RESEND_API_KEY preview
vercel env add RESEND_FROM_EMAIL production     # value: onboarding@resend.dev
vercel env add RESEND_FROM_EMAIL preview        # value: onboarding@resend.dev
vercel env add NOTIFICATION_EMAIL production    # value: decoco.cskh@gmail.com
vercel env add NOTIFICATION_EMAIL preview       # value: decoco.cskh@gmail.com
```

Lệnh `vercel env add` interactive — sẽ prompt nhập value. Có thể dùng pipe: `printf 'value\n' | vercel env add NAME production`.

Sau khi set xong → `vercel deploy --prod` (hoặc trigger redeploy trên dashboard) để env mới có hiệu lực.

## 9. ⚠️ Quan trọng — VNPAY IPN URL

**Trên VNPAY merchant portal (sandbox)**, vào **Cấu hình URL** và set:

- **Return URL**: `${NEXT_PUBLIC_APP_URL}/api/payments/vnpay/return`
- **IPN URL** (Notify URL / URL nhận thông báo): `${NEXT_PUBLIC_APP_URL}/api/payments/vnpay/ipn`

Không có IPN URL → `payment_status` sẽ kẹt ở `pending` mãi mãi vì IPN là source-of-truth duy nhất tin được.

IPN từ VNPAY **không reach localhost** → bắt buộc test trên Vercel preview/production.

## 10. Test data — VNPAY sandbox

Thẻ test NCB:
- Số thẻ: `9704198526463749517`
- Tên: `NGUYEN VAN A`
- Ngày phát hành: `07/15`
- OTP: `123456`

## 11. Smoke test plan (Phase 4)

Khi env Vercel set xong + IPN URL VNPAY cấu hình:

1. **Variant stock**:
   - Vào `/admin/san-pham`, sửa 1 product, thêm 2 variants với stock 3 và 5.
   - Vào trang sản phẩm public → chọn variant → đặt đơn → kho variant đó giảm 1.

2. **VNPAY**:
   - Đặt đơn chọn VNPAY → redirect sandbox.vnpayment.vn → thẻ test ở mục 10.
   - Sau pay, return về `/cam-on?pay=success` (banner xanh).
   - Check Vercel logs có IPN GET `/api/payments/vnpay/ipn` → DB `orders.payment_status='paid'`, `paid_at` được set, kho variant giảm.
   - Test fail: cancel ở gateway → `?pay=failed` (banner đỏ), kho không giảm.

3. **Email**:
   - Đặt bất kỳ đơn (COD hoặc VNPAY) → check inbox `decoco.cskh@gmail.com`.
   - **Lưu ý**: vì FROM là `onboarding@resend.dev`, email rất có thể vào **Spam folder**.
   - Production muốn từ `*@decoco.vn` thì cần verify domain trên Resend (DKIM/SPF) — **out of scope V2**.

## 12. Known gotchas

- **Git push permission**: nếu push 403, credentials đang dùng tài khoản sai. Fix: `cmdkey /delete:git:https://github.com` → push lại → đăng nhập đúng `decocoaccessories-rgb`.
- **VNPAY amount**: SDK `vnpay@2.5.0` **tự nhân 100**. Chỉ pass số VND (vd `100000` = 100k VND).
- **VNPAY hashAlgorithm**: phải là enum `HashAlgorithm.SHA512` (đã import từ `vnpay`).
- **Stock decrement timing**: COD trừ kho ngay khi order; VNPAY trừ kho **chỉ khi IPN xác nhận paid** — nếu user không pay, đơn ở `payment_status='pending'` vĩnh viễn (cleanup cron là V2.1, out of scope).
- **`payment_status='pending'` cho COD**: COD đơn cũng `pending` cho đến khi admin manually đánh dấu trong tương lai. Logic này có thể cần phân biệt rõ hơn (V2.1).
- **Idempotent IPN**: VNPAY có thể gửi IPN nhiều lần. Code đã handle: lookup `vnp_txn_ref`, nếu đã `paid` trả `InpOrderAlreadyConfirmed`.
- **`new_features_plan.md`, `product_highlights_plan.md`**: là plan files cũ của user, untracked, không liên quan V2.
- **`.env.local.example`**: bị `.gitignore` exclude (rule `.env*`). Mọi env vars mới đã document ở `CLAUDE.md` PRD section.
- **Type safety của `order` trong route**: dùng `as unknown as Order` ở `sendNewOrderEmail` call vì select trả subset cols. Acceptable vì chỉ dùng các field đã được select.

## 13. Out-of-scope V2 (đã chốt)

- Refund / hoàn tiền VNPAY
- Cron tự huỷ đơn VNPAY pending
- MoMo / ZaloPay / Payoo
- React Email / multi-language
- Verify domain decoco.vn cho Resend
- QR code render trên trang `/cam-on` (đã chốt redirect gateway)

## 14. Tham chiếu

- VNPay SDK: https://vnpay.js.org/en/
- VNPay best practices: https://vnpay.js.org/en/best-practices
- Resend Next.js: https://resend.com/docs/send-with-nextjs
- Supabase project ID: `xknkhczeuyjxtiljeaoz` (region ap-southeast-1)
- Plan file Claude: `C:\Users\Admin\.claude\plans\drifting-dreaming-owl.md` (chi tiết design)

---

## 15. Resume cheatsheet (cho session mới)

Khi bạn mở session mới, dán vào chat:

> Đọc `E:\decoco-web\SESSION_HANDOFF.md` rồi tiếp tục từ section "Đang chờ user (resume point)". Tôi đã chạy `vercel login` và `vercel link`. Đây là credentials:
>
> - VNPAY_TMN_CODE: `<paste>`
> - VNPAY_HASH_SECRET: `<paste>`
> - RESEND_API_KEY: `<paste>`
> - URL production: `<paste>`
>
> Set env Vercel rồi test giúp tôi.

Claude sẽ đọc file này, hiểu toàn bộ context và tiếp tục đúng chỗ.
