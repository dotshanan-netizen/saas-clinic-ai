"use client";

import React from "react";
import { WizardState } from "../page";

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
}

export function ClinicInfoStep({ state, updateState, onNext }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <div className="flex-1 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            🏢 معلومات العيادة الأساسية
          </h2>
          <p className="text-xs text-zinc-400 mt-1">دعنا نبدأ بإعداد هويتك وبيانات مدير النظام.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">اسم العيادة *</label>
            <input
              type="text"
              value={state.clinicName}
              onChange={(e) => updateState({ clinicName: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="مثال: عيادة لومينا للتجميل"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">المعرف الفريد (Slug) *</label>
            <input
              type="text"
              value={state.clinicSlug}
              onChange={(e) => updateState({ clinicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="lumina-aesthetics"
              required
            />
            <span className="block text-[10px] text-zinc-500 mt-1">يستخدم في الروابط ويجب أن يكون بالإنجليزية بدون مسافات.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رابط الشعار (Logo URL)</label>
            <input
              type="url"
              value={state.logoUrl}
              onChange={(e) => updateState({ logoUrl: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">رقم التواصل العام</label>
            <input
              type="text"
              value={state.contactPhone}
              onChange={(e) => updateState({ contactPhone: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
              placeholder="+966500000000"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">الوصف العام</label>
          <textarea
            value={state.description}
            onChange={(e) => updateState({ description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors resize-none"
            placeholder="نبذة عن العيادة وتخصصاتها..."
          />
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-200 mb-4">بيانات مدير النظام (Admin)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">الاسم *</label>
              <input
                type="text"
                value={state.adminName}
                onChange={(e) => updateState({ adminName: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">البريد الإلكتروني *</label>
              <input
                type="email"
                value={state.adminEmail}
                onChange={(e) => updateState({ adminEmail: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">كلمة المرور *</label>
              <input
                type="password"
                value={state.adminPassword}
                onChange={(e) => updateState({ adminPassword: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none"
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 mt-6 border-t border-zinc-800">
        <button
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          التالي: إعدادات واتساب والـ AI
        </button>
      </div>
    </form>
  );
}
