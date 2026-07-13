"use client";

import React, { useState, useEffect } from "react";

interface ClinicConfig {
  name: string;
  isAiActive: boolean;
  customPrompt: string | null;
  whatsappPhoneId: string | null;
  whatsappWabaId: string | null;
  hasWhatsappToken: boolean;
}

export function WhatsappAiSettings() {
  const clinicSlug = "rival-clinic";

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Clinic profile name needed for POST schema validation
  const [clinicName, setClinicName] = useState<string>("");

  // WhatsApp Fields
  const [whatsappPhoneId, setWhatsappPhoneId] = useState<string>("");
  const [whatsappWabaId, setWhatsappWabaId] = useState<string>("");
  const [whatsappToken, setWhatsappToken] = useState<string>("");
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState<string>("");
  const [hasWhatsappToken, setHasWhatsappToken] = useState<boolean>(false);

  // AI Fields
  const [isAiActive, setIsAiActive] = useState<boolean>(true);
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // Load configuration
  useEffect(() => {
    let active = true;
    async function loadConfig() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch(`/api/clinic/config?clinicSlug=${clinicSlug}`);
        if (!res.ok) {
          throw new Error("فشل في تحميل إعدادات الواتساب والذكاء الاصطناعي");
        }
        const data: ClinicConfig & { name: string } = await res.json();
        
        if (!active) return;
        setClinicName(data.name);
        setWhatsappPhoneId(data.whatsappPhoneId || "");
        setWhatsappWabaId(data.whatsappWabaId || "");
        setHasWhatsappToken(data.hasWhatsappToken);
        setIsAiActive(data.isAiActive);
        setCustomPrompt(data.customPrompt || "");
      } catch (err: unknown) {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Build payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      clinicSlug,
      name: clinicName, // Required by schema
      whatsappPhoneId: whatsappPhoneId || null,
      whatsappWabaId: whatsappWabaId || null,
      isAiActive,
      customPrompt: customPrompt || null,
    };

    // Only send token and verify token if they were filled (to avoid overwriting with empty)
    if (whatsappToken.trim()) {
      payload.whatsappToken = whatsappToken;
    }
    if (whatsappVerifyToken.trim()) {
      payload.whatsappVerifyToken = whatsappVerifyToken;
    }

    try {
      const res = await fetch("/api/clinic/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ إعدادات العيادة");
      }

      setSuccessMsg("تم حفظ الإعدادات وتحديث سلوك المساعد الذكي بنجاح! 🚀");
      
      // If a token was saved, update status
      if (whatsappToken.trim()) {
        setHasWhatsappToken(true);
        setWhatsappToken(""); // Clear input
      }
      setWhatsappVerifyToken(""); // Clear input
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل إعدادات القناة والذكاء الاصطناعي...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card 1: WhatsApp Cloud API Credentials */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              💬 ربط قناة واتساب (WhatsApp Cloud API)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">تكوين بيانات ربط حساب مطوري Meta لاستقبال وإرسال الرسائل التلقائية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone Number ID */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">معرف رقم الهاتف (Phone Number ID)</label>
              <input
                type="text"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="مثال: 10837583625946"
              />
            </div>

            {/* WABA ID */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">معرف حساب الأعمال (WABA ID)</label>
              <input
                type="text"
                value={whatsappWabaId}
                onChange={(e) => setWhatsappWabaId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="مثال: 29472659362548"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Permanent Token */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">رمز الدخول الدائم (Permanent Access Token)</label>
              <input
                type="password"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder={hasWhatsappToken ? "•••••••••••••••• (تم الحفظ بنجاح، أدخل رمزاً جديداً للتعديل)" : "EAAGb..."}
              />
              <span className="block text-[10px] text-zinc-500 mt-1">يتم تشفير هذا الرمز تلقائياً بـ AES-256-GCM لحمايته</span>
            </div>

            {/* Verify Token */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">رمز التحقق لـ Webhook (Verify Token)</label>
              <input
                type="text"
                value={whatsappVerifyToken}
                onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                placeholder="أدخل رمز التحقق المستخدم لربط الـ Webhook في Meta"
              />
            </div>
          </div>
        </div>

        {/* Card 2: AI Settings & Custom Prompt */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                🤖 إعدادات وسلوك المساعد الذكي
              </h2>
              <p className="text-xs text-zinc-400 mt-1">التحكم في تفعيل الرد التلقائي وصياغة التعليمات البرمجية له</p>
            </div>
            
            {/* Toggle switch */}
            <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
              <span className="text-xs text-zinc-300 font-semibold">حالة المساعد:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAiActive}
                  onChange={(e) => setIsAiActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
              </label>
            </div>
          </div>

          {/* Custom Prompt Text Area */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">تعليمات وتوجيهات النظام المخصصة (System Prompt) *</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={8}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors resize-none font-sans leading-relaxed"
              placeholder="اكتب التوجيهات البرمجية هنا. مثال: 'أنت مساعد ذكي لعيادة ريفال للتجميل بالرياض. وظيفتك الترحيب بالعملاء وعرض الفروع المتاحة والخدمات المتاحة وحجز المواعيد بلباقة وسرعة...'"
              required
            />
            <span className="block text-[10px] text-zinc-500 mt-2">
              💡 يلتزم المساعد الذكي بهذه التعليمات كشخصية ونظام أساسي عند بدء المحادثات التلقائية مع المرضى.
            </span>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl">
            ✓ {successMsg}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/10"
          >
            {saving ? "جاري حفظ الإعدادات..." : "حفظ التغييرات 💾"}
          </button>
        </div>
      </form>
    </div>
  );
}
export default WhatsappAiSettings;
