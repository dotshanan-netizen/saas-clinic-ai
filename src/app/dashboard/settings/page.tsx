"use client";

import React from "react";
import Link from "next/link";
import { ClinicProfileCard } from "@/components/dashboard/settings/ClinicProfileCard";
import { BranchTable } from "@/components/dashboard/settings/BranchTable";
import { DoctorTable } from "@/components/dashboard/settings/DoctorTable";
import { IntegrationCenter } from "@/components/dashboard/settings/IntegrationCenter";
import { WhatsappAiSettings } from "@/components/dashboard/settings/WhatsappAiSettings";

type SettingsTab = "profile" | "branches" | "doctors" | "whatsapp-ai" | "integrations";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profile");

  React.useEffect(() => {
    fetch("/api/clinic/config")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Page Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-zinc-200">إعدادات العيادة والمنصة</h2>
          <p className="text-[10px] text-zinc-500">تعديل بيانات التعريف، الفروع، الأطباء وتكاملات النظام</p>
        </div>
      </header>

      {/* Main Settings Panel */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto">
        {/* Navigation Breadcrumb */}
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <span>لوحة التحكم</span>
          <span>/</span>
          <span className="text-zinc-400 font-medium">الإعدادات</span>
        </div>

        {/* Dynamic Tab Switcher */}
        <div className="flex border-b border-zinc-800 gap-6 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "profile"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🏢 ملف العيادة (Clinic)
            {activeTab === "profile" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("branches")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "branches"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            📍 الفروع وأوقات العمل (Branches)
            {activeTab === "branches" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("doctors")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "doctors"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🧑‍⚕️ الأطباء والطاقم (Doctors)
            {activeTab === "doctors" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("whatsapp-ai")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "whatsapp-ai"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            💬 إعدادات الواتساب والـ AI (WhatsApp)
            {activeTab === "whatsapp-ai" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "integrations"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🔌 مركز التكاملات (Integrations)
            {activeTab === "integrations" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="pt-2">
          {activeTab === "profile" && <ClinicProfileCard />}
          {activeTab === "branches" && <BranchTable />}
          {activeTab === "doctors" && <DoctorTable />}
          {activeTab === "whatsapp-ai" && <WhatsappAiSettings />}
          {activeTab === "integrations" && <IntegrationCenter />}
        </div>
      </main>
    </div>
  );
}
