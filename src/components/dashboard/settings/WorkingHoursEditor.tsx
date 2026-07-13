"use client";

import React, { useState, useEffect } from "react";

interface WorkingHour {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isClosed: boolean;
}

interface WorkingHoursEditorProps {
  branchId: string;
  branchName: string;
  onClose: () => void;
}

const ARABIC_DAYS: Record<string, string> = {
  MONDAY: "الإثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
  SATURDAY: "السبت",
  SUNDAY: "الأحد",
};

const DAYS_ORDER = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

export function WorkingHoursEditor({ branchId, branchName, onClose }: WorkingHoursEditorProps) {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [hours, setHours] = useState<WorkingHour[]>([]);

  // Fetch Working Hours on mount or branch change
  useEffect(() => {
    let active = true;
    async function loadHours() {
      try {
        setLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const res = await fetch(`/api/clinic/branches/working-hours?branchId=${branchId}`);
        if (!res.ok) {
          throw new Error("فشل في تحميل ساعات العمل للفرع");
        }
        const data: WorkingHour[] = await res.json();
        
        if (!active) return;

        // Populate all 7 days in ordered list, filling missing ones with default hours
        const hourMap = new Map<string, WorkingHour>();
        data.forEach(h => hourMap.set(h.dayOfWeek, h));

        const fullHours: WorkingHour[] = DAYS_ORDER.map(day => {
          const existing = hourMap.get(day);
          return existing || {
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "21:00",
            isClosed: false,
          };
        });

        setHours(fullHours);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
        setErrorMsg(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHours();
    return () => {
      active = false;
    };
  }, [branchId]);

  // Handle Input Changes
  const handleToggleClosed = (index: number) => {
    const updated = [...hours];
    updated[index].isClosed = !updated[index].isClosed;
    setHours(updated);
  };

  const handleTimeChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const updated = [...hours];
    updated[index][field] = value;
    setHours(updated);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        clinicSlug,
        branchId,
        hours: hours.map(h => ({
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          isClosed: h.isClosed,
        })),
      };

      const res = await fetch("/api/clinic/branches/working-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ أوقات العمل");
      }

      setSuccessMsg("تم تحديث ساعات العمل بنجاح! 🕒✨");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-zinc-400">جاري تحميل ساعات العمل...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            🕒 أوقات عمل فرع {branchName}
          </h3>
          <p className="text-[10px] text-zinc-400 mt-1">
            حدد فترات العمل الصباحية والمسائية أو أيام الإجازات لجدولة الحجوزات بدقة
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors cursor-pointer"
        >
          إغلاق المحرر ✕
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Table representation of 7 days */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 text-right font-semibold">اليوم</th>
                <th className="pb-3 text-center font-semibold w-24">مغلق (إجازة)</th>
                <th className="pb-3 text-center font-semibold w-32">يبدأ من</th>
                <th className="pb-3 text-center font-semibold w-32">ينتهي في</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {hours.map((day, index) => (
                <tr key={day.dayOfWeek} className={`hover:bg-zinc-850/20 ${day.isClosed ? "text-zinc-500" : "text-zinc-200"}`}>
                  {/* Arabic Day Name */}
                  <td className="py-3 font-semibold text-zinc-300">
                    {ARABIC_DAYS[day.dayOfWeek]}
                  </td>

                  {/* Toggle closed */}
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={day.isClosed}
                      onChange={() => handleToggleClosed(index)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900 cursor-pointer"
                    />
                  </td>

                  {/* Start time */}
                  <td className="py-3 text-center">
                    <input
                      type="time"
                      value={day.startTime}
                      disabled={day.isClosed}
                      onChange={(e) => handleTimeChange(index, "startTime", e.target.value)}
                      className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-30 disabled:border-zinc-900"
                    />
                  </td>

                  {/* End time */}
                  <td className="py-3 text-center">
                    <input
                      type="time"
                      value={day.endTime}
                      disabled={day.isClosed}
                      onChange={(e) => handleTimeChange(index, "endTime", e.target.value)}
                      className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-30 disabled:border-zinc-900"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl">
            {successMsg}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "جاري الحفظ..." : "حفظ ساعات العمل 🕒"}
          </button>
        </div>
      </form>
    </div>
  );
}
