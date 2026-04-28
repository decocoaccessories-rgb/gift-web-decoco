"use client";

import dynamic from "next/dynamic";
import type { Frame } from "@/lib/supabase/types";

const DesignToolCanvas = dynamic(() => import("./DesignToolCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[600px] flex items-center justify-center bg-secondary/20 rounded-xl border border-border">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Đang tải công cụ thiết kế...</p>
      </div>
    </div>
  ),
});

interface DesignToolProps {
  productId: string;
  productName: string;
  productPrice: number;
  frames: Pick<Frame, "id" | "name" | "thumbnail_url" | "config" | "sort_order">[];
  hasVariants?: boolean;
  selectedVariant?: { id: string; name: string } | null;
}

export default function DesignTool(props: DesignToolProps) {
  return <DesignToolCanvas {...props} />;
}
