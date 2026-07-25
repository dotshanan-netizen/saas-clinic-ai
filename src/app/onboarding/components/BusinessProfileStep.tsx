"use client";

import React from "react";
import { WizardState } from "../page";

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function BusinessProfileStep({ state, updateState, onNext, onPrev }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            📘 دليل التشغيل (Business Profile)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            هذه الإعدادات تحدد شخصية المساعد الذكي وأسلوب تواصله مع العملاء بدقة بدلاً من الاعتماد على ملفات نصية.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">تعليمات النظام الأساسية (System Prompt) *</label>
            <textarea
              value={state.customPrompt}
              onChange={(e) => updateState({ customPrompt: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رسالة الترحيب التلقائية (Welcome Message) *</label>
            <input
              type="text"
              value={state.welcomeMessage}
              onChange={(e) => updateState({ welcomeMessage: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">نبرة الصوت وأسلوب التحدث (Tone of Voice)</label>
            <textarea
              value={state.toneOfVoice}
              onChange={(e) => updateState({ toneOfVoice: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: تحدث باحترام ومودة، تجنب المصطلحات الطبية المعقدة..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">قواعد البيع (Sales Rules)</label>
            <textarea
              value={state.salesRules}
              onChange={(e) => updateState({ salesRules: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: إذا سأل العميل عن البوتوكس اطلب منه حجز استشارة أولاً..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">سياسة التصعيد (Escalation Policy)</label>
            <textarea
              value={state.escalationPolicy}
              onChange={(e) => updateState({ escalationPolicy: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: عند الشكاوى أو الأسئلة الطبية المعقدة، قم بتحويل المحادثة..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">العروض والمناسبات (Offers & Occasions)</label>
            <textarea
              value={state.offersAndOccasions}
              onChange={(e) => updateState({ offersAndOccasions: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: عرض كل يوم أربعاء 20% خصم على الليزر..."
            />
          </div>
        </div>
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
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          التالي: المراجعة والإطلاق
        </button>
      </div>
    </form>
  );
}
