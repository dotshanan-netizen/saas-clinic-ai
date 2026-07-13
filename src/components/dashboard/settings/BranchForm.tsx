/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";

interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
}

interface BranchFormProps {
  branch: Branch | null; // Null means Add New Branch
  onClose: () => void;
  onSaved: () => void;
}

export function BranchForm({ branch, onClose, onSaved }: BranchFormProps) {
  const clinicSlug = "rival-clinic";

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [city, setCity] = useState<string>("الرياض");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Populate form if editing
  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setCity(branch.city);
      setAddress(branch.address);
      setPhone(branch.phone || "");
      setStatus(branch.status);
    } else {
      setName("");
      setCity("الرياض");
      setAddress("");
      setPhone("");
      setStatus("ACTIVE");
    }
  }, [branch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    // Basic Validation
    if (name.trim().length < 3) {
      setErrorMsg("يجب أن يكون اسم الفرع 3 حروف على الأقل");
      setSaving(false);
      return;
    }
    if (address.trim().length < 5) {
      setErrorMsg("يجب كتابة عنوان الفرع بالتفصيل (5 حروف على الأقل)");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        clinicSlug,
        id: branch?.id || undefined,
        name,
        city,
        address,
        phone: phone || undefined,
        status,
      };

      const res = await fetch("/api/clinic/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ بيانات الفرع");
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
            {branch ? "✏️ تعديل بيانات الفرع" : "➕ إضافة فرع جديد"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">اسم الفرع *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="مثال: فرع الصحافة، فرع التحلية"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">المدينة *</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              >
                <option value="الرياض">الرياض</option>
                <option value="جدة">جدة</option>
                <option value="الدمام">الدمام</option>
                <option value="الخبر">الخبر</option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">رقم الهاتف للفرع</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="011XXXXXXX"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">العنوان بالتفصيل *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="مثال: طريق الملك فهد، حي الصحافة"
              required
            />
          </div>

          {/* Status Selection (only visible when editing) */}
          {branch && (
            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div>
                <span className="block text-xs font-semibold text-zinc-300">حالة الفرع</span>
                <span className="block text-[10px] text-zinc-500 mt-1">تحديد ما إذا كان الفرع نشطاً للحجوزات حالياً أم موقوفاً</span>
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
              {saving ? "جاري الحفظ..." : "حفظ الفرع"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
