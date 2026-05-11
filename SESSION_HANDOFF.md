# Session Handoff — DECOCO Web V2

> Mục đích: file này tóm tắt mọi thứ đã làm trong session để bạn (hoặc Claude session khác) có thể đọc và **tiếp tục ngay** mà không cần đọc lại lịch sử chat.
>
> Cập nhật lần cuối: 2026-05-11.

---

## 1. Project context

- **Repo**: `decocoaccessories-rgb/gift-web-decoco` trên GitHub.
- **Local path**: `E:\decoco-web` (Windows, PowerShell).
- **Stack**: Next.js 16.2.4 (App Router, Turbopack), React 19, Tailwind CSS v4, Supabase SSR, Base UI, Resend, vnpay@2.5.0.
- **Branch**: `master` (trunk-based).
- **Auth GitHub**: hiện đang login bằng tài khoản `decocoaccessories-rgb` qua Windows Credential Manager (đã đổi từ `nguyentienhung2111-pixel`). Nếu push lỗi 403, chạy `cmdkey /delete:git:https://github.com` rồi push lại để re-login.
- **Auth Vercel**: phải login `decoco.accessories@gmail.com` (team `decocoaccessories-rgbs-projects`, project `gift-web-decoco`). Nếu login nhầm `nguyentienhung2111-pixel`, mọi lệnh `vercel env *` sẽ fail vì team đó chỉ có project `decoco-web` cũ. Kiểm tra trước bằng `vercel whoami` + `vercel teams ls`.
- **Production domain**: `https://trangsucdecoco.vn` (đã alias vào Vercel project `gift-web-decoco`). PRD trong CLAUDE.md nói "decoco.vn" — outdated, domain thật là `trangsucdecoco.vn`. DNS quản lý ở **Mắt Bão**.
- **CLAUDE.md**: chứa PRD V2 (đã viết). Project rules nhập từ `AGENTS.md`.
- **IMPLEMENTATION_PLAN_V2.md**: checklist 5 phase, trạng thái cập nhật khi đi tới phase nào.

## 2. Trạng thái cao-tầng

| Phase | Mô tả | Status |
|-------|-------|--------|
| 0 | Setup (`vnpay` package, env example) | ✅ Done |
| 1 | Per-variant inventory | ✅ Code done & pushed; chưa smoke test trên Vercel |
| 2 | VNPAY QR payment | ✅ Code done & pushed; chưa set env, chưa test sandbox |
| 3 | Email Resend | ✅ **DONE end-to-end** — domain verified, prod env set, đơn test thực tế trên prod đã gửi mail về `decoco.cskh@gmail.com` (2026-05-11) |
| 4 | QA & Deploy | ⏳ Email done. VNPAY env + smoke test còn lại. Variant smoke test còn lại. |

**Bug fix riêng**: hero buttons readability — đã fix & push (commit `19c1444`). Design export fix sau đó (commits `a9a3265`, `56e0da5`, `c9b7ec0`) đã verified trên production.

## 3. Commits chính trên `master`

```
8cd7bd9 chore(env): commit .env.local.example with verified Resend FROM domain
c9b7ec0 docs(bug-report): add production verification results for design-export fix
56e0da5 fix(design-export): post canvas as JPEG multipart to avoid Vercel 4.5MB limit
a9a3265 fix(design-export): surface storage upload failures instead of swallowing them
fcdcd42 fix: include section/type/label in site_content upsert for hero_image_mobile
d5772e6 feat(home): separate hero background images for desktop and mobile
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

## 7. Env vars

`.env.local.example` giờ **đã được track trong git** (commit `8cd7bd9` — thêm exception cho rule `.env*` trong `.gitignore`). Tham chiếu file đó cho danh sách đầy đủ.

**Trạng thái env (2026-05-11):**

| Env | Local `.env.local` | Vercel production | Vercel preview |
|-----|--------------------|-------------------|-----------------|
| Supabase 3 keys | ✅ | ✅ | ✅ |
| `RESEND_API_KEY` | ✅ thực | ✅ thực | ❌ chưa set |
| `RESEND_FROM_EMAIL` | ✅ `noreply@trangsucdecoco.vn` | ✅ `noreply@trangsucdecoco.vn` | ❌ |
| `NOTIFICATION_EMAIL` | ✅ `decoco.cskh@gmail.com` | ✅ `decoco.cskh@gmail.com` | ❌ |
| `NEXT_PUBLIC_APP_URL` | ✅ `http://localhost:3000` | ✅ `https://trangsucdecoco.vn` | ❌ |
| `VNPAY_TMN_CODE` | ❌ | ❌ | ❌ |
| `VNPAY_HASH_SECRET` | ❌ | ❌ | ❌ |
| `VNPAY_HOST` | ❌ (mặc định sandbox trong code) | ❌ | ❌ |
| `VNPAY_RETURN_PATH` | ❌ | ❌ | ❌ |

**Lưu ý preview env**: Vercel CLI 53 không cho `vercel env add NAME preview --yes` non-interactive; CLI đòi git-branch và `master` bị reject vì là production branch. Khi cần test trên feature branch, set qua dashboard.

## 8. Đang chờ user (resume point)

**Email feature — ✅ DONE**, không còn cần làm gì nữa cho Phase 3.

**Còn lại cho Phase 4 đóng V2:**

### 8a. VNPAY env + sandbox test (chưa làm)

User cần đăng ký merchant sandbox tại https://sandbox.vnpayment.vn (free) để có:
- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`

Sau khi user paste 2 giá trị vào chat, Claude chạy:
```bash
vercel env add VNPAY_TMN_CODE production --value '<paste>' --yes
vercel env add VNPAY_HASH_SECRET production --value '<paste>' --yes
vercel env add VNPAY_HOST production --value 'https://sandbox.vnpayment.vn' --yes
vercel env add VNPAY_RETURN_PATH production --value '/api/payments/vnpay/return' --yes
```

Sau đó cấu hình trên VNPAY merchant portal:
- Return URL: `https://trangsucdecoco.vn/api/payments/vnpay/return`
- IPN URL: `https://trangsucdecoco.vn/api/payments/vnpay/ipn`

Redeploy: `vercel redeploy <latest-prod-url> --target production`.

### 8b. Variant inventory smoke test (chưa làm)

Vào `/admin/san-pham` trên prod, tạo product 2 variants (stock 3 & 5), đặt đơn 1 variant, verify kho giảm đúng variant.

### 8c. Preview env (optional, làm khi cần feature branch)

CLI 53 không cho add preview non-interactive. Set qua dashboard.

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

3. **Email**: ✅ DONE (2026-05-11).
   - Domain `trangsucdecoco.vn` đã verified trên Resend (DKIM/SPF/DMARC qua Mắt Bão DNS).
   - FROM: `noreply@trangsucdecoco.vn` → vào **Inbox** (không Spam).
   - User đã đặt đơn test trên prod, mail về `decoco.cskh@gmail.com` thành công.
   - Script smoke test offline: `scripts/test-order-email.mjs` (chạy `node --env-file=.env.local scripts/test-order-email.mjs`).

## 12. Known gotchas

- **Git push permission**: nếu push 403, credentials đang dùng tài khoản sai. Fix: `cmdkey /delete:git:https://github.com` → push lại → đăng nhập đúng `decocoaccessories-rgb`.
- **VNPAY amount**: SDK `vnpay@2.5.0` **tự nhân 100**. Chỉ pass số VND (vd `100000` = 100k VND).
- **VNPAY hashAlgorithm**: phải là enum `HashAlgorithm.SHA512` (đã import từ `vnpay`).
- **Stock decrement timing**: COD trừ kho ngay khi order; VNPAY trừ kho **chỉ khi IPN xác nhận paid** — nếu user không pay, đơn ở `payment_status='pending'` vĩnh viễn (cleanup cron là V2.1, out of scope).
- **`payment_status='pending'` cho COD**: COD đơn cũng `pending` cho đến khi admin manually đánh dấu trong tương lai. Logic này có thể cần phân biệt rõ hơn (V2.1).
- **Idempotent IPN**: VNPAY có thể gửi IPN nhiều lần. Code đã handle: lookup `vnp_txn_ref`, nếu đã `paid` trả `InpOrderAlreadyConfirmed`.
- **`new_features_plan.md`, `product_highlights_plan.md`**: là plan files cũ của user, untracked, không liên quan V2.
- **`.env.local.example`**: đã track trong git từ commit `8cd7bd9` (thêm `!.env.local.example` exception trong `.gitignore`). Khi thêm env var mới, update cả file này lẫn `CLAUDE.md`.
- **Resend test mode**: nếu account Resend chưa verify domain, **chỉ gửi được tới email chủ account** (`decoco.accessories@gmail.com`). FROM `onboarding@resend.dev` cũng dính rule này. Để gửi tới `decoco.cskh@gmail.com` hoặc bất kỳ email khác, BẮT BUỘC verify domain → đổi FROM sang `*@<verified-domain>`. PRD nói "out of scope" — sai, đây là hard prerequisite.
- **Type safety của `order` trong route**: dùng `as unknown as Order` ở `sendNewOrderEmail` call vì select trả subset cols. Acceptable vì chỉ dùng các field đã được select.

## 13. Out-of-scope V2 (đã chốt)

- Refund / hoàn tiền VNPAY
- Cron tự huỷ đơn VNPAY pending
- MoMo / ZaloPay / Payoo
- React Email / multi-language
- ~~Verify domain decoco.vn cho Resend~~ → **đã làm với `trangsucdecoco.vn`** (2026-05-11)
- QR code render trên trang `/cam-on` (đã chốt redirect gateway)

## 14. Tham chiếu

- VNPay SDK: https://vnpay.js.org/en/
- VNPay best practices: https://vnpay.js.org/en/best-practices
- Resend Next.js: https://resend.com/docs/send-with-nextjs
- Supabase project ID: `xknkhczeuyjxtiljeaoz` (region ap-southeast-1)
- Plan file Claude: `C:\Users\Admin\.claude\plans\drifting-dreaming-owl.md` (chi tiết design)

---

## 15. Resume cheatsheet (cho session mới)

**Email — đã xong, không cần resume.**

**Nếu mở session để làm tiếp VNPAY:**

> Đọc `E:\decoco-web\SESSION_HANDOFF.md` rồi tiếp section 8a (VNPAY env). Vercel CLI đã login `decoco.accessories@gmail.com` và link đúng project `gift-web-decoco`. Credentials:
>
> - VNPAY_TMN_CODE: `<paste>`
> - VNPAY_HASH_SECRET: `<paste>`
>
> Set env + redeploy + hướng dẫn cấu hình Return/IPN URL trên VNPAY portal.

**Nếu mở session để smoke test variant:**

> Đọc `E:\decoco-web\SESSION_HANDOFF.md` section 8b. Hướng dẫn tạo product 2 variants trên prod admin và verify stock decrement đúng variant.
