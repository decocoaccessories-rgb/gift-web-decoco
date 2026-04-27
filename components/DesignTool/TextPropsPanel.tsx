"use client";

import { useEffect, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { Canvas as FabricCanvas, IText } from "fabric";
import { cn } from "@/lib/utils";

const FONTS = [
  "Be Vietnam Pro",
  "Playfair Display",
  "Dancing Script",
  "Pacifico",
  "Montserrat",
  "Nunito",
  "Lobster",
  "Oswald",
  "Raleway",
  "Great Vibes",
];

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

interface TextPropsPanelProps {
  fabricRef: RefObject<FabricCanvas | null>;
}

export default function TextPropsPanel({ fabricRef }: TextPropsPanelProps) {
  const [fontFamily, setFontFamily] = useState("Be Vietnam Pro");
  const [fontSize, setFontSize] = useState(32);
  const [fill, setFill] = useState("#000000");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  // Sync with selected object
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject() as IText | null;
    if (!obj) return;
    if (obj.fontFamily) setFontFamily(obj.fontFamily);
    if (obj.fontSize) setFontSize(obj.fontSize);
    if (typeof obj.fill === "string") setFill(obj.fill);
    setBold(obj.fontWeight === "bold");
    setItalic(obj.fontStyle === "italic");
  }, [fabricRef]);

  const applyProp = useCallback(
    (props: Partial<IText>) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const obj = canvas.getActiveObject() as IText | null;
      if (!obj || (obj.type !== "i-text" && obj.type !== "text")) return;
      obj.set(props);
      canvas.renderAll();
    },
    [fabricRef]
  );

  return (
    <div className="border border-border rounded-xl p-4 bg-background space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Thuộc tính chữ
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        {/* Font family */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Font</label>
          <select
            value={fontFamily}
            onChange={(e) => {
              setFontFamily(e.target.value);
              applyProp({ fontFamily: e.target.value });
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Font size */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cỡ</label>
          <input
            type="number"
            min={8}
            max={120}
            value={fontSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFontSize(v);
              applyProp({ fontSize: v });
            }}
            className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Bold / Italic */}
        <div className="flex gap-1">
          <button
            onClick={() => {
              const v = !bold;
              setBold(v);
              applyProp({ fontWeight: v ? "bold" : "normal" });
            }}
            className={cn(
              "h-7 w-7 rounded-md border text-xs font-bold transition-colors",
              bold
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-secondary"
            )}
          >
            B
          </button>
          <button
            onClick={() => {
              const v = !italic;
              setItalic(v);
              applyProp({ fontStyle: v ? "italic" : "normal" });
            }}
            className={cn(
              "h-7 w-7 rounded-md border text-xs italic transition-colors",
              italic
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-secondary"
            )}
          >
            I
          </button>
        </div>

        {/* Color swatches */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Màu</label>
          <div className="flex gap-1 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => {
                  setFill(c);
                  applyProp({ fill: c });
                }}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  fill === c ? "border-primary scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            {/* Custom color */}
            <div className="relative h-6 w-6">
              <input
                type="color"
                value={fill}
                onChange={(e) => {
                  setFill(e.target.value);
                  applyProp({ fill: e.target.value });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Chọn màu tùy chỉnh"
              />
              <div
                className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/40"
                style={{ backgroundColor: fill }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
