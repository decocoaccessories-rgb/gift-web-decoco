"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Plus, Trash2, X, Loader2, Save } from "lucide-react";
import type { Frame, FrameConfig } from "@/lib/supabase/types";

type FrameRow = Pick<Frame, "id" | "name" | "product_id" | "thumbnail_url" | "config" | "sort_order">;

const DEFAULT_CONFIG: FrameConfig = {
  canvasWidth: 800,
  canvasHeight: 800,
  photoSlots: [
    { id: "slot1", x: 100, y: 100, width: 600, height: 600, shape: "rect" },
  ],
};

export default function AdminFramesPage() {
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editFrame, setEditFrame] = useState<FrameRow | null>(null);

  async function fetchFrames() {
    setLoading(true);
    const res = await fetch("/api/admin/frames");
    if (res.ok) {
      const data = await res.json();
      setFrames((data ?? []) as FrameRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchFrames(); }, []);

  async function deleteFrame(id: string) {
    if (!confirm("Xoá khung này?")) return;
    const res = await fetch(`/api/admin/frames/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFrames((prev) => prev.filter((f) => f.id !== id));
      toast.success("Đã xoá khung");
    } else {
      toast.error("Lỗi khi xoá khung");
    }
  }

  function onSaved(frame: FrameRow) {
    setFrames((prev) =>
      prev.some((f) => f.id === frame.id)
        ? prev.map((f) => (f.id === frame.id ? frame : f))
        : [...prev, frame]
    );
    setShowAdd(false);
    setEditFrame(null);
    toast.success("Đã lưu khung");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Khung thiết kế</h1>
          <p className="text-sm text-muted-foreground">{frames.length} khung</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFrames}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm khung
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : frames.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground italic">
          Chưa có khung nào. Nhấn "Thêm khung" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className="border border-border rounded-xl overflow-hidden bg-card hover:border-primary/40 transition-colors"
            >
              <div className="relative aspect-square bg-secondary/20">
                {frame.thumbnail_url ? (
                  <Image
                    src={frame.thumbnail_url}
                    alt={frame.name}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 text-xs">
                    No preview
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium truncate">{frame.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(frame.config as FrameConfig).photoSlots?.length ?? 0} slot ảnh
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => setEditFrame(frame)}
                  >
                    Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteFrame(frame.id)}
                    className="text-destructive hover:text-destructive px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editFrame) && (
        <FrameEditDialog
          frame={editFrame}
          onClose={() => { setShowAdd(false); setEditFrame(null); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

interface FrameEditDialogProps {
  frame: FrameRow | null;
  onClose: () => void;
  onSaved: (frame: FrameRow) => void;
}

function FrameEditDialog({ frame, onClose, onSaved }: FrameEditDialogProps) {
  const isNew = !frame;
  const [name, setName] = useState(frame?.name ?? "");
  const [productId, setProductId] = useState(frame?.product_id ?? "");
  const [configJson, setConfigJson] = useState(
    JSON.stringify(frame?.config ?? DEFAULT_CONFIG, null, 2)
  );
  const [configError, setConfigError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setConfigError("");
    setError("");

    let config: FrameConfig;
    try {
      config = JSON.parse(configJson);
    } catch {
      setConfigError("JSON không hợp lệ");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      product_id: productId || null,
      config,
      sort_order: frame?.sort_order ?? 0,
    };

    const url = isNew ? "/api/admin/frames" : `/api/admin/frames/${frame.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Lỗi");
      setSaving(false);
      return;
    }
    onSaved(data as FrameRow);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">{isNew ? "Thêm khung mới" : "Sửa khung"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Tên khung *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Khung trái tim" />
          </div>
          <div className="space-y-1.5">
            <Label>Product ID <span className="text-xs text-muted-foreground">(để trống nếu dùng chung)</span></Label>
            <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="UUID sản phẩm" />
          </div>
          <div className="space-y-1.5">
            <Label>Cấu hình JSON</Label>
            <textarea
              rows={12}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            {configError && <p className="text-xs text-destructive">{configError}</p>}
            <p className="text-xs text-muted-foreground">
              photoSlots: mảng các slot với x, y, width, height, shape (rect/circle/rounded-rect)
            </p>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Tạo khung" : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
