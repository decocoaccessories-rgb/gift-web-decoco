"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Frame, FrameConfig } from "@/lib/supabase/types";

interface FramePanelProps {
  frames: Pick<Frame, "id" | "name" | "thumbnail_url" | "config" | "sort_order">[];
  selectedFrameId: string | null;
  onSelectFrame: (frame: Pick<Frame, "id" | "name" | "thumbnail_url" | "config" | "sort_order">) => void;
}

export default function FramePanel({
  frames,
  selectedFrameId,
  onSelectFrame,
}: FramePanelProps) {
  return (
    <div className="border border-border rounded-xl p-3 bg-background h-full flex flex-col min-h-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 shrink-0">
        Chọn khung
      </p>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
          {frames.map((frame) => {
            const previewUrl = frame.thumbnail_url || (frame.config as FrameConfig).backgroundImage;
            return (
              <button
                key={frame.id}
                onClick={() => onSelectFrame(frame)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all text-left hover:border-primary/40",
                  selectedFrameId === frame.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-secondary/30"
                )}
              >
                <div className="relative w-full aspect-square rounded-md overflow-hidden bg-secondary/50">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt={frame.name}
                      fill
                      sizes="100px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs text-center px-1">
                      Chưa có preview
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground w-full truncate">
                  {frame.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
