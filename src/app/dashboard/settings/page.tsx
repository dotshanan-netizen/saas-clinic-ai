"use client";

import React from "react";
import Link from "next/link";
import { ClinicProfileCard } from "@/components/dashboard/settings/ClinicProfileCard";

export default function SettingsPage() {
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
            <p className="text-xs text-zinc-400">تخصيص الملف التعريفي، قنوات التواصل وسلوك المساعد الذكي</p>
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

        {/* Sprint 3A Component: Clinic Profile Card */}
        <ClinicProfileCard />
      </main>
    </div>
  );
}
