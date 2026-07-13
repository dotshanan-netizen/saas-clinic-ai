"use client";

import React, { useState, useEffect } from "react";

interface ClinicProfile {
  name: string;
  logoUrl: string | null;
  description: string | null;
  contactPhone: string | null;
  welcomeMessage: string | null;
  isAiActive: boolean;
  hasWhatsappToken: boolean;
}

export function ClinicProfileCard() {
  const clinicSlug = "rival-clinic"; // Default clinic slug for now

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile Fields
  const [name, setName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [isAiActive, setIsAiActive] = useState<boolean>(true);

  // Fetch Clinic Profile on mount
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch(`/api/clinic/config?clinicSlug=${clinicSlug}`);
        if (!res.ok) {
          throw new Error("فشل في تحميل بيانات ملف العيادة");
        }
        const data: ClinicProfile = await res.json();
        if (!active) return;
        setName(data.name);
        setLogoUrl(data.logoUrl || "");
        setDescription(data.description || "");
        setContactPhone(data.contactPhone || "");
        setWelcomeMessage(data.welcomeMessage || "");
        setIsAiActive(data.isAiActive);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
        setErrorMsg(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic Client side validation
    if (name.trim().length < 3) {
      setErrorMsg("يجب أن يكون اسم العيادة 3 حروف على الأقل");
      setSaving(false);
      return;
    }

    const payload = {
      clinicSlug,
      name,
      logoUrl: logoUrl || undefined,
      description: description || undefined,
      contactPhone: contactPhone || undefined,
      welcomeMessage: welcomeMessage || undefined,
      isAiActive,
    };

    try {
      const res = await fetch("/api/clinic/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ التعديلات");
      }

      setSuccessMsg("تم حفظ الملف التعريفي للعيادة بنجاح! ✨");
      // Clear success message after 4s
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل الملف التعريفي...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            🏢 الملف التعريفي للعيادة
          </h2>
          <p className="text-xs text-zinc-400 mt-1">تعديل معلومات الهوية الأساسية وبيئة عمل المساعد الذكي</p>
        </div>
        
        {/* AI Assistant Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">حالة المساعد الذكي:</span>
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${isAiActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
            {isAiActive ? "نشط" : "معطل"}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clinic Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">اسم العيادة *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="مثال: عيادة ريفال للتجميل"
              required
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رابط شعار العيادة (Logo URL)</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رقم هاتف التواصل</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="011XXXXXXX أو 05XXXXXXXX"
            />
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800/80 rounded-xl">
            <div>
              <span className="block text-xs font-semibold text-zinc-300">تفعيل المساعد الذكي (AI Assistant)</span>
              <span className="block text-[10px] text-zinc-500 mt-1">السماح للمساعد الذكي بالرد على رسائل العملاء تلقائياً</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAiActive}
                onChange={(e) => setIsAiActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
            </label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">وصف العيادة (Description)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors resize-none"
            placeholder="اكتب نبذة مختصرة عن الخدمات والعيادة..."
          />
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">رسالة الترحيب التلقائية (Welcome Message)</label>
          <input
            type="text"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
            placeholder="مثال: يا هلا ومسهلا بكِ في عيادة ريفال للتجميل 🌸"
          />
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl flex items-center gap-2">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl flex items-center gap-2">
            {successMsg}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الحفظ...
              </span>
            ) : (
              "حفظ التعديلات ✨"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
