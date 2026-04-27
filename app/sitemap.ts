import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://decoco.vn";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/san-pham`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_visible", true);

    const productRoutes: MetadataRoute.Sitemap = ((data ?? []) as { slug: string; updated_at: string }[]).map(
      (p) => ({
        url: `${BASE_URL}/san-pham/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    );

    return [...staticRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
