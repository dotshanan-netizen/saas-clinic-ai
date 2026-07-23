/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { KnowledgeBaseForm } from "./KnowledgeBaseForm";

type KbCategory = "FAQ" | "POLICY" | "GENERAL_INFO";

interface KBItem {
  id: string;
  category: KbCategory;
  content: string;
}

interface KnowledgeBaseTableProps {
  categoryFilter?: KbCategory | KbCategory[];
}

export function KnowledgeBaseTable({ categoryFilter }: KnowledgeBaseTableProps) {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [items, setItems] = useState<KBItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Modal State
  const [editingItem, setEditingItem] = useState<KBItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Fetch KB items
  const loadItems = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/clinic/kb?clinicSlug=${clinicSlug}`);
      if (!res.ok) {
        throw new Error("فشل في تحميل مستندات قاعدة المعرفة");
      }
      const data = await res.json();
      
      // Filter items if filter is provided
      if (categoryFilter) {
        const filters = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        setItems(data.filter((it: KBItem) => filters.includes(it.category)));
      } else {
        setItems(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleAddNew = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: KBItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = async (kbId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند المعرفي؟ لن يتمكن المساعد الذكي من الإجابة باستخدامه لاحقاً.")) {
      return;
    }

    try {
      setErrorMsg(null);
      const res = await fetch(`/api/clinic/kb?kbId=${kbId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("فشل في حذف المستند المعرفي");
      }

      // Reload
      await loadItems();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "حدث خطأ أثناء الحذف");
    }
  };

  const getCategoryLabel = (cat: KbCategory) => {
    switch (cat) {
      case "FAQ":
        return "❓ الأسئلة الشائعة";
      case "POLICY":
        return "📜 السياسات والقواعد";
      case "GENERAL_INFO":
        return "🏢 معلومات عامة";
      default:
        return cat;
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل مستندات قاعدة المعرفة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Knowledge Base Card */}
      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              📚 تدريب الذكاء الاصطناعي (RAG Knowledge)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">تغذية المساعد الذكي بالأسئلة الشائعة وعروض وسياسات العيادة للرد الذاتي</p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            ➕ إضافة مستند معرفي
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-xs">لا توجد مستندات معرفية مخصصة للذكاء الاصطناعي حالياً.</p>
            <button
              onClick={handleAddNew}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              أنشئ أول مستند معرفي 📚
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 text-right font-semibold w-1/4">التصنيف</th>
                  <th className="pb-3 text-right font-semibold w-1/2">محتوى التدريب المعرفي</th>
                  <th className="pb-3 text-center font-semibold w-1/4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-zinc-850/10 text-zinc-200">
                    <td className="py-4 font-bold text-zinc-300 align-top">
                      <span className="px-2.5 py-1 bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-[10px]">
                        {getCategoryLabel(it.category)}
                      </span>
                    </td>
                    <td className="py-4 text-zinc-400 whitespace-pre-wrap font-sans text-xs leading-relaxed max-w-lg pr-4">
                      {it.content}
                    </td>
                    <td className="py-4 text-center align-top space-x-2 space-x-reverse">
                      <button
                        onClick={() => handleEdit(it)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="px-2.5 py-1 bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 hover:text-rose-350 border border-rose-900/30 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form for Add/Edit */}
      {isFormOpen && (
        <KnowledgeBaseForm
          item={editingItem}
          onClose={() => setIsFormOpen(false)}
          onSaved={loadItems}
        />
      )}
    </div>
  );
}
export default KnowledgeBaseTable;
