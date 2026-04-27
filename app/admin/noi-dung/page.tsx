"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save, Plus, Trash2, Loader2 } from "lucide-react";
import type { SiteContent, FaqItem } from "@/lib/supabase/types";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero (Banner chính)",
  story: "Giới thiệu (Story)",
  cta: "CTA",
  footer: "Footer",
};

export default function AdminNoiDungPage() {
  const [content, setContent] = useState<SiteContent[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [faqDrafts, setFaqDrafts] = useState<Record<string, { question: string; answer: string }>>({});

  async function fetchAll() {
    setLoading(true);
    const [contentRes, faqRes] = await Promise.all([
      fetch("/api/admin/site-content"),
      fetch("/api/admin/faq"),
    ]);
    if (contentRes.ok) {
      const data = await contentRes.json();
      setContent((data ?? []) as SiteContent[]);
      const d: Record<string, string> = {};
      for (const item of (data ?? []) as SiteContent[]) {
        d[item.key] = item.value ?? "";
      }
      setDrafts(d);
    }
    if (faqRes.ok) {
      const data = await faqRes.json();
      setFaqItems((data ?? []) as FaqItem[]);
      const d: Record<string, { question: string; answer: string }> = {};
      for (const item of (data ?? []) as FaqItem[]) {
        d[item.id] = { question: item.question, answer: item.answer };
      }
      setFaqDrafts(d);
    }
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function saveContentKey(key: string) {
    setSaving((s) => ({ ...s, [key]: true }));
    const res = await fetch("/api/admin/site-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ key, value: drafts[key] ?? "" }] }),
    });
    if (res.ok) {
      setContent((prev) =>
        prev.map((c) => (c.key === key ? { ...c, value: drafts[key] ?? "" } : c))
      );
      toast.success("Đã lưu nội dung");
    } else {
      toast.error("Lỗi khi lưu nội dung");
    }
    setSaving((s) => ({ ...s, [key]: false }));
  }

  async function saveFaq(id: string) {
    setSaving((s) => ({ ...s, [id]: true }));
    const draft = faqDrafts[id];
    if (!draft) return;
    const res = await fetch(`/api/admin/faq/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      setFaqItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...draft } : f))
      );
      toast.success("Đã lưu FAQ");
    } else {
      toast.error("Lỗi khi lưu FAQ");
    }
    setSaving((s) => ({ ...s, [id]: false }));
  }

  async function deleteFaq(id: string) {
    if (!confirm("Xoá câu hỏi này?")) return;
    const res = await fetch(`/api/admin/faq/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFaqItems((prev) => prev.filter((f) => f.id !== id));
      toast.success("Đã xoá câu hỏi");
    } else {
      toast.error("Lỗi khi xoá");
    }
  }

  async function toggleFaqVisibility(id: string, current: boolean) {
    await fetch(`/api/admin/faq/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: !current }),
    });
    setFaqItems((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_visible: !current } : f))
    );
  }

  async function addFaq() {
    const res = await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Câu hỏi mới",
        answer: "Trả lời mới",
        sort_order: faqItems.length,
      }),
    });
    if (res.ok) {
      const data = await res.json() as FaqItem;
      setFaqItems((prev) => [...prev, data]);
      setFaqDrafts((d) => ({ ...d, [data.id]: { question: data.question, answer: data.answer } }));
    }
  }

  // Group content by section
  const grouped = content.reduce<Record<string, SiteContent[]>>((acc, item) => {
    const section = item.section ?? "other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Quản lý nội dung</h1>
        <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Site content by section */}
      {Object.entries(grouped).map(([section, items]) => (
        <div key={section} className="rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 bg-muted/40 border-b border-border">
            <h2 className="font-semibold text-sm">
              {SECTION_LABELS[section] ?? section}
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {items.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <Label htmlFor={item.key}>
                  {item.label ?? item.key}
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({item.type})
                  </span>
                </Label>
                {item.type === "richtext" || (drafts[item.key]?.length ?? 0) > 100 ? (
                  <textarea
                    id={item.key}
                    rows={4}
                    value={drafts[item.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))}
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
                  />
                ) : (
                  <Input
                    id={item.key}
                    value={drafts[item.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))}
                  />
                )}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveContentKey(item.key)}
                    disabled={saving[item.key]}
                    className="gap-1.5"
                  >
                    {saving[item.key] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Lưu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* FAQ Management */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Câu hỏi thường gặp (FAQ)</h2>
          <Button size="sm" onClick={addFaq} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {faqItems.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Chưa có câu hỏi nào</p>
          ) : (
            faqItems.map((faq) => {
              const draft = faqDrafts[faq.id] ?? { question: faq.question, answer: faq.answer };
              return (
                <div key={faq.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Câu hỏi</Label>
                    <Input
                      value={draft.question}
                      onChange={(e) => setFaqDrafts((d) => ({ ...d, [faq.id]: { ...draft, question: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trả lời</Label>
                    <textarea
                      rows={3}
                      value={draft.answer}
                      onChange={(e) => setFaqDrafts((d) => ({ ...d, [faq.id]: { ...draft, answer: e.target.value } }))}
                      className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={faq.is_visible}
                        onChange={() => toggleFaqVisibility(faq.id, faq.is_visible)}
                      />
                      Hiển thị
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveFaq(faq.id)}
                        disabled={saving[faq.id]}
                        className="gap-1.5"
                      >
                        {saving[faq.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Lưu
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteFaq(faq.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
