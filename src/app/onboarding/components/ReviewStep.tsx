"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardState } from "../page";

interface Props {
  state: WizardState;
  onPrev: () => void;
}

export function ReviewStep({ state, onPrev }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const compileBusinessProfile = () => {
    return `
# BUSINESS PROFILE: ${state.clinicName}

### 1. أسلوب التواصل (Tone of Voice)
${state.toneOfVoice || "غير محدد"}

### 2. سياسة العروض والمناسبات (Offers & Occasions)
${state.offersAndOccasions || "غير محدد"}

### 3. قواعد البيع وتوجيه الحجز (Sales Rules)
${state.salesRules || "غير محدد"}

### 4. سياسة التصعيد (Escalation Policy)
${state.escalationPolicy || "غير محدد"}
    `.trim();
  };

  const handleLaunch = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);

    const businessProfileContent = compileBusinessProfile();

    const payload = {
      adminEmail: state.adminEmail,
      adminPassword: state.adminPassword,
      adminName: state.adminName,
      clinicSlug: state.clinicSlug,
      clinicName: state.clinicName,
      logoUrl: state.logoUrl,
      description: state.description,
      contactPhone: state.contactPhone,
      welcomeMessage: state.welcomeMessage,
      customPrompt: state.customPrompt,
      whatsappPhoneId: state.whatsappPhoneId,
      whatsappWabaId: state.whatsappWabaId,
      whatsappToken: state.whatsappToken,
      whatsappVerifyToken: state.whatsappVerifyToken,
      isAiActive: state.isAiActive,
      branches: state.branches,
      services: state.services,
      doctors: state.doctors,
      knowledgeBase: [
        {
          category: "GENERAL_INFO",
          content: businessProfileContent,
        }
      ]
    };

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إنشاء العيادة");
      }

      // Success! Clear draft and redirect to dashboard
      localStorage.removeItem("clinova_onboarding_draft");
      
      // We assume login mechanism is token/cookie based and we might need to log them in, 
      // but for now redirecting to login page makes the most sense so they can enter their newly created credentials.
      router.push("/login?onboarded=true");
    } catch (err: any) {
      setErrorMsg(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            🚀 مراجعة البيانات وإطلاق العيادة
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            يرجى مراجعة ملخص بياناتك قبل الاعتماد. عند الإطلاق، سيتم بناء العيادة بالكامل في النظام.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-2">
            <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">🏢 العيادة والأدمن</h3>
            <p className="text-xs text-zinc-400">الاسم: <span className="text-zinc-100 font-bold">{state.clinicName}</span></p>
            <p className="text-xs text-zinc-400">Slug: <span className="text-zinc-100 font-mono">{state.clinicSlug}</span></p>
            <p className="text-xs text-zinc-400">الأدمن: <span className="text-zinc-100">{state.adminName} ({state.adminEmail})</span></p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-2">
            <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">💬 واتساب والمساعد</h3>
            <p className="text-xs text-zinc-400">Phone ID: <span className="text-zinc-100">{state.whatsappPhoneId || "لم يُدخل"}</span></p>
            <p className="text-xs text-zinc-400">WABA ID: <span className="text-zinc-100">{state.whatsappWabaId || "لم يُدخل"}</span></p>
            <p className="text-xs text-zinc-400">حالة AI: <span className={state.isAiActive ? "text-emerald-400" : "text-zinc-500"}>{state.isAiActive ? "مفعل" : "معطل"}</span></p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-2 md:col-span-2">
            <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">⚙️ العمليات (الفروع، الخدمات، الأطباء)</h3>
            <div className="flex gap-4 text-xs font-bold text-zinc-100">
              <div className="bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50">
                {state.branches.length} فروع
              </div>
              <div className="bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50">
                {state.services.length} خدمات
              </div>
              <div className="bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50">
                {state.doctors.length} أطباء
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      <div className="flex justify-between pt-6 mt-6 border-t border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          السابق
        </button>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "جاري الإنشاء..." : "إنشاء العيادة 🚀"}
        </button>
      </div>
    </div>
  );
}
