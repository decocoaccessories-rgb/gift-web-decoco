export const revalidate = 60;

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import StorySection from "@/components/sections/StorySection";
import ProductsShowcaseSection from "@/components/sections/ProductsShowcaseSection";
import FeedbackSection from "@/components/sections/FeedbackSection";
import FaqSection from "@/components/sections/FaqSection";
import CtaSection from "@/components/sections/CtaSection";
import { createClient } from "@/lib/supabase/server";
import type { Product, FeedbackItem, FaqItem } from "@/lib/supabase/types";

export default async function LandingPage() {
  let content: Record<string, string> = {};
  let products: Pick<Product, "slug" | "name" | "price" | "stock" | "images">[] = [];
  let feedbackItems: Pick<FeedbackItem, "id" | "image_url" | "alt_text">[] = [];
  let faqItems: Pick<FaqItem, "id" | "question" | "answer">[] = [];

  try {
    const supabase = await createClient();
    const [contentRes, productsRes, feedbackRes, faqRes] = await Promise.allSettled([
      supabase
        .from("site_content")
        .select("key, value")
        .in("section", ["hero", "story", "cta"]),
      supabase
        .from("products")
        .select("slug, name, price, stock, images")
        .eq("is_visible", true)
        .order("sort_order")
        .limit(4),
      supabase
        .from("feedback_items")
        .select("id, image_url, alt_text")
        .eq("is_visible", true)
        .order("sort_order")
        .limit(6),
      supabase
        .from("faq_items")
        .select("id, question, answer")
        .eq("is_visible", true)
        .order("sort_order"),
    ]);

    if (contentRes.status === "fulfilled" && contentRes.value.data) {
      const rows = contentRes.value.data as Array<{
        key: string | null;
        value: string | null;
      }>;
      for (const row of rows) {
        if (row.key && row.value) content[row.key] = row.value;
      }
    }
    if (productsRes.status === "fulfilled" && productsRes.value.data) {
      products = productsRes.value.data as typeof products;
    }
    if (feedbackRes.status === "fulfilled" && feedbackRes.value.data) {
      feedbackItems = feedbackRes.value.data as typeof feedbackItems;
    }
    if (faqRes.status === "fulfilled" && faqRes.value.data) {
      faqItems = faqRes.value.data as typeof faqItems;
    }
  } catch {
    // Supabase not configured — sections use built-in defaults
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection content={content} />
        <StorySection content={content} />
        <ProductsShowcaseSection products={products} />
        <FeedbackSection items={feedbackItems} />
        <FaqSection items={faqItems} />
        <CtaSection content={content} />
      </main>
      <Footer />
    </>
  );
}
