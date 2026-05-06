import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const POLICY_MAP: Record<string, { key: string; title: string }> = {
  "chinh-sach-bao-mat": {
    key: "policy_privacy",
    title: "Chính sách bảo mật",
  },
  "dieu-khoan-su-dung": {
    key: "policy_terms",
    title: "Điều khoản sử dụng",
  },
  "doi-tra": {
    key: "policy_return",
    title: "Chính sách đổi trả",
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const info = POLICY_MAP[slug];
  if (!info) return { title: "Không tìm thấy | DECOCO" };
  return { title: `${info.title} | DECOCO` };
}

export default async function PolicyPage({ params }: PageProps) {
  const { slug } = await params;
  const info = POLICY_MAP[slug];
  if (!info) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", info.key)
    .single();

  const row = data as { value: string | null } | null;
  const content = row?.value ?? "";

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="font-heading text-3xl md:text-4xl font-semibold mb-8">
        {info.title}
      </h1>
      {content ? (
        <div
          className="prose prose-neutral max-w-none leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <p className="text-muted-foreground italic">
          Nội dung đang được cập nhật…
        </p>
      )}
    </div>
  );
}
