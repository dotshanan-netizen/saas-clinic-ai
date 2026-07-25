import React from "react";

interface AnalyticsSummaryCardProps {
  label: string;
  value: string;
  description: string;
  icon: string;
  tone?: "indigo" | "emerald" | "amber" | "rose";
}

const toneClasses = {
  indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
};

export function AnalyticsSummaryCard({ label, value, description, icon, tone = "indigo" }: AnalyticsSummaryCardProps) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-xl shadow-black/10"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-zinc-400">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-zinc-100" dir="ltr">{value}</p></div><span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${toneClasses[tone]}`}>{icon}</span></div><p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{description}</p></article>;
}
