/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";

type KbCategory = "FAQ" | "POLICY" | "GENERAL_INFO";

interface KBItem {
  id: string;
  category: KbCategory;
  content: string;
}

interface KnowledgeBaseFormProps {
  item: KBItem | null; // Null means Add New
  onClose: () => void;
  onSaved: () => void;
}

export function KnowledgeBaseForm({ item, onClose, onSaved }: KnowledgeBaseFormProps) {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [category, setCategory] = useState<KbCategory>("FAQ");
  const [content, setContent] = useState<string>( "");

  // Populate form if editing
  useEffect(() => {
    if (item) {
      setCategory(item.category);
      setContent(item.content);
    } else {
      setCategory("FAQ");
      setContent("");
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);

    // Validation
    if (content.trim().length < 5) {
      setErrorMsg("يجب أن يكون محتوى النص 5 حروف على الأقل لتدريبه بنجاح");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        clinicSlug,
        id: item?.id || undefined,
        category,
        content,
      };

      const res = await fetch("/api/clinic/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ مدخلة قاعدة المعرفة");
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
          <h3 className="text-md font-bold text-zinc-100 flex items-center gap-2">
            {item ? "✏️ تعديل مستند المعرفة" : "➕ إضافة مستند للذكاء الاصطناعي"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">تصنيف المستند *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as KbCategory)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
            >
              <option value="FAQ">❓ الأسئلة الشائعة (FAQ)</option>
              <option value="POLICY">📜 سياسات العيادة ومواعيد الحجز (POLICY)</option>
              <option value="GENERAL_INFO">🏢 معلومات عامة وعروض العيادة (GENERAL_INFO)</option>
            </select>
          </div>

          {/* Content TextArea */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">المحتوى المعرفي (تدريب الذكاء الاصطناعي) *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1500}
              rows={6}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors resize-none font-sans"
              placeholder="اكتب المعرفة هنا بوضوح وسلاسة. مثلاً: 'تبدأ العروض الموسمية لتنظيف البشرة في شهر أكتوبر وتستمر لـ 3 أشهر، وخصم 20٪ للدفع المسبق عبر الموقع'."
              required
            />
            <div className="flex justify-between items-center mt-2">
              <span className="block text-[10px] text-zinc-500">
                💡 يقرأ المساعد الذكي هذا المحتوى تلقائياً للرد بدقة على تساؤلات المراجعين.
              </span>
              <span className="block text-[10px] text-zinc-400 font-mono">
                {content.length} / 1500
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl flex items-center gap-2">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "جاري الحفظ والتدريب..." : "حفظ المستند"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default KnowledgeBaseForm;
