"use client";

import React, { useState } from "react";
import { ServiceTable } from "@/components/dashboard/settings/ServiceTable";
import { KnowledgeBaseTable } from "@/components/dashboard/settings/KnowledgeBaseTable";

type KnowledgeTab = "services" | "faq" | "documents";

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("services");

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Page Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-zinc-200">إدارة قاعدة المعرفة (Knowledge Base)</h2>
          <p className="text-[10px] text-zinc-500">تغذية وتدريب المساعد الذكي للإجابة عن خدمات وأسعار وسياسات العيادة</p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto">
        {/* Navigation Breadcrumb */}
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <span>لوحة التحكم</span>
          <span>/</span>
          <span className="text-zinc-400 font-medium">قاعدة المعرفة</span>
        </div>

        {/* Dynamic Tab Switcher */}
        <div className="flex gap-4 overflow-x-auto shrink-0 pb-2">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex-shrink-0 outline-none border cursor-pointer ${
              activeTab === "services"
                ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            🩺 الخدمات والأسعار (Services)
          </button>

          <button
            onClick={() => setActiveTab("faq")}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex-shrink-0 outline-none border cursor-pointer ${
              activeTab === "faq"
                ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            ❓ الأسئلة الشائعة (FAQ)
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex-shrink-0 outline-none border cursor-pointer ${
              activeTab === "documents"
                ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            📜 المستندات والسياسات (Documents)
          </button>
        </div>

        {/* Tab Contents */}
        <div className="pt-2">
          {activeTab === "services" && <ServiceTable />}
          {activeTab === "faq" && <KnowledgeBaseTable categoryFilter="FAQ" />}
          {activeTab === "documents" && <KnowledgeBaseTable categoryFilter={["POLICY", "GENERAL_INFO"]} />}
        </div>
      </main>
    </div>
  );
}
