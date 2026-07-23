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
        <div className="flex border-b border-zinc-800 gap-6 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("services")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "services"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🩺 الخدمات والأسعار (Services)
            {activeTab === "services" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("faq")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "faq"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            ❓ الأسئلة الشائعة (FAQ)
            {activeTab === "faq" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer flex-shrink-0 outline-none ${
              activeTab === "documents"
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            📜 المستندات والسياسات (Documents)
            {activeTab === "documents" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" />
            )}
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
