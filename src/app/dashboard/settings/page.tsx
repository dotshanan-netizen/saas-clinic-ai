"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ClinicProfileCard } from "@/components/dashboard/settings/ClinicProfileCard";
import { BranchTable } from "@/components/dashboard/settings/BranchTable";
import { ServiceTable } from "@/components/dashboard/settings/ServiceTable";
import { DoctorTable } from "@/components/dashboard/settings/DoctorTable";
import { KnowledgeBaseTable } from "@/components/dashboard/settings/KnowledgeBaseTable";

type SettingsTab = "profile" | "branches" | "services" | "doctors" | "kb";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased" dir="rtl">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-400 flex items-center justify-center font-bold text-zinc-950 text-lg shadow-lg shadow-indigo-500/10">
            ⚙️
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-200 bg-clip-text text-transparent">
              إعدادات المنصة والعيادة – Settings
            </h1>
            <p className="text-xs text-zinc-400">تخصيص الملف التعريفي، الفروع، الخدمات، الأطباء، وسلوك المساعد الذكي</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            ↩️ لوحة الاستقبال
          </Link>
        </div>
      </header>

      {/* Main Settings Panel */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">لوحة التحكم</Link>
          <span>/</span>
          <span className="text-zinc-400 font-medium">إعدادات العيادة</span>
        </div>

        {/* Dynamic Tab Switcher */}
        <div className="flex border-b border-zinc-800 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 ${
              activeTab === "profile"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🏢 ملف العيادة الأساسي
            {activeTab === "profile" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab("branches")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 ${
              activeTab === "branches"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            📍 الفروع وأوقات العمل
            {activeTab === "branches" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("services")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 ${
              activeTab === "services"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🩺 الخدمات الطبية
            {activeTab === "services" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("doctors")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 ${
              activeTab === "doctors"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🧑‍⚕️ الأطباء والطاقم
            {activeTab === "doctors" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("kb")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 ${
              activeTab === "kb"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            📚 قاعدة المعرفة RAG
            {activeTab === "kb" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="pt-2">
          {activeTab === "profile" && <ClinicProfileCard />}
          {activeTab === "branches" && <BranchTable />}
          {activeTab === "services" && <ServiceTable />}
          {activeTab === "doctors" && <DoctorTable />}
          {activeTab === "kb" && <KnowledgeBaseTable />}
        </div>
      </main>
    </div>
  );
}
