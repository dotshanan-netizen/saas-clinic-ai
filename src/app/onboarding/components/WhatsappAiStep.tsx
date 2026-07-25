"use client";

import React, { useState } from "react";
import { WizardState } from "../page";

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function WhatsappAiStep({ state, updateState, onNext, onPrev }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-phone",
          token: state.whatsappToken,
          phoneId: state.whatsappPhoneId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل الاتصال");
      }
      setTestResult({
        status: "success",
        message: `تم التحقق بنجاح! رقم الواتساب مسجل باسم: ${data.verified_name}`,
      });
    } catch (err: any) {
      setTestResult({
        status: "error",
        message: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <div className="flex-1 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            💬 إعدادات قناة التواصل والذكاء الاصطناعي
          </h2>
          <p className="text-xs text-zinc-400 mt-1">قم بربط حساب Meta WhatsApp Business الخاص بالعيادة.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">معرف رقم الهاتف (Phone Number ID) *</label>
            <input
              type="text"
              value={state.whatsappPhoneId}
              onChange={(e) => updateState({ whatsappPhoneId: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">معرف حساب الأعمال (WABA ID) *</label>
            <input
              type="text"
              value={state.whatsappWabaId}
              onChange={(e) => updateState({ whatsappWabaId: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رمز الدخول الآمن (Permanent Access Token) *</label>
            <input
              type="password"
              value={state.whatsappToken}
              onChange={(e) => updateState({ whatsappToken: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none font-mono text-xs"
              placeholder="EAAG..."
              required
            />
            <span className="block text-[10px] text-zinc-500 mt-1">يتم تشفيره بـ AES-256 قبل الحفظ.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رمز التحقق لـ Webhook (Verify Token) *</label>
            <input
              type="password"
              value={state.whatsappVerifyToken}
              onChange={(e) => updateState({ whatsappVerifyToken: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none font-mono text-xs"
              required
            />
          </div>
        </div>

        {/* Test Connection Button */}
        <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={testConnection}
            disabled={!state.whatsappToken || !state.whatsappPhoneId || testing}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            {testing ? "جاري التحقق..." : "اختبار الاتصال بـ Meta (Test Connection)"}
          </button>
          
          {testResult && (
            <div className={`text-xs font-semibold ${testResult.status === "success" ? "text-emerald-400" : "text-rose-400"}`}>
              {testResult.message}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800/80 rounded-xl">
            <div>
              <span className="block text-xs font-semibold text-zinc-300">تفعيل المساعد الذكي (AI Assistant)</span>
              <span className="block text-[10px] text-zinc-500 mt-1">تفعيل الرد التلقائي على العملاء فور ربط القناة.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={state.isAiActive}
                onChange={(e) => updateState({ isAiActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-6 mt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          السابق
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          التالي: بيانات العمليات
        </button>
      </div>
    </form>
  );
}
