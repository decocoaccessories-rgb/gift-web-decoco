import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SiteContent } from "@/lib/supabase/types";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.from("site_content").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SiteContent[];
  const contentMap: Record<string, string> = {};
  for (const item of rows) {
    contentMap[item.key] = item.value ?? "";
  }

  return NextResponse.json(contentMap);
}
