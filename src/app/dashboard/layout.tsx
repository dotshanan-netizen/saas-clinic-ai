"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "المحادثات",
      href: "/dashboard",
      icon: "💬",
    },
    {
      name: "المواعيد",
      href: "/dashboard/appointments",
      icon: "📅",
    },
    {
      name: "المعرفة",
      href: "/dashboard/knowledge",
      icon: "📚",
    },
    {
      name: "التحليلات",
      href: "/dashboard/analytics",
      icon: "📊",
    },
    {
      name: "الإعدادات",
      href: "/dashboard/settings",
      icon: "⚙️",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans antialiased" dir="rtl">
      {/* Shared Sidebar Navigation (Right side in RTL) */}
      <aside className="w-72 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div className="flex flex-col">
          {/* Logo & Platform Name */}
          <div className="p-6 border-b border-zinc-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-400 flex items-center justify-center font-bold text-zinc-950 text-lg shadow-lg shadow-indigo-500/20">
              CA
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-indigo-400 to-purple-200 bg-clip-text text-transparent">
                Clinova AI
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">منصة استقبال المرضى</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-5 space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info inside sidebar */}
        <div className="p-4 border-t border-zinc-800 text-center text-[10px] text-zinc-650">
          © {new Date().getFullYear()} Clinova Workspace
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
