# DECOCO — Hộp Quà Tặng Cá Nhân Hoá

Website bán hàng cho phép khách hàng thiết kế hộp quà cá nhân hoá. Stack: Next.js + Supabase + Fabric.js.

## Phát triển cục bộ

```bash
npm install
npm run dev
```

## Cấu hình `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
RESEND_API_KEY=<resend-api-key>
ADMIN_EMAIL=admin@decoco.vn
NEXT_PUBLIC_SITE_URL=https://decoco.vn
```

## Setup Supabase

1. Tạo project mới tại [supabase.com](https://supabase.com) (region: Southeast Asia)
2. Chạy migrations:
   ```bash
   # Cài Supabase CLI nếu chưa có
   npx supabase login
   npx supabase link --project-ref <project-id>
   npx supabase db push
   ```
   Hoặc copy-paste `supabase/migrations/001_initial_schema.sql` và `002_seed_data.sql` vào SQL Editor trên Supabase Dashboard.

3. Tạo Storage buckets (Supabase Dashboard → Storage):
   - `designs` — Public
   - `products` — Public
   - `site` — Public
   - `frames` — Public

4. Tạo admin user (Supabase Dashboard → Authentication → Users → Invite User):
   - Email: `admin@decoco.vn`
   - Password: `Decoco@123`

## Setup Resend (Email)

1. Tạo tài khoản tại [resend.com](https://resend.com)
2. Verify domain `decoco.vn` (thêm DNS records: SPF, DKIM)
3. Lấy API key → thêm vào `.env.local` và Supabase Edge Function secrets

## Deploy Edge Function (Email notification)

```bash
npx supabase functions deploy notify-new-order
npx supabase secrets set RESEND_API_KEY=<key> ADMIN_EMAIL=admin@decoco.vn APP_URL=https://decoco.vn
```

Sau đó cấu hình **Database Webhook** trong Supabase Dashboard:
- Table: `orders`, Event: `INSERT`
- URL: `https://<project-id>.supabase.co/functions/v1/notify-new-order`

## Deploy lên Vercel

1. Push code lên GitHub
2. Import project vào [vercel.com](https://vercel.com)
3. Thêm env vars trong Vercel Dashboard → Project Settings → Environment Variables
4. Config custom domain `decoco.vn`
