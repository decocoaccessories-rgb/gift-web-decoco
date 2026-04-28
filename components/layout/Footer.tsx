import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const defaultContent: Record<string, string> = {
  footer_slogan: "Trang sức DECOCO —\nVẻ đẹp từ những điều nhỏ bé",
  footer_email: "hello@decoco.vn",
  footer_phone: "0901 234 567",
  footer_address: "Hà Nội, Việt Nam",
  footer_facebook: "",
  footer_tiktok: "",
  footer_instagram: "",
};

async function getSiteContent() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_content")
      .select("key, value")
      .eq("section", "footer");
    const rows = (data ?? []) as Array<{ key: string | null; value: string | null }>;
    const map: Record<string, string> = { ...defaultContent };
    for (const row of rows) {
      if (row.key && row.value) map[row.key] = row.value;
    }
    return map;
  } catch {
    return defaultContent;
  }
}

export default async function Footer() {
  const content = await getSiteContent();

  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-3">
            <p className="font-heading text-2xl font-semibold italic">DECOCO</p>
            <p className="text-sm text-background/70 leading-relaxed whitespace-pre-wrap">
              {content.footer_slogan}
            </p>
            {/* Social icons */}
            <div className="flex gap-3 pt-1">
              {content.footer_facebook && (
                <a
                  href={content.footer_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-background/60 hover:text-background transition-colors"
                >
                  <FacebookIcon />
                </a>
              )}
              {content.footer_tiktok && (
                <a
                  href={content.footer_tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="text-background/60 hover:text-background transition-colors"
                >
                  <TikTokIcon />
                </a>
              )}
              {content.footer_instagram && (
                <a
                  href={content.footer_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-background/60 hover:text-background transition-colors"
                >
                  <InstagramIcon />
                </a>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-background/50">
              Liên kết nhanh
            </h3>
            <ul className="space-y-2 text-sm text-background/70">
              {[
                { label: "Trang chủ", href: "/" },
                { label: "Sản phẩm", href: "/san-pham" },
                { label: "Giới thiệu", href: "/#story" },
                { label: "FAQ", href: "/#faq" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-background/50">
              Liên hệ
            </h3>
            <ul className="space-y-2 text-sm text-background/70">
              {content.footer_email && (
                <li>
                  <a
                    href={`mailto:${content.footer_email}`}
                    className="hover:text-background transition-colors"
                  >
                    {content.footer_email}
                  </a>
                </li>
              )}
              {content.footer_phone && (
                <li>
                  <a
                    href={`tel:${content.footer_phone.replace(/\s/g, "")}`}
                    className="hover:text-background transition-colors"
                  >
                    {content.footer_phone}
                  </a>
                </li>
              )}
              {content.footer_address && (
                <li>{content.footer_address}</li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-background/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-background/40">
          <p>© {new Date().getFullYear()} DECOCO. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-background/60 cursor-pointer transition-colors">
              Chính sách bảo mật
            </span>
            <span className="hover:text-background/60 cursor-pointer transition-colors">
              Điều khoản sử dụng
            </span>
            <span className="hover:text-background/60 cursor-pointer transition-colors">
              Đổi trả
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
