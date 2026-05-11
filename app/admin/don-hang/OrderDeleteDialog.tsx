"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  orderNumber: string;
  customerName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function OrderDeleteDialog({
  orderNumber,
  customerName,
  onConfirm,
  onClose,
}: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (!deleting && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="font-semibold text-base">Xoá đơn hàng?</h2>
              <p className="text-sm text-muted-foreground">
                Đơn <span className="font-mono font-medium">{orderNumber}</span> của khách{" "}
                <span className="font-medium">{customerName}</span> sẽ bị xoá vĩnh viễn khỏi
                database. Không thể khôi phục.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={deleting}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? "Đang xoá..." : "Xoá vĩnh viễn"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
