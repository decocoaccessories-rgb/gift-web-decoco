"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Canvas as FabricCanvas } from "fabric";
import type { Frame, FrameConfig } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import {
  ImageIcon,
  Type,
  Undo2,
  Redo2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Upload,
} from "lucide-react";
import TextPropsPanel from "./TextPropsPanel";
import FramePanel from "./FramePanel";

interface DesignToolCanvasProps {
  productId: string;
  productName: string;
  productPrice: number;
  frames: Pick<Frame, "id" | "name" | "thumbnail_url" | "config" | "sort_order">[];
  hasVariants?: boolean;
  selectedVariant?: { id: string; name: string } | null;
}

const DEFAULT_CANVAS_WIDTH = 1772;
const DEFAULT_CANVAS_HEIGHT = 1535;
const MAX_HISTORY = 20;

export default function DesignToolCanvas({
  productId,
  productName,
  productPrice,
  frames,
  hasVariants = false,
  selectedVariant = null,
}: DesignToolCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedFrame, setSelectedFrame] = useState<
    Pick<Frame, "id" | "name" | "thumbnail_url" | "config"> | null
  >(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedType, setSelectedType] = useState<"text" | "image" | "other" | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scale, setScale] = useState(1);
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });

  // Save snapshot for undo/redo
  const saveSnapshot = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isUndoRedoRef.current) return;
    const json = JSON.stringify(canvas.toJSON());
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current = historyRef.current.length - 1;
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Dynamic import to avoid SSR
    import("fabric").then(({ Canvas }) => {
      if (!canvasRef.current) return;
      const canvas = new Canvas(canvasRef.current, {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      fabricRef.current = canvas;

      // Save initial snapshot
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      historyIndexRef.current = 0;

      // Listen for object changes
      canvas.on("object:modified", saveSnapshot);
      canvas.on("object:added", saveSnapshot);
      canvas.on("object:removed", saveSnapshot);

      // Track selection
      canvas.on("selection:created", (e) => {
        const obj = e.selected?.[0];
        setHasSelection(true);
        setSelectedType(
          obj?.type === "i-text" || obj?.type === "text"
            ? "text"
            : obj?.type === "image"
            ? "image"
            : "other"
        );
      });
      canvas.on("selection:updated", (e) => {
        const obj = e.selected?.[0];
        setSelectedType(
          obj?.type === "i-text" || obj?.type === "text"
            ? "text"
            : obj?.type === "image"
            ? "image"
            : "other"
        );
      });
      canvas.on("selection:cleared", () => {
        setHasSelection(false);
        setSelectedType(null);
      });

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.key === "Delete" || e.key === "Backspace") {
          const active = canvas.getActiveObject();
          if (active) {
            canvas.remove(active);
            canvas.discardActiveObject();
            canvas.renderAll();
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
          e.preventDefault();
          handleUndo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
          e.preventDefault();
          handleRedo();
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        canvas.dispose();
        fabricRef.current = null;
      };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Responsive scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? canvasDims.width;
      setScale(Math.min(1, width / canvasDims.width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [canvasDims.width]);

  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]), () => {
      canvas.renderAll();
      isUndoRedoRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]), () => {
      canvas.renderAll();
      isUndoRedoRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const handleAddText = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { IText } = await import("fabric");
    const text = new IText("Nhập chữ...", {
      left: canvasDims.width / 2,
      top: canvasDims.height / 2,
      originX: "center",
      originY: "center",
      fontSize: 64,
      fontFamily: "Be Vietnam Pro",
      fill: "#333333",
    });
    canvas.add(text);
    canvas.bringObjectToFront(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, [canvasDims.width, canvasDims.height]);

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      let processedFile = file;
      // Compress if > 2MB
      if (file.size > 2 * 1024 * 1024) {
        try {
          const { default: compress } = await import("browser-image-compression");
          processedFile = await compress(file, { maxSizeMB: 2, maxWidthOrHeight: 1920 });
        } catch {
          // Use original if compression fails
        }
      }

      const url = URL.createObjectURL(processedFile);
      const { FabricImage } = await import("fabric");
      const img = await FabricImage.fromURL(url);
      const maxDim = Math.min(canvasDims.width, canvasDims.height) * 0.6;
      const imgW = img.width ?? 1;
      const imgH = img.height ?? 1;
      const factor = Math.min(maxDim / imgW, maxDim / imgH, 1);
      img.set({
        left: canvasDims.width / 2,
        top: canvasDims.height / 2,
        originX: "center",
        originY: "center",
        scaleX: factor,
        scaleY: factor,
      });
      // Find the frame object to insert photo behind it
      const frameObj = canvas
        .getObjects()
        .find((o) => (o as { data?: { isFrame?: boolean } }).data?.isFrame);
      if (frameObj) {
        const frameIndex = canvas.getObjects().indexOf(frameObj);
        canvas.insertAt(frameIndex, img);
      } else {
        canvas.add(img);
      }
      
      canvas.setActiveObject(img);
      canvas.renderAll();
      URL.revokeObjectURL(url);
    },
    [canvasDims.width, canvasDims.height]
  );

  const handleApplyFrame = useCallback(async (frame: Pick<Frame, "id" | "name" | "thumbnail_url" | "config">) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const config = frame.config as FrameConfig;
    // Strictly use 1772x1535 for the canvas area
    const targetWidth = DEFAULT_CANVAS_WIDTH;
    const targetHeight = DEFAULT_CANVAS_HEIGHT;

    // Resize fabric canvas to match standard dimensions
    canvas.setDimensions({ width: targetWidth, height: targetHeight });
    setCanvasDims({ width: targetWidth, height: targetHeight });

    // Clear canvas, keep white background
    canvas.clear();
    canvas.backgroundColor = "#ffffff";

    // Draw photo slot placeholders FIRST (bottom layer)
    const { Rect, Circle } = await import("fabric");
    for (const slot of config.photoSlots ?? []) {
      if (slot.shape === "circle") {
        const r = Math.min(slot.width, slot.height) / 2;
        const circle = new Circle({
          left: slot.x,
          top: slot.y,
          radius: r,
          fill: "rgba(200,200,200,0.3)",
          stroke: "#aaaaaa",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          data: { isSlotPlaceholder: true, slotId: slot.id },
        });
        canvas.add(circle);
      } else {
        const rect = new Rect({
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
          rx: slot.shape === "rounded-rect" ? 12 : 0,
          ry: slot.shape === "rounded-rect" ? 12 : 0,
          fill: "rgba(200,200,200,0.3)",
          stroke: "#aaaaaa",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          data: { isSlotPlaceholder: true, slotId: slot.id },
        });
        canvas.add(rect);
      }
    }

    // Load background image if present (top layer above placeholders and photos)
    if (config.backgroundImage) {
      const { FabricImage } = await import("fabric");
      const bg = await FabricImage.fromURL(config.backgroundImage, {
        crossOrigin: "anonymous"
      });
      const imgWidth = bg.width || targetWidth;
      const imgHeight = bg.height || targetHeight;

      bg.set({
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        scaleX: targetWidth / imgWidth,
        scaleY: targetHeight / imgHeight,
        selectable: false,
        evented: false,
        data: { isFrame: true }
      });
      canvas.add(bg);
      canvas.bringObjectToFront(bg);
    }

    canvas.renderAll();
    setSelectedFrame(frame);
    // Save snapshot after frame applied
    setTimeout(saveSnapshot, 50);
  }, [saveSnapshot]);

  const handleDeleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, []);

  const handleBringForward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.bringObjectForward(active);
      canvas.renderAll();
    }
  }, []);

  const handleSendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.sendObjectBackwards(active);
      canvas.renderAll();
    }
  }, []);

  const handleDuplicate = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    const clone = await active.clone();
    clone.set({ left: (active.left ?? 0) + 20, top: (active.top ?? 0) + 20 });
    canvas.add(clone);

    // Enforce layer order: frame above photos, text above frame
    const frameObj = canvas
      .getObjects()
      .find((o) => (o as { data?: { isFrame?: boolean } }).data?.isFrame);
    if (frameObj) canvas.bringObjectToFront(frameObj);
    const texts = canvas
      .getObjects()
      .filter((o) => o.type === "i-text" || o.type === "text");
    texts.forEach((t) => canvas.bringObjectToFront(t));

    canvas.setActiveObject(clone);
    canvas.renderAll();
  }, []);

  const router = useRouter();

  const handleExport = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExporting(true);
    try {
      const dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });

      // Upload to Supabase Storage via API
      const res = await fetch("/api/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });

      let designImageUrl: string | undefined;
      if (res.ok) {
        const json = await res.json();
        designImageUrl = json.url;
      }

      // Save to sessionStorage
      const designInfo = {
        productId,
        productName,
        productPrice,
        frameId: selectedFrame?.id,
        designImageUrl,
        canvasJSON: JSON.stringify(canvas.toJSON()),
        variantName: selectedVariant?.name,
      };
      sessionStorage.setItem("decoco_design", JSON.stringify(designInfo));

      router.push("/dat-hang");
    } catch {
      alert("Có lỗi khi xuất thiết kế. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }, [productId, productName, productPrice, selectedFrame, selectedVariant, router]);

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-background border border-border rounded-xl">
        {/* Photo upload */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <ImageIcon className="h-4 w-4" />
          Upload ảnh
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoUpload(file);
            e.target.value = "";
          }}
        />

        {/* Add text */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddText}
          className="gap-1.5"
        >
          <Type className="h-4 w-4" />
          Thêm chữ
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        {/* Object controls (only when selection) */}
        {hasSelection && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDuplicate}
              title="Nhân đôi"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBringForward}
              title="Đưa lên trên"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSendBackward}
              title="Đưa xuống dưới"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteSelected}
              title="Xoá (Del)"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Main area: frame panel + canvas */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left panel: frames */}
        {frames.length > 0 && (
          <div
            className="lg:w-48 xl:w-56 shrink-0"
            style={{ height: Math.round(canvasDims.height * scale) }}
          >
            <FramePanel
              frames={frames}
              selectedFrameId={selectedFrame?.id ?? null}
              onSelectFrame={handleApplyFrame}
            />
          </div>
        )}

        {/* Canvas container */}
        <div ref={containerRef} className="flex-1 min-w-0">
          <div
            className="ring-1 ring-border ring-inset rounded-xl overflow-hidden bg-white shadow-sm mx-auto"
            style={{
              width: Math.round(canvasDims.width * scale),
              height: Math.round(canvasDims.height * scale),
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: canvasDims.width,
                height: canvasDims.height,
              }}
            >
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: text properties panel */}
      {hasSelection && selectedType === "text" && (
        <TextPropsPanel fabricRef={fabricRef} />
      )}

      {/* Proceed button */}
      <div className="flex flex-col items-end gap-2 pt-2">
        {hasVariants && !selectedVariant && (
          <p className="text-xs text-destructive">Vui lòng chọn phân loại màu trước khi đặt hàng.</p>
        )}
        <Button
          size="lg"
          onClick={handleExport}
          disabled={exporting || (hasVariants && !selectedVariant)}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {exporting ? "Đang xử lý..." : "Tiếp theo — Đặt hàng"}
        </Button>
      </div>
    </div>
  );
}
