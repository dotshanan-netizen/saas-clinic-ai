/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  price: number;
  description: string | null;
  durationMinutes: number;
  status: "ACTIVE" | "INACTIVE";
}

interface ServiceFormProps {
  service: Service | null; // Null means Add New Service
  onClose: () => void;
  onSaved: () => void;
}

export function ServiceForm({ service, onClose, onSaved }: ServiceFormProps) {
  const clinicSlug = "rival-clinic";

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Populate form if editing
  useEffect(() => {
    if (service) {
      setName(service.name);
      setPrice(service.price);
      setDescription(service.description || "");
      setDurationMinutes(service.durationMinutes);
      setStatus(service.status);
    } else {
      setName("");
      setPrice(0);
      setDescription("");
      setDurationMinutes(30);
      setStatus("ACTIVE");
    }
  }, [service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    // Basic Validation
    if (name.trim().length < 3) {
      setErrorMsg("يجب أن يكون اسم الخدمة 3 حروف على الأقل");
      setSaving(false);
      return;
    }
    if (price <= 0) {
      setErrorMsg("يجب أن يكون السعر أكبر من صفر");
      setSaving(false);
      return;
    }
    if (durationMinutes <= 0) {
      setErrorMsg("يجب أن تكون مدة الخدمة أكبر من صفر");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        clinicSlug,
        id: service?.id || undefined,
        name,
        price,
        description: description || undefined,
        durationMinutes,
        status,
      };

      const res = await fetch("/api/clinic/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ بيانات الخدمة");
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
            {service ? "✏️ تعديل بيانات الخدمة" : "➕ إضافة خدمة جديدة"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">اسم الخدمة *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="مثال: حقن بوتكس، تنظيف بشرة عميق"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Price */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">السعر (ريال) *</label>
              <input
                type="number"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="0"
                min={0}
                required
              />
            </div>

            {/* Duration minutes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">مدة الجلسة (بالدقائق) *</label>
              <input
                type="number"
                value={durationMinutes || ""}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="30"
                min={1}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">وصف الخدمة</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors resize-none"
              placeholder="اكتب تفاصيل مختصرة حول الخدمة الطبية أو التجميلية..."
            />
          </div>

          {/* Status Selection (only visible when editing) */}
          {service && (
            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div>
                <span className="block text-xs font-semibold text-zinc-300">حالة الخدمة</span>
                <span className="block text-[10px] text-zinc-500 mt-1">تحديد ما إذا كانت الخدمة معروضة للحجز والتنسيق حالياً</span>
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">نشط</option>
                <option value="INACTIVE">معطل</option>
              </select>
            </div>
          )}

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
              {saving ? "جاري الحفظ..." : "حفظ الخدمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default ServiceForm;
